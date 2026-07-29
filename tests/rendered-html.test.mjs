import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const appFile = new URL("../app/infohub-app.tsx", import.meta.url);
const adminFile = new URL("../app/admin/admin-console.tsx", import.meta.url);
const youtubePromptFile = new URL("../lib/youtube-processing-prompt.ts", import.meta.url);

test("builds the InfoHub daily experience", async () => {
  await access(new URL("../dist/server/index.js", import.meta.url));
  const source = await readFile(appFile, "utf8");

  assert.match(source, /label="每日"/);
  assert.match(source, /最近七天/);
  assert.match(source, /历史日报/);
  assert.doesNotMatch(source, /更多日期/);
  assert.match(source, /X 推特内容/);
  assert.match(source, /热门论文/);
  assert.match(source, /GitHub Trending/);
  assert.match(source, /热门 YouTube/);
  assert.match(source, /调整首页板块/);
  assert.match(source, /移出首页/);
  assert.match(source, /infohub-section-preferences/);
  assert.match(source, /label="待读"/);
  assert.match(source, /加入待读/);
  assert.match(source, /完成/);
  assert.doesNotMatch(source, /label="发现"/);
  assert.doesNotMatch(source, /不感兴趣/);
  assert.match(source, /2026-07-28/);
  assert.match(source, /2026-07-29/);
  assert.match(source, /打开 GitHub 仓库/);
  assert.match(source, /最近两天没有新视频/);
});

test("includes both configured YouTube sources and original links", async () => {
  const source = await readFile(appFile, "utf8");

  assert.match(source, /Mel Robbins/);
  assert.match(source, /Predictive History/);
  assert.match(source, /Follow Builders/);
  assert.match(source, /sourceLabel: "技术动态"/);
  assert.match(source, /youtube\.com\/watch\?v=9tKZ3w-Gku8/);
  assert.match(source, /youtube\.com\/watch\?v=A9Sr-4c-3Tg/);
});

test("uses the direct YouTube transcript processing prompt", async () => {
  const [admin, prompt] = await Promise.all([
    readFile(adminFile, "utf8"),
    readFile(youtubePromptFile, "utf8"),
  ]);

  assert.match(admin, /YouTube 文字稿加工 Prompt/);
  assert.match(prompt, /Takeaways 必须放在文章前面/);
  assert.match(prompt, /完整覆盖视频实际讲述的内容/);
  assert.match(prompt, /不要询问用户选择/);
});
