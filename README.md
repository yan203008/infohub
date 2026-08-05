# InfoHub

InfoHub 是一个手机优先的 AI 日报、编辑精选与私人阅读 PWA。

- **日报**：每天自动整理 X、热门论文和 GitHub Trending。
- **精选**：编辑在独立后台粘贴已经处理好的文章，按指定日期发布。
- **收藏**：保存感兴趣的日报或精选内容，并集中查看私人笔记。
- **我的**：选择主题、开启通知、导出或恢复本地私人数据。

普通读者无需登录。收藏、阅读进度、划线和笔记只保存在读者自己的浏览器，不进入公共内容生产线。

## 产品与文档

- [产品需求文档](../信息笔记系统PRDv1.md)
- [当前产品与发布规范](docs/09-当前产品与发布规范.md)
- [工作流规范](docs/01-工作流规范.md)
- [页面与交互规范](docs/02-页面与交互规范.md)
- [AI 内容加工规范](docs/03-AI内容加工规范.md)
- [数据权限与 API 规范](docs/04-数据权限与API规范.md)
- [当前状态与备份计划](docs/05-当前状态与缺口.md)

`docs/06`—`docs/08` 是早期 Agent 执行记录，不再作为当前产品范围依据。

## 正式内容流程

### 日报

```text
GitHub Actions 每日启动
→ 采集 Follow Builders + 技术动态 X + Hugging Face 论文 + GitHub Trending
→ Kimi 中文整理与板块总结
→ 质量检查
→ 更新公开 JSON、月度归档并发布 GitHub Pages
```

### 精选

```text
管理员打开 admin.html
→ 填写标题、卡片摘要、日期、类型、Takeaways、正文和可选来源链接
→ 预览
→ 发布
→ Cloudflare Worker 将内容写入 public/generated-curated.json
→ `deploy-curated.yml` 自动重新发布 GitHub Pages
```

精选不再自动抓取链接或生成文字稿，因此正式运行不需要 Get笔记、Supadata 或 YouTube 字幕服务。

## 页面入口

- 用户端：`https://yan203008.github.io/infohub/`
- 管理后台：`https://yan203008.github.io/infohub/admin.html`
- 本地用户端：`http://localhost:3000/`
- 本地后台：`http://localhost:3000/admin`

用户端不显示后台入口。后台通过管理员密码和 24 小时会话访问，密码与 GitHub Token 只保存在 Cloudflare Worker Secrets 中。

## 必需密钥

### GitHub Actions

- `MOONSHOT_API_KEY`：仅用于日报的中文整理与板块总结。

### Cloudflare Worker

- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `GITHUB_TOKEN`：只授权 `yan203008/infohub`，必须包含 **Contents: Read and write**；Metadata 保持只读即可。
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `ALLOWED_ORIGINS`
- `VAPID_PRIVATE_KEY`

`SUPADATA_API_KEY`、`GETNOTE_API_KEY`、`GETNOTE_CLIENT_ID` 已不再是正式流程依赖，可以从 GitHub Actions Secrets 删除。本地 `.env.local` 是否保留旧 Key 由管理员决定；该文件已被 Git 忽略，不能提交。

## 本地运行与检查

要求 Node.js `>=22.13.0`。

```bash
npm install
cp .env.example .env.local
npm run dev
npm run lint
npm run build:pages
npm test
```

日报采集：

```bash
npm run collect:dry
npm run collect
npm run collect:reliable
```

## 数据与备份

- 公开日报和精选：进入 Git 仓库，可用 Git 历史恢复。
- 日报归档：每日任务将内容按月写入 `public/archive/daily/YYYY-MM.json`。
- 私人收藏和笔记：用户在“我的 → 私人数据备份”导出 JSON，并可恢复。
- 当前不使用业务数据库，避免为轻量产品增加运维成本。

如果产品连续使用超过一个季度，或编辑文章、活跃设备和私人数据明显增长，再评估对象存储/数据库、自动异地备份、恢复演练与保留周期。
