# InfoHub 数据、权限与 API 规范

## 数据边界

- 公共内容：日报、板块总结、已发布精选、来源链接。
- 管理员数据：精选草稿、状态、错误和后台会话。
- 用户私人数据：收藏快照、阅读进度、划线、批注、自由笔记、主题和板块偏好。

私人数据只在浏览器 localStorage 中保存，不发送给管理员服务。用户可导出和恢复 JSON。

## 管理员 API

- `POST /login`
- `GET /curated/list`
- `POST /curated/save`
- `POST /curated/publish`
- `POST /curated/unpublish`
- `POST /push/subscribe`
- `POST /push/unsubscribe`

精选草稿和状态保存在 Cloudflare KV。发布与撤回通过 GitHub Contents API 更新 `public/generated-curated.json`，网页中没有 GitHub Token。

## 密钥

- GitHub Actions：`MOONSHOT_API_KEY`。
- Cloudflare Worker：`ADMIN_PASSWORD`、`SESSION_SECRET`、`GITHUB_TOKEN`、`GITHUB_OWNER`、`GITHUB_REPO`、`ALLOWED_ORIGINS`、`VAPID_PRIVATE_KEY`。

Get笔记与 Supadata 不再是正式依赖。密钥不得进入前端、公共 JSON、日志或仓库。
