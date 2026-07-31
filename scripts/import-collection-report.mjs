#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const reportPath = process.argv[2];
if (!reportPath) throw new Error("Usage: npm run import:report -- /path/to/last-collection.json");

const report = JSON.parse(await readFile(reportPath, "utf8"));
const feedPath = join(root, "app/generated-feed.json");
const summariesPath = join(root, "app/generated-section-summaries.json");
const runSummaryPath = join(root, "app/generated-run-summary.json");
const existingFeed = JSON.parse(await readFile(feedPath, "utf8"));
const existingSummaries = JSON.parse(await readFile(summariesPath, "utf8"));
const reportDigestDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(report.generatedAt));

const publicItems = (report.items || []).map((item) => ({
  ...item.body,
  digestDate: reportDigestDate,
  id: `${item.source.id}:${item.externalId}`,
  title: item.title,
  sourceUrl: item.sourceUrl,
  summary: item.summary,
  tags: item.keywords,
  source: item.source.type,
  sourceLabel: item.source.name,
  publishedAt: item.publishedAt,
}));
const mergedFeed = new Map(existingFeed.map((item) => [item.id, item]));
for (const item of publicItems) mergedFeed.set(item.id, item);
const feed = [...mergedFeed.values()].sort((a, b) =>
  String(b.publishedAt ?? b.digestDate ?? "").localeCompare(String(a.publishedAt ?? a.digestDate ?? "")),
);

const mergedSummaries = new Map(existingSummaries.map((summary) => [summary.section, summary]));
for (const summary of report.sectionSummaries || []) mergedSummaries.set(summary.section, summary);
const publicRunSummary = { ...report };
delete publicRunSummary.items;
delete publicRunSummary.upload;

await Promise.all([
  writeFile(feedPath, `${JSON.stringify(feed, null, 2)}\n`),
  writeFile(summariesPath, `${JSON.stringify([...mergedSummaries.values()], null, 2)}\n`),
  writeFile(runSummaryPath, `${JSON.stringify(publicRunSummary, null, 2)}\n`),
]);

console.log(`Imported ${publicItems.length} valid items from collection report.`);
