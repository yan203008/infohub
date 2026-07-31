#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const maximumAttempts = 5;
const sleep = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

function runCollector({ source, summariesOnly = false } = {}) {
  return new Promise((resolveRun) => {
    const args = [join(root, "scripts/collect.mjs")];
    if (summariesOnly) args.push("--summaries-only");
    else if (source) args.push(`--source=${source}`);
    const child = spawn(process.execPath, args, { cwd: root, env: process.env, stdio: "inherit" });
    child.on("exit", (code) => resolveRun(code ?? 1));
  });
}

async function readReport(source) {
  const name = source ? `last-collection-${source}.json` : "last-collection.json";
  return JSON.parse(await readFile(join(root, "outputs", name), "utf8"));
}

await runCollector();
const aggregate = await readReport();
const attempts = Object.fromEntries(aggregate.sources.map((source) => [source.id, 1]));
let failedSources = aggregate.sources
  .filter((source) => source.status === "failed")
  .map((source) => source.id);
let summaryNeedsRetry = aggregate.stages.find((stage) => stage.id === "summarize")?.status === "failed";

for (let attempt = 2; attempt <= maximumAttempts && failedSources.length > 0; attempt += 1) {
  console.error(`[collect] source retry ${attempt}/${maximumAttempts}: ${failedSources.join(", ")}`);
  await sleep(5_000);
  const stillFailed = [];
  for (const source of failedSources) {
    attempts[source] = attempt;
    await runCollector({ source });
    try {
      const report = await readReport(source);
      const sourceResult = report.sources.find((entry) => entry.id === source);
      if (!sourceResult || sourceResult.status === "failed") {
        stillFailed.push(source);
      } else {
        const index = aggregate.sources.findIndex((entry) => entry.id === source);
        if (index >= 0) aggregate.sources[index] = sourceResult;
        aggregate.errors = aggregate.errors.filter((error) => error.source !== source);
      }
      if (report.stages.find((stage) => stage.id === "summarize")?.status === "failed") {
        summaryNeedsRetry = true;
      }
    } catch {
      stillFailed.push(source);
    }
  }
  failedSources = stillFailed;
}

let summaryFailed = false;
if (summaryNeedsRetry && aggregate.sources.some((source) => source.status !== "failed")) {
  console.error("[collect] retrying section summaries after source processing");
  summaryFailed = (await runCollector({ summariesOnly: true })) !== 0;
  const summaryStage = aggregate.stages.find((stage) => stage.id === "summarize");
  if (summaryStage) {
    summaryStage.status = summaryFailed ? "failed" : "completed";
    summaryStage.detail = summaryFailed ? "板块总结重试后仍失败" : "板块总结已在失败后重试成功";
  }
}

for (const source of aggregate.sources) source.retryAttempts = attempts[source.id] || 1;
const successfulSources = aggregate.sources.filter((source) => source.status !== "failed");
aggregate.itemCount = successfulSources.reduce((total, source) => total + Number(source.itemCount || 0), 0);
aggregate.validItemCount = aggregate.itemCount;
aggregate.publishedCount = aggregate.itemCount;
aggregate.errors = aggregate.errors.filter((error) => !aggregate.sources.some(
  (source) => source.id === error.source && source.status !== "failed",
));
if (!summaryFailed) {
  aggregate.errors = aggregate.errors.filter((error) => !String(error.source).startsWith("summary"));
}
for (const source of failedSources) {
  if (!aggregate.errors.some((error) => error.source === source)) {
    aggregate.errors.push({ source, message: `Failed after ${maximumAttempts} attempts` });
  }
}
if (summaryFailed && !aggregate.errors.some((error) => String(error.source).startsWith("summary"))) {
  aggregate.errors.push({ source: "summary", message: "Failed after API retries and one workflow retry" });
}
try {
  aggregate.sectionSummaries = JSON.parse(await readFile(join(root, "app/generated-section-summaries.json"), "utf8"));
} catch {
  // Keep the summaries from the initial report if the public file is unavailable.
}
aggregate.status = failedSources.length > 0 || summaryFailed ? "completed_with_errors" : "completed";
const collectStage = aggregate.stages.find((stage) => stage.id === "collect");
if (collectStage) {
  collectStage.status = successfulSources.length > 0 ? "completed" : "failed";
  collectStage.detail = `完成 ${successfulSources.length}/${aggregate.sources.length} 个来源，共 ${aggregate.itemCount} 条内容`;
}
const qualityStage = aggregate.stages.find((stage) => stage.id === "quality");
if (qualityStage) {
  qualityStage.status = aggregate.itemCount > 0 ? "completed" : "failed";
  qualityStage.detail = `通过 ${aggregate.itemCount} 条公开内容`;
}
const publishStage = aggregate.stages.find((stage) => stage.id === "publish");
if (publishStage) {
  publishStage.status = aggregate.itemCount > 0 ? "completed" : "failed";
  publishStage.detail = aggregate.itemCount > 0 ? `已写入 ${aggregate.itemCount} 条公开内容` : "没有可发布内容";
}
aggregate.finishedAt = new Date().toISOString();

await Promise.all([
  writeFile(join(root, "outputs/last-collection.json"), `${JSON.stringify(aggregate, null, 2)}\n`),
  writeFile(join(root, "app/generated-run-summary.json"), `${JSON.stringify(aggregate, null, 2)}\n`),
  writeFile(join(root, "outputs/collection-status.json"), `${JSON.stringify({
    ok: failedSources.length === 0 && !summaryFailed,
    failedSources,
    summaryFailed,
    attempts,
    finishedAt: aggregate.finishedAt,
  }, null, 2)}\n`),
]);

if (failedSources.length > 0) {
  console.error(`[collect] failed after ${maximumAttempts} attempts: ${failedSources.join(", ")}`);
  console.error("[collect] successful sources were preserved and published; failed sources remain visible in the report");
}
if (failedSources.length > 0 || summaryFailed) process.exitCode = 1;
