import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const appFile = new URL("../app/infohub-app.tsx", import.meta.url);
const adminFile = new URL("../app/admin/admin-console.tsx", import.meta.url);
const youtubePromptFile = new URL("../lib/youtube-processing-prompt.ts", import.meta.url);
const collectorFile = new URL("../scripts/collect.mjs", import.meta.url);
const workflowFile = new URL("../.github/workflows/collect.yml", import.meta.url);
const feedFile = new URL("../app/generated-feed.json", import.meta.url);
const serviceWorkerFile = new URL("../public/sw.js", import.meta.url);
const gatewayFile = new URL("../submission-gateway/index.ts", import.meta.url);
const getNoteSyncFile = new URL("../scripts/sync-getnote-selected.ts", import.meta.url);

test("builds the InfoHub daily experience", async () => {
  await access(new URL("../dist/server/index.js", import.meta.url));
  const source = await readFile(appFile, "utf8");

  assert.match(source, /label="日报"/);
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
  assert.match(source, /label="精读"/);
  assert.match(source, /公开精选/);
  assert.match(source, /我的感兴趣/);
  assert.match(source, /标记为感兴趣/);
  assert.doesNotMatch(source, /label="精读"\s+count=/);
  assert.match(source, /完成/);
  assert.doesNotMatch(source, /label="发现"/);
  assert.doesNotMatch(source, /不感兴趣/);
  assert.match(source, /2026-07-28/);
  assert.match(source, /2026-07-29/);
  assert.match(source, /打开 GitHub 仓库/);
  assert.match(source, /频道更新/);
  assert.doesNotMatch(source, /首页只展示板块总结/);
  assert.match(source, /关注前沿研究动态/);
  assert.match(source, /summary\.digestDate === selectedDate/);
  assert.match(source, /home-summary-card/);
  assert.match(source, /返回板块总结/);
  assert.match(source, /中文摘要/);
  assert.match(source, /对非技术读者有什么用/);
  assert.match(source, /链接直达：/);
  assert.match(source, /搜索整个 InfoHub/);
  assert.match(source, /笔记 · 划线笔记/);
  assert.match(source, /infohub-private-backup/);
  assert.match(source, /不包含管理员密码或令牌/);
  assert.doesNotMatch(source, /notification-button/);
  assert.match(source, /每日更新通知/);
  assert.match(source, /\/push\/subscribe/);
  assert.match(source, /getAvailableDailyDates/);
  assert.match(source, /generated-feed\.json\?t=/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /新内容已更新/);
});

test("includes opt-in Web Push without exposing private user data", async () => {
  const [app, serviceWorker, gateway] = await Promise.all([
    readFile(appFile, "utf8"),
    readFile(serviceWorkerFile, "utf8"),
    readFile(gatewayFile, "utf8"),
  ]);

  assert.match(app, /Notification\.requestPermission/);
  assert.match(app, /pushManager\.subscribe/);
  assert.match(app, /关闭每日通知/);
  assert.match(serviceWorker, /addEventListener\("push"/);
  assert.match(serviceWorker, /showNotification/);
  assert.match(serviceWorker, /notificationclick/);
  assert.match(gateway, /PUSH_SUBSCRIPTIONS/);
  assert.match(gateway, /sendDailyDigestNotification/);
  assert.match(gateway, /scheduled\(/);
  assert.doesNotMatch(gateway, /note|highlight|readingProgress/i);
});

test("restores the missing July 30 digest from existing real content", async () => {
  const feed = JSON.parse(await readFile(feedFile, "utf8"));
  const july30 = feed.filter((item) => item.digestDate === "2026-07-30");

  assert.equal(july30.length, 18);
  assert.ok(july30.every((item) => item.publishedDate === "7/30"));
});

test("includes the automatic multi-source collector", async () => {
  const [collector, workflow] = await Promise.all([
    readFile(collectorFile, "utf8"),
    readFile(workflowFile, "utf8"),
  ]);

  assert.match(collector, /collectFollowBuilders/);
  assert.match(collector, /collectTechnicalX/);
  assert.match(collector, /collectPapers/);
  assert.match(collector, /paperLookbackDays = 4/);
  assert.match(collector, /publishedPaperIds/);
  assert.match(collector, /!alreadyPublished\.has/);
  assert.match(collector, /collectGithub/);
  assert.match(collector, /collectYoutube/);
  assert.match(collector, /MOONSHOT_API_KEY/);
  assert.match(collector, /SUPADATA_API_KEY/);
  assert.match(collector, /\/api\/ingest/);
  assert.match(collector, /buildSectionSummaries/);
  assert.match(collector, /质量检查/);
  assert.match(workflow, /cron: "17 17 \* \* \*"/);
  assert.match(workflow, /SUPADATA_API_KEY/);
  assert.match(workflow, /Sync tagged GetNote selections/);
  assert.match(workflow, /GETNOTE_SYNC_TAG: InfoHub精选/);
});

test("syncs only explicitly tagged GetNote selections", async () => {
  const [processor, sync] = await Promise.all([
    readFile(new URL("../lib/manual-content-processing.ts", import.meta.url), "utf8"),
    readFile(getNoteSyncFile, "utf8"),
  ]);

  assert.match(processor, /resource\/note\/list/);
  assert.match(processor, /tags\.includes\(tag\)/);
  assert.match(sync, /InfoHub精选/);
  assert.match(sync, /getnote-\$\{selection\.noteId\}/);
  assert.match(sync, /merged\.has\(itemId\)/);
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
  assert.match(admin, /最近一次内容处理/);
  assert.match(admin, /处理总结/);
  assert.match(prompt, /Takeaways 必须放在文章前面/);
  assert.match(prompt, /完整覆盖视频实际讲述的内容/);
  assert.match(prompt, /不要询问用户选择/);
});
