#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const feedPath = join(root, "app/generated-feed.json");
const curatedPath = join(root, "public/generated-curated.json");
const feed = JSON.parse(await readFile(feedPath, "utf8"));
const existing = JSON.parse(await readFile(curatedPath, "utf8"));
const isLegacyCurated = (item) => String(item.id ?? "").startsWith("manual-")
  || item.section === "reading"
  || String(item.sourceLabel ?? "").startsWith("管理员精选");
const legacy = feed.filter(isLegacyCurated).map((item) => ({
  ...item,
  id: `curated-${String(item.id).replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 72)}`,
  section: "reading",
}));
const ordered = [...existing, ...legacy].sort((a, b) => String(b.publishedAt ?? b.digestDate).localeCompare(String(a.publishedAt ?? a.digestDate)));
const seen = new Set();
const curated = ordered.filter((item) => {
  const key = String(item.sourceUrl || item.id).trim().toLocaleLowerCase();
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

await Promise.all([
  writeFile(feedPath, `${JSON.stringify(feed.filter((item) => !isLegacyCurated(item)), null, 2)}\n`),
  writeFile(curatedPath, `${JSON.stringify(curated, null, 2)}\n`),
]);

console.log(`Migrated ${legacy.length} legacy curated article(s); ${curated.length} unique article(s) retained.`);
