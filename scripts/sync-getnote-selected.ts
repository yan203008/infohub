#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  listGetNoteSelections,
  processManualContent,
  type ManualContentType,
} from "../lib/manual-content-processing";

type FeedItem = Record<string, unknown> & { id?: string; sourceUrl?: string };

const root = resolve(import.meta.dirname, "..");
const feedPath = join(root, "app/generated-feed.json");
const statusPath = join(root, "public/generated-submission-status.json");
const syncTag = process.env.GETNOTE_SYNC_TAG?.trim() || "InfoHub精选";

async function readArray<T>(path: string): Promise<T[]> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

async function writeArray(path: string, values: unknown[]) {
  await writeFile(path, `${JSON.stringify(values, null, 2)}\n`);
}

function contentType(url: string, noteType: string): ManualContentType {
  if (/youtu(?:\.be|be\.com)/i.test(url)) return "youtube";
  if (/xiaoyuzhoufm\.com/i.test(url) || /audio/i.test(noteType)) return "podcast";
  return "article";
}

function publicItem(processed: Awaited<ReturnType<typeof processManualContent>>) {
  return {
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
}

const feed = await readArray<FeedItem>(feedPath);
const statuses = await readArray<Record<string, unknown>>(statusPath);
const selections = await listGetNoteSelections(syncTag);
const merged = new Map(feed.map((item) => [String(item.id), item]));
const nextStatuses = new Map(statuses.map((status) => [String(status.id), status]));
let published = 0;
let failed = 0;

for (const selection of selections) {
  const externalId = `getnote-${selection.noteId}`;
  const type = contentType(selection.url, selection.noteType);
  const itemId = `manual-${type}:${externalId}`;
  if (merged.has(itemId)) continue;
  const statusId = `getnote-sync-${selection.noteId}`;
  try {
    nextStatuses.set(statusId, {
      id: statusId,
      url: selection.url,
      status: "processing",
      step: "ai",
      title: selection.title,
      updatedAt: new Date().toISOString(),
    });
    const processed = await processManualContent(externalId, selection.url, type, {
      cachedExtraction: { title: selection.title, text: selection.text },
    });
    const item = publicItem(processed);
    merged.set(String(item.id), item);
    nextStatuses.set(statusId, {
      id: statusId,
      url: selection.url,
      status: "published",
      step: "publish",
      title: processed.title,
      updatedAt: new Date().toISOString(),
    });
    published += 1;
  } catch (error) {
    nextStatuses.set(statusId, {
      id: statusId,
      url: selection.url,
      status: "failed",
      title: selection.title,
      error: error instanceof Error ? error.message.slice(0, 180) : "处理失败",
      updatedAt: new Date().toISOString(),
    });
    failed += 1;
  }
}

if (published > 0) {
  const sorted = [...merged.values()].sort((a, b) =>
    String(b.publishedAt ?? b.digestDate ?? "").localeCompare(String(a.publishedAt ?? a.digestDate ?? "")),
  );
  await writeArray(feedPath, sorted);
}
if (published > 0 || failed > 0) {
  await writeArray(statusPath, [...nextStatuses.values()].slice(-100).reverse());
}

console.log(JSON.stringify({ tag: syncTag, matched: selections.length, published, failed }));
if (failed > 0) process.exitCode = 1;
