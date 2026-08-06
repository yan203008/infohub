import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const appFile = new URL("../app/infohub-app.tsx", import.meta.url);
const curatedAdminFile = new URL("../app/admin/curated-admin.tsx", import.meta.url);
const collectorFile = new URL("../scripts/collect.mjs", import.meta.url);
const workflowFile = new URL("../.github/workflows/collect.yml", import.meta.url);
const gatewayFile = new URL("../submission-gateway/index.ts", import.meta.url);

test("builds the four-part user experience", async () => {
  await access(new URL("../dist/server/index.js", import.meta.url));
  const source = await readFile(appFile, "utf8");

  assert.match(source, /label="日报"/);
  assert.match(source, /label="精选"/);
  assert.match(source, /label="收藏"/);
  assert.match(source, /label="我的"/);
  assert.match(source, /X 推特内容/);
  assert.match(source, /热门论文/);
  assert.match(source, /GitHub Trending/);
  assert.doesNotMatch(source, /label="精读"/);
  assert.match(source, /内容收藏/);
  assert.match(source, /我的笔记/);
  assert.match(source, /generated-curated\.json/);
  assert.match(source, /infohub-saved-snapshots/);
  assert.match(source, /infohub-private-backup/);
});

test("includes the independent curated editor", async () => {
  const source = await readFile(curatedAdminFile, "utf8");
  const adminHtml = await readFile(new URL("../admin.html", import.meta.url), "utf8");

  assert.match(source, /卡片摘要/);
  assert.match(source, /Summary/);
  assert.match(source, /主题/);
  assert.match(source, /每篇最多设置 2 个主题/);
  assert.match(source, /最后更新/);
  assert.match(source, /展示日期/);
  assert.match(source, /Takeaways/);
  assert.match(source, /Markdown/);
  assert.match(source, /takeawayFormat/);
  assert.match(source, /takeawayRaw/);
  assert.match(source, /bodyFormat/);
  assert.match(source, /正文输入格式/);
  assert.match(source, /保存草稿/);
  assert.match(source, /预览文章/);
  assert.match(source, /确认发布/);
  assert.match(source, /隐藏/);
  assert.match(source, /恢复展示/);
  assert.match(source, /新增文章/);
  assert.match(adminHtml, /精选编辑后台/);
});

test("keeps daily automation limited to X, papers and GitHub", async () => {
  const [collector, workflow] = await Promise.all([
    readFile(collectorFile, "utf8"),
    readFile(workflowFile, "utf8"),
  ]);

  assert.match(collector, /\["follow-builders", collectFollowBuilders\]/);
  assert.match(collector, /\["technical-x", collectTechnicalX\]/);
  assert.match(collector, /\["papers", collectPapers\]/);
  assert.match(collector, /\["github", collectGithub\]/);
  assert.doesNotMatch(collector, /\["youtube", collectYoutube\]/);
  assert.match(workflow, /MOONSHOT_API_KEY/);
  assert.doesNotMatch(workflow, /SUPADATA_API_KEY|GETNOTE_API_KEY|GETNOTE_CLIENT_ID/);
  assert.match(workflow, /archive:daily/);
});

test("publishes curated content through the protected gateway", async () => {
  const source = await readFile(gatewayFile, "utf8");

  assert.match(source, /\/curated\/list/);
  assert.match(source, /\/curated\/save/);
  assert.match(source, /\/curated\/publish/);
  assert.match(source, /\/curated\/unpublish/);
  assert.match(source, /\/curated\/delete/);
  assert.match(source, /validSession/);
  assert.match(source, /generated-curated\.json/);
  assert.match(source, /GITHUB_TOKEN/);
});

test("includes opt-in Web Push without private reading data", async () => {
  const [app, gateway] = await Promise.all([
    readFile(appFile, "utf8"),
    readFile(gatewayFile, "utf8"),
  ]);
  assert.match(app, /Notification\.requestPermission/);
  assert.match(app, /pushManager\.subscribe/);
  assert.match(gateway, /sendDailyDigestNotification/);
  assert.match(gateway, /日报 \$\{dailyCount\} 条/);
  assert.doesNotMatch(gateway, /readingProgress|infohub-highlights/);
});
