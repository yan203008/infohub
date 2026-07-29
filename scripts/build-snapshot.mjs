#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sources = ["technical-x", "papers", "github", "youtube", "follow-builders"];
const items = [];
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
const cutoffDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(yesterday);

for (const source of sources) {
  try {
    const report = JSON.parse(await readFile(
      join(root, `outputs/last-collection-${source}.json`),
      "utf8",
    ));
    items.push(...(report.items || []));
  } catch {
    // A failed or empty source must not prevent the valid sources from being previewed.
  }
}

const snapshot = items.filter((item) => item.body?.digestDate >= cutoffDate).map((item) => ({
  ...item.body,
  id: `${item.source.id}:${item.externalId}`,
  title: item.title,
  sourceUrl: item.sourceUrl,
  summary: item.summary,
  tags: item.keywords,
  source: item.source.type,
  sourceLabel: item.source.name,
  publishedAt: item.publishedAt,
}));

await writeFile(
  join(root, "app/generated-feed.json"),
  `${JSON.stringify(snapshot, null, 2)}\n`,
);

console.log(`Generated preview snapshot with ${snapshot.length} items.`);
