#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const maximumAttempts = 5;

function runCollector(source) {
  return new Promise((resolveRun) => {
    const args = [join(root, "scripts/collect.mjs")];
    if (source) args.push(`--source=${source}`);
    const child = spawn(process.execPath, args, { cwd: root, env: process.env, stdio: "inherit" });
    child.on("exit", (code) => resolveRun(code ?? 1));
  });
}

async function readReport(source) {
  const name = source ? `last-collection-${source}.json` : "last-collection.json";
  return JSON.parse(await readFile(join(root, "outputs", name), "utf8"));
}

await runCollector();
const initial = await readReport();
let failedSources = initial.sources
  .filter((source) => source.status === "failed")
  .map((source) => source.id);

for (let attempt = 2; attempt <= maximumAttempts && failedSources.length > 0; attempt += 1) {
  console.error(`[collect] retry ${attempt}/${maximumAttempts}: ${failedSources.join(", ")}`);
  const stillFailed = [];
  for (const source of failedSources) {
    await runCollector(source);
    try {
      const report = await readReport(source);
      if (report.status === "failed") stillFailed.push(source);
    } catch {
      stillFailed.push(source);
    }
  }
  failedSources = stillFailed;
}

if (failedSources.length > 0) {
  console.error(`[collect] failed after ${maximumAttempts} attempts: ${failedSources.join(", ")}`);
  process.exitCode = 1;
}
