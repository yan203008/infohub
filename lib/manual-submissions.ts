import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { appSettings, contents, sources } from "../db/schema";
import { processManualContent, type ManualContentType, type ManualExtraction } from "./manual-content-processing";

export type ManualSubmission = {
  id: string;
  url: string;
  type: ManualContentType;
  timing: "immediate" | "morning";
  status: "pending" | "processing" | "published" | "failed";
  createdAt: string;
  updatedAt: string;
  currentStep?: "extract" | "ai" | "quality" | "publish";
  error?: string;
  title?: string;
  contentId?: string;
};

const queueState = globalThis as typeof globalThis & {
  __infohubManualQueue?: Promise<void>;
};

export function parseManualSubmissions(value: string | undefined) {
  try {
    const parsed = JSON.parse(value || "[]") as unknown;
    return Array.isArray(parsed) ? parsed as ManualSubmission[] : [];
  } catch {
    return [];
  }
}

export function detectManualType(url: string): ManualContentType {
  if (/youtu(?:\.be|be\.com)/i.test(url)) return "youtube";
  if (/xiaoyuzhoufm\.com/i.test(url)) return "podcast";
  return "article";
}

export async function getManualSubmissions() {
  const db = getDb();
  const rows = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, "manualSubmissions"))
    .limit(1);
  return parseManualSubmissions(rows[0]?.value);
}

export async function saveManualSubmissions(submissions: ManualSubmission[]) {
  const db = getDb();
  const now = new Date();
  await db
    .insert(appSettings)
    .values({ key: "manualSubmissions", value: JSON.stringify(submissions.slice(0, 100)), updatedAt: now })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: JSON.stringify(submissions.slice(0, 100)), updatedAt: now },
    });
}

export async function createManualSubmission(url: string, timing: ManualSubmission["timing"]) {
  const now = new Date().toISOString();
  const submission: ManualSubmission = {
    id: crypto.randomUUID(),
    url,
    type: detectManualType(url),
    timing,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  const submissions = await getManualSubmissions();
  await saveManualSubmissions([submission, ...submissions]);
  return submission;
}

function friendlyProcessingError(error: unknown) {
  const message = error instanceof Error ? error.message : "处理失败";
  if (/engine is currently overloaded|engine_overloaded|模型繁忙/i.test(message)) {
    return "Kimi 当前繁忙，任务已保留。可以稍后重试，或改为明早处理。";
  }
  return message;
}

async function getCachedExtraction(id: string) {
  const rows = await getDb()
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, `manualExtraction:${id}`))
    .limit(1);
  try {
    const parsed = JSON.parse(rows[0]?.value || "null") as ManualExtraction | null;
    return parsed?.text ? parsed : undefined;
  } catch {
    return undefined;
  }
}

async function saveCachedExtraction(id: string, extraction: ManualExtraction) {
  const now = new Date();
  await getDb().insert(appSettings).values({
    key: `manualExtraction:${id}`,
    value: JSON.stringify(extraction),
    updatedAt: now,
  }).onConflictDoUpdate({
    target: appSettings.key,
    set: { value: JSON.stringify(extraction), updatedAt: now },
  });
}

async function processUnlocked(id: string) {
  let submissions = await getManualSubmissions();
  const current = submissions.find((submission) => submission.id === id);
  if (!current) throw new Error("没有找到这条提交记录");
  const update = async (values: Partial<ManualSubmission>) => {
    submissions = (await getManualSubmissions()).map((submission) => submission.id === id
      ? { ...submission, ...values, updatedAt: new Date().toISOString() }
      : submission);
    await saveManualSubmissions(submissions);
  };
  await update({ status: "processing", currentStep: "extract", error: undefined });
  try {
    const cachedExtraction = await getCachedExtraction(id);
    const item = await processManualContent(current.id, current.url, current.type, {
      cachedExtraction,
      onStep: async (step) => {
        await update({ status: "processing", currentStep: step });
      },
      onExtracted: async (extraction) => {
        if (!cachedExtraction) await saveCachedExtraction(id, extraction);
      },
    });
    const db = getDb();
    const now = new Date();
    const publishedAt = new Date(item.publishedAt);
    const contentId = `${item.source.id}:${item.externalId}`;
    await db
      .insert(sources)
      .values({ ...item.source, enabled: true, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: sources.id,
        set: { name: item.source.name, type: item.source.type, url: item.source.url, enabled: true, updatedAt: now },
      });
    await db
      .insert(contents)
      .values({
        id: contentId,
        sourceId: item.source.id,
        externalId: item.externalId,
        title: item.title,
        sourceUrl: item.sourceUrl,
        summary: item.summary,
        body: JSON.stringify(item.body),
        keywords: item.keywords,
        status: "ready",
        publishedAt,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [contents.sourceId, contents.externalId],
        set: {
          title: item.title,
          sourceUrl: item.sourceUrl,
          summary: item.summary,
          body: JSON.stringify(item.body),
          keywords: item.keywords,
          status: "ready",
          publishedAt,
          updatedAt: now,
        },
      });
    await update({ status: "published", currentStep: "publish", title: item.title, contentId, error: undefined });
    // Keep the extraction so an editor-model retry does not spend transcript credits again.
    return { contentId, title: item.title };
  } catch (error) {
    const message = friendlyProcessingError(error);
    await update({ status: "failed", error: message });
    throw new Error(message);
  }
}

export async function processManualSubmission(id: string) {
  const previous = queueState.__infohubManualQueue ?? Promise.resolve();
  let release!: () => void;
  queueState.__infohubManualQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous.catch(() => undefined);
  try {
    return await processUnlocked(id);
  } finally {
    release();
  }
}
