import { env } from "cloudflare:workers";
import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { appSettings, sources } from "../../../../db/schema";
import { getAdminUser } from "../../../admin-auth";
import fallbackRunSummary from "../../../generated-run-summary.json";
import fallbackSources from "../../../../config/sources.json";
import {
  createManualSubmission,
  getManualSubmissions,
  parseManualSubmissions,
  processManualSubmission,
  saveManualSubmissions,
  type ManualSubmission,
} from "../../../../lib/manual-submissions";

const localState = globalThis as typeof globalThis & {
  __infohubSubmissions?: ManualSubmission[];
};

function localSources() {
  return [
    ...fallbackSources.youtube.map((source) => ({ ...source, type: "youtube", enabled: true })),
    { ...fallbackSources.followBuilders, type: "builder", enabled: true },
    { ...fallbackSources.technicalX, type: "daily", enabled: true },
    { ...fallbackSources.papers, type: "daily", enabled: true },
    { ...fallbackSources.github, type: "daily", enabled: true },
  ];
}

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const user = await getAdminUser();
  if (!user) return unauthorized();
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  const providerStatus = {
    moonshot: Boolean(runtimeEnv.MOONSHOT_API_KEY),
    supadata: Boolean(runtimeEnv.SUPADATA_API_KEY),
    getnote: Boolean(runtimeEnv.GETNOTE_API_KEY && runtimeEnv.GETNOTE_CLIENT_ID),
  };
  try {
    const db = getDb();
    const [sourceRows, settingRows] = await Promise.all([
      db.select().from(sources).orderBy(asc(sources.createdAt)),
      db.select().from(appSettings),
    ]);
    const settings = Object.fromEntries(
      settingRows.map((setting) => [setting.key, setting.value]),
    );
    let runSummary: unknown = fallbackRunSummary;
    try {
      runSummary = JSON.parse(settings.lastCollectionRun || "null") || fallbackRunSummary;
    } catch {
      runSummary = fallbackRunSummary;
    }
    return Response.json({
      sources: sourceRows,
      settings,
      runSummary,
      submissions: parseManualSubmissions(settings.manualSubmissions),
      providerStatus,
    });
  } catch {
    return Response.json({
      sources: localSources(),
      settings: {},
      runSummary: fallbackRunSummary,
      submissions: localState.__infohubSubmissions ?? [],
      providerStatus,
      mode: "local-preview",
    });
  }
}

export async function POST(request: Request) {
  const user = await getAdminUser();
  if (!user) return unauthorized();

  const payload = (await request.json()) as
    | {
        action: "addSource";
        type: "youtube" | "podcast" | "daily" | "builder" | "wechat";
        name: string;
        url: string;
      }
    | { action: "submitContent"; url: string; timing?: "immediate" | "morning" }
    | { action: "processSubmission"; id: string }
    | { action: "scheduleSubmission"; id: string }
    | { action: "deleteSource"; id: string }
    | { action: "toggleSource"; id: string; enabled: boolean }
    | { action: "requestRetry"; source: string }
    | { action: "saveSettings"; values: Record<string, string> };

  const now = new Date();

  if (payload.action === "submitContent") {
    const url = payload.url.trim();
    try {
      new URL(url);
    } catch {
      return Response.json({ error: "请输入完整的内容链接" }, { status: 400 });
    }
    try {
      const submission = await createManualSubmission(url, payload.timing === "morning" ? "morning" : "immediate");
      return Response.json({ ok: true, submission });
    } catch {
      const submission: ManualSubmission = {
        id: crypto.randomUUID(),
        url,
        type: /youtu(?:\.be|be\.com)/i.test(url) ? "youtube" : /xiaoyuzhoufm\.com/i.test(url) ? "podcast" : "article",
        timing: payload.timing === "morning" ? "morning" : "immediate",
        status: "pending",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      localState.__infohubSubmissions = [
        submission,
        ...(localState.__infohubSubmissions ?? []),
      ].slice(0, 100);
      return Response.json({ ok: true, submission });
    }
  }

  if (payload.action === "processSubmission") {
    try {
      return Response.json({ ok: true, ...(await processManualSubmission(payload.id)) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "处理失败";
      return Response.json({ error: message }, { status: 500 });
    }
  }

  if (payload.action === "scheduleSubmission") {
    const submissions = await getManualSubmissions();
    if (!submissions.some((submission) => submission.id === payload.id)) {
      return Response.json({ error: "没有找到这条提交记录" }, { status: 404 });
    }
    await saveManualSubmissions(submissions.map((submission) => submission.id === payload.id
      ? {
          ...submission,
          timing: "morning" as const,
          status: "pending" as const,
          error: undefined,
          updatedAt: new Date().toISOString(),
        }
      : submission));
    return Response.json({ ok: true });
  }

  const db = getDb();

  if (payload.action === "addSource") {
    const name = payload.name.trim();
    const url = payload.url.trim();
    if (!name || !url) {
      return Response.json({ error: "名称和链接不能为空" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    await db.insert(sources).values({
      id,
      type: payload.type,
      name,
      url,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
    return Response.json({ ok: true, id });
  }

  if (payload.action === "deleteSource") {
    await db.delete(sources).where(eq(sources.id, payload.id));
    return Response.json({ ok: true });
  }

  if (payload.action === "toggleSource") {
    await db
      .update(sources)
      .set({ enabled: payload.enabled, updatedAt: now })
      .where(eq(sources.id, payload.id));
    return Response.json({ ok: true });
  }

  if (payload.action === "requestRetry") {
    const source = payload.source.trim();
    if (!source) {
      return Response.json({ error: "缺少需要重试的信息源" }, { status: 400 });
    }
    await db
      .insert(appSettings)
      .values({
        key: "collectionRetryRequest",
        value: JSON.stringify({ source, requestedAt: now.toISOString() }),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: JSON.stringify({ source, requestedAt: now.toISOString() }),
          updatedAt: now,
        },
      });
    return Response.json({ ok: true, queued: true });
  }

  if (payload.action === "saveSettings") {
    for (const [key, value] of Object.entries(payload.values)) {
      await db
        .insert(appSettings)
        .values({ key, value, updatedAt: now })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value, updatedAt: now },
        });
    }
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unsupported action" }, { status: 400 });
}
