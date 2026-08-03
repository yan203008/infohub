# InfoHub

InfoHub 是一个手机优先的信息聚合、阅读与私人笔记 PWA。管理员统一配置公共信息源，所有访问者阅读同一份公开内容；用户的感兴趣列表、阅读状态、划线和笔记只保存在当前浏览器。

完整产品定义见项目根目录的 [`信息笔记系统PRDv1.md`](../信息笔记系统PRDv1.md)。当前采用固定的“采集 → AI整理 → 质量检查 → 发布”轻量流程，不建设通用工作流平台。

## 执行文档

- [`docs/01-工作流规范.md`](docs/01-工作流规范.md)
- [`docs/02-页面与交互规范.md`](docs/02-页面与交互规范.md)
- [`docs/03-AI内容加工规范.md`](docs/03-AI内容加工规范.md)
- [`docs/04-数据权限与API规范.md`](docs/04-数据权限与API规范.md)
- [`docs/05-当前状态与缺口.md`](docs/05-当前状态与缺口.md)
- [`docs/06-Agent执行任务书.md`](docs/06-Agent执行任务书.md)
- [`docs/07-验收清单.md`](docs/07-验收清单.md)
- [`docs/08-Agent轻量后端任务.md`](docs/08-Agent轻量后端任务.md)

## 当前能力

- 聚合 Follow Builders、技术动态 X 热榜、Hugging Face Daily Papers、GitHub Trending 和管理员配置的 YouTube 频道
- 首页按 X 推特内容、热门论文、GitHub Trending、热门 YouTube、播客分板块展示
- 用户可调整板块顺序和显示状态
- 详情页按内容类型展示中文整理结果和原始链接
- YouTube 文字稿经过 Kimi 二次加工，固定输出 Takeaways 和完整阅读文章
- 感兴趣列表、完成阅读、下一篇、阅读位置恢复和用户自选文字高亮
- `/admin` 仅供管理员在自己的电脑本地管理公共信息源和主动提交链接
- GitHub Pages 版本在“我的”中提供管理员精选入口；通过独立安全网关触发 GitHub Actions，API Key 不进入浏览器
- Get笔记中带 `InfoHub精选` 标签的新增笔记会在每日任务中去重、整理并同步到公开精选；其他私人笔记不会进入处理或发布
- 支持用户主动开启每日更新通知；通知订阅由 Cloudflare Worker 保存，私人阅读数据仍只在当前设备

当前 YouTube 频道：

- `@melrobbins`
- `@PredictiveHistory`
- `@flipradio_fearnation`
- `@lidangzzz`

## 技术结构

- vinext / Next.js / React
- GitHub Pages 发布公开网站
- GitHub Actions 每日采集、加工并更新公开内容文件
- 浏览器本地存储保存私人阅读数据，不使用云数据库和用户登录
- Get笔记与 Supadata 获取 YouTube 文字稿
- `baoyu-youtube-transcript` 作为 YouTube 备用路径
- Moonshot Kimi（当前模型 `kimi-k3`）完成中文整理和内容生成

## 本地运行

要求 Node.js `>=22.13.0`。

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` 只用于本地且不得提交到 GitHub：

- `MOONSHOT_API_KEY`：Moonshot/Kimi 内容加工
- `SUPADATA_API_KEY`：YouTube 文字稿与视频信息
- `GETNOTE_API_KEY`：Get笔记链接处理和笔记读取
- `GETNOTE_CLIENT_ID`：Get笔记应用 Client ID
- API Key 仅供本地采集和 GitHub Actions 使用，不会进入公开网页

常用命令：

```bash
npm run dev
npm run build
npm test
npm run collect:dry
npm run collect
npm run getnote:sync
```

## 自动采集

采集器读取 `config/sources.json`，只处理最近两个自然日的真实内容，并按来源独立执行；单个来源失败不会阻塞其他来源。

YouTube 目标处理链路：

```text
YouTube RSS 发现新视频
→ 管理员选择处理
→ Get笔记或 Supadata 获取带时间戳文字稿
→ 失败时回退 baoyu-youtube-transcript
→ Kimi 分段处理完整文字稿
→ 合并为 Takeaways + 阅读友好文章
→ 更新仓库中的公开 JSON 内容文件
```

正式自动运行所需密钥配置在 GitHub Actions Secrets；本地密钥继续保存在 `.env.local`，不能写进源代码、前端或公开仓库。管理员电脑可以关机，GitHub Actions 仍会自动运行。

## 第一版部署边界

- 公共网页和每日任务使用 GitHub Pages、GitHub Actions；管理员电脑可以关机
- Cloudflare Worker 只负责管理员安全提交入口和 Web Push，不保存笔记、划线或阅读进度
- 普通用户无需登录；私人数据不跨手机和电脑同步
- 管理员精选链接可在手机端程序内提交；处理任务仍由 GitHub Actions 执行，不要求管理员电脑开机

## 产品交互约定

- “每日”默认打开最新一期，并提供最近 7 天及历史日期选择
- 首页不显示“昨日采集”标签
- 收藏入口命名为“感兴趣”，不显示未读数量角标，也不提供“不感兴趣”反馈
- 打开详情始终从文章开头开始，返回时恢复首页原位置
- 文末提供“完成并读下一篇”
- 高亮只作用于用户实际选择的文字
- GitHub 项目详情除 Stars 数量外，还要提供同榜单热度语境和仓库直达链接

## 当前执行目标

按照 `docs/06-Agent执行任务书.md` 完成轻量工作流、管理后台、内容可读性和私人阅读改造，并使用 `docs/07-验收清单.md` 验收。Get笔记 YouTube 已真实验证成功；小宇宙仍需真实链接完成端到端验证。
