import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const appFile = new URL("../app/infohub-app.tsx", import.meta.url);

test("builds the InfoHub daily experience", async () => {
  await access(new URL("../dist/server/index.js", import.meta.url));
  const source = await readFile(appFile, "utf8");

  assert.match(source, /label="每日"/);
  assert.match(source, /最近七天/);
  assert.match(source, /选择单日/);
  assert.match(source, /2026-07-28/);
  assert.match(source, /2026-07-29/);
});

test("includes both configured YouTube sources and original links", async () => {
  const source = await readFile(appFile, "utf8");

  assert.match(source, /Mel Robbins/);
  assert.match(source, /Predictive History/);
  assert.match(source, /youtube\.com\/watch\?v=9tKZ3w-Gku8/);
  assert.match(source, /youtube\.com\/watch\?v=A9Sr-4c-3Tg/);
});
