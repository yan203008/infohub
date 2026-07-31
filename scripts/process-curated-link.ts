#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { processManualContent, type ManualContentType } from "../lib/manual-content-processing";

type QueueItem = {
  id: string;
  url: string;
  createdAt: string;
  attempts: number;
};

type PublicStatus = {
  id: string;
  url: string;
  status: "scheduled" | "processing" | "published" | "failed";
  step?: "extract" | "ai" | "quality" | "publish";
  title?: string;
  error?: string;
  updatedAt: string;
};

const root = resolve(import.meta.dirname, "..");
const feedPath = join(root, "app/generated-feed.json");
const queuePath = join(root, "config/manual-queue.json");
const statusPath = join(root, "public/generated-submission-status.json");

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? "";
}

async function readArray<T>(path: string): Promise<T[]> {
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    return Array.isArray(value) ? value as T[] : [];
  } catch {
    return [];
  }
}

async function writeArray(path: string, value: unknown[]) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function detectType(url: string): ManualContentType {
  if (/youtu(?:\.be|be\.com)/i.test(url)) return "youtube";
  if (/xiaoyuzhoufm\.com/i.test(url)) return "podcast";
  return "article";
}

function friendlyError(error: unknown) {
  const value = error instanceof Error ? error.message : "处理失败";
  if (/overloaded|繁忙|429/i.test(value)) return "AI 服务当前繁忙，系统将在稍后重试。";
  if (/Supadata/i.test(value)) return "暂时没有取得可用文字稿，请稍后重试。";
  if (/Get笔记|GetNote/i.test(value)) return "内容提取服务暂时不可用，请稍后重试。";
  return value.slice(0, 180);
}

async function updateStatus(next: PublicStatus) {
  const statuses = await readArray<PublicStatus>(statusPath);
  const merged = [next, ...statuses.filter((item) => item.id !== next.id)]
    .slice(0, 100);
  await writeArray(statusPath, merged);
}

async function processOne(entry: QueueItem) {
  const base = { id: entry.id, url: entry.url, updatedAt: new Date().toISOString() };
  await updateStatus({ ...base, status: "processing", step: "extract" });
  try {
    const processed = await processManualContent(entry.id, entry.url, detectType(entry.url), {
      onStep: async (step) => updateStatus({ ...base, status: "processing", step, updatedAt: new Date().toISOString() }),
    });
    const publicItem = {
      ...processed.body,
      id: `${processed.source.id}:${processed.externalId}`,
      title: processed.title,
      sourceUrl: processed.sourceUrl,
      summary: processed.summary,
      tags: processed.keywords,
      source: processed.source.type,
      sourceLabel: processed.source.name,
      publishedAt: processed.publishedAt,
    };
    const feed = (await readArray<Record<string, unknown>>(feedPath))
      .filter((item) => String(item.sourceUrl ?? "") !== entry.url);
    const merged = new Map(feed.map((item) => [String(item.id), item]));
    merged.set(String(publicItem.id), publicItem);
    const sorted = [...merged.values()].sort((a, b) =>
      String(b.publishedAt ?? b.digestDate ?? "").localeCompare(String(a.publishedAt ?? a.digestDate ?? "")),
    );
    await writeArray(feedPath, sorted);
    await updateStatus({ ...base, status: "published", step: "publish", title: processed.title, updatedAt: new Date().toISOString() });
  } catch (error) {
    await updateStatus({ ...base, status: "failed", error: friendlyError(error), updatedAt: new Date().toISOString() });
    throw error;
  }
}

async function enqueue() {
  const id = argument("id");
  const url = argument("url");
  if (!id || !url) throw new Error("缺少精选内容编号或链接");
  const queue = await readArray<QueueItem>(queuePath);
  const item: QueueItem = { id, url, attempts: 0, createdAt: new Date().toISOString() };
  await writeArray(queuePath, [item, ...queue.filter((entry) => entry.id !== id)]);
  await updateStatus({ id, url, status: "scheduled", updatedAt: new Date().toISOString() });
}

async function processQueue() {
  const queue = await readArray<QueueItem>(queuePath);
  const remaining: QueueItem[] = [];
  let failed = false;
  for (const item of queue.slice().reverse()) {
    try {
      await processOne(item);
    } catch {
      failed = true;
      if (item.attempts + 1 < 5) remaining.unshift({ ...item, attempts: item.attempts + 1 });
    }
  }
  await writeArray(queuePath, remaining);
  if (failed) process.exitCode = 1;
}

if (process.argv.includes("--enqueue")) {
  await enqueue();
} else if (process.argv.includes("--queue")) {
  await processQueue();
} else {
  const id = argument("id");
  const url = argument("url");
  if (!id || !url) throw new Error("用法：--id=... --url=...");
  await processOne({ id, url, attempts: 0, createdAt: new Date().toISOString() });
}
