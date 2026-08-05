#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const feed = JSON.parse(await readFile(join(root, "app/generated-feed.json"), "utf8"));
const months = new Map();

for (const item of feed) {
  if (!item?.digestDate || item.section === "reading" || String(item.id ?? "").startsWith("manual-")) continue;
  const month = String(item.digestDate).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) continue;
  const entries = months.get(month) ?? [];
  entries.push(item);
  months.set(month, entries);
}

const target = join(root, "public/archive/daily");
await mkdir(target, { recursive: true });
await Promise.all([...months.entries()].map(([month, items]) =>
  writeFile(join(target, `${month}.json`), `${JSON.stringify(items, null, 2)}\n`),
));

console.log(`Archived ${months.size} month(s) of daily content.`);
