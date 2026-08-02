"use client";

import {
  Bookmark,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  FileText,
  Headphones,
  Eye,
  EyeOff,
  ExternalLink,
  Download,
  Link2,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  PenLine,
  Play,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Upload,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChatGPTUser } from "./chatgpt-auth";
import generatedFeed from "./generated-feed.json";
import generatedSectionSummaries from "./generated-section-summaries.json";

type Source = "youtube" | "podcast" | "daily" | "builder";
type Tab = "daily" | "reading" | "notes" | "me";
type ReadingView = "curated" | "interested";
type SearchScope = "all" | "content" | "note";
type SectionId = "x" | "papers" | "github" | "youtube" | "podcasts" | "reading";
type HomeSectionId = "x" | "papers" | "github" | "media";

type Item = {
  id: string;
  source: Source;
  sourceLabel: string;
  title: string;
  summary: string;
  time: string;
  readTime: string;
  accent: string;
  tags: string[];
  digestDate: string;
  publishedDate: string;
  sourceUrl: string;
  paragraphs: string[];
  externalLinks?: { label: string; url: string }[];
  facts?: { label: string; value: string }[];
  takeaways?: string[];
  utility?: string;
  sections?: { title: string; timeRange: string; paragraphs: string[] }[];
  digestFormat?: "builders-digest";
  section?: SectionId;
  inRecentWindow?: boolean;
};

type HighlightRange = {
  id?: string;
  start: number;
  end: number;
  text: string;
  note?: string;
  updatedAt?: string;
};

type HighlightStore = Record<string, Record<string, HighlightRange[]>>;

type ReadingProgress = {
  percent: number;
  anchorKey?: string;
  anchorOffset?: number;
  updatedAt: string;
};

type ReadingProgressStore = Record<string, ReadingProgress>;

type SectionSummary = {
  section: SectionId;
  label?: string;
  overview: string;
  trends: string[];
  value: string;
  technicalLevel: string;
  technicalPercentage: number;
};

type SearchResult = {
  id: string;
  kind: "content" | "note";
  title: string;
  excerpt: string;
  origin: string;
  item?: Item;
  paragraphKey?: string;
  highlight?: HighlightRange;
};

const coreItems: Item[] = [
  {
    id: "mel-hormones",
    source: "youtube",
    sourceLabel: "Mel Robbins",
    title: "女性激素健康指南：从生育选择到更年期",
    summary:
      "妇产科医生 Sharon Malone 按人生阶段梳理避孕、生育力、PCOS、围绝经期与激素治疗中的关键判断。",
    time: "今天采集",
    readTime: "9 分钟",
    accent: "violet",
    tags: ["女性健康", "激素", "更年期"],
    digestDate: "2026-07-29",
    publishedDate: "7月23日发布",
    sourceUrl: "https://www.youtube.com/watch?v=9tKZ3w-Gku8",
    paragraphs: [
      "这期节目把女性从青春期、生育年龄到围绝经期和绝经后的变化看作一条连续的激素健康轨迹，而不是彼此割裂的问题。越早了解家族史、月经模式和症状变化，越容易在关键阶段做出适合自己的选择。",
      "关于避孕，嘉宾强调不要把“天然”等同于“更安全”。口服避孕药、宫内节育器、植入剂和屏障法各有适用范围与风险；可靠性、个人病史和能否持续正确使用，比社交媒体上的笼统结论更重要。",
      "PCOS、子宫内膜异位症和不孕都需要结合症状与专业检查判断。痤疮、多毛、月经不规律或长期疼痛值得就医，但单一症状不能代替诊断；不孕也可能来自男女双方因素。",
      "生育力会随年龄变化，母亲的绝经年龄等家族信息也能提供线索。如果有延后生育的计划，应尽早与医生讨论，而不是把所有希望寄托在某一种技术上。",
      "进入围绝经期后，潮热、睡眠和骨骼健康都值得认真对待。激素治疗并非人人适用，但也不应被一概排斥；最终方案需要结合症状、年龄、病史和医生评估。本文为节目整理，不替代医疗建议。",
    ],
  },
  {
    id: "history-emergency",
    source: "youtube",
    sourceLabel: "Predictive History",
    title: "世界杯、美国与伊朗：一场地缘政治直播讨论",
    summary:
      "围绕世界杯、阿根廷、美国对外行动与 AI 投资泡沫展开的长篇直播；内容包含大量作者个人推演。",
    time: "今天采集",
    readTime: "11 分钟",
    accent: "orange",
    tags: ["地缘政治", "世界杯", "美国"],
    digestDate: "2026-07-29",
    publishedDate: "7月20日发布",
    sourceUrl: "https://www.youtube.com/watch?v=A9Sr-4c-3Tg",
    paragraphs: [
      "这场直播从世界杯决赛切入，讨论体育赛事如何承载国家认同、媒体叙事和政治情绪。作者把阿根廷与西班牙的比赛放进更大的国际关系框架中，尝试解释赛事之外的象征意义。",
      "随后话题转向美国、伊朗和拉丁美洲。节目把军事行动、资源、金融网络与国内政治联系起来，提出了一系列关于未来政策走向的预测。",
      "节目还讨论了 AI 投资热潮，认为高昂的数据中心成本、行业集中度和政府支持可能改变产业结构，并推测市场调整会推动资本进一步集中。",
      "需要特别注意：其中不少论点是主持人的个人解释、预测或阴谋性推测，并非经过独立核验的事实。阅读时应把“节目中的主张”和“已经确认的事件”区分开。",
    ],
  },
  {
    id: "builders-2026-07-29",
    source: "builder",
    sourceLabel: "Follow Builders",
    title: "Builder 动态：AI 成本开始按“任务”衡量",
    summary:
      "从 Swyx、Aaron Levie 到 Amjad Masad，14 位 Builder 的 29 条更新集中讨论 AI 成本、工作扩张与 Agent 能力边界。",
    time: "今天采集",
    readTime: "6 分钟",
    accent: "green",
    tags: ["Builder", "AI 成本", "Agent"],
    digestDate: "2026-07-29",
    publishedDate: "7月28日更新",
    sourceUrl: "https://github.com/zarazhangrui/follow-builders",
    paragraphs: [
      "Follow Builders 本次中央内容源返回 14 位 Builder、29 条动态和 1 期播客。这里先保留信息密度最高的观点，并把每一条对应的原始链接附在文末。",
      "Swyx 认为，用每百万输入或输出 token 的价格衡量 AI 成本已经不够有意义，更值得观察的是完成一个真实任务需要多少钱。这会把模型评估从“单价”推向成功率、工具调用和完整工作流成本。",
      "Box CEO Aaron Levie 观察到，企业使用 AI 后并不只是削减成本，也会招聘工程师、销售和内部 AI 部署人才去解决过去无力处理的问题。他的判断是：只把 AI 当作降本工具的公司，可能输给用 AI 扩大服务能力的公司。",
      "Replit CEO Amjad Masad 把下一阶段描述为对“计算宇宙”的探索：Agent 可以在算法、程序、证明和设计空间中搜索。这个视角把 AI 编程从代码补全推进到更广泛的自动发现。",
    ],
    externalLinks: [
      { label: "Swyx：从 token 单价转向每任务成本", url: "https://x.com/swyx/status/2081904230768816487" },
      { label: "Aaron Levie：AI 与企业招聘", url: "https://x.com/levie/status/2081930301752942703" },
      { label: "Amjad Masad：探索计算宇宙", url: "https://x.com/amasad/status/2082000490066592127" },
    ],
  },
  {
    id: "tech-2026-07-29",
    source: "daily",
    sourceLabel: "技术动态",
    title: "Agentic AI 进入科学计算，开源 AI 工具持续升温",
    summary:
      "今日技术源汇总了 OpenAI 的科学计算实践，以及 GitHub Trending 上值得关注的多模型、Agent 和生成式项目。",
    time: "今天采集",
    readTime: "5 分钟",
    accent: "blue",
    tags: ["科学计算", "GitHub Trending", "开发工具"],
    digestDate: "2026-07-29",
    publishedDate: "7月29日更新",
    sourceUrl: "https://github.com/yan203008/dailynews_0603",
    paragraphs: [
      "技术动态任务本次从公开源抓取到 13 个 GitHub Trending 项目，并同步检查 OpenAI、DeepMind、Hugging Face、TLDR AI、Smol AI News、Latent Space 等 AI 新闻源。",
      "OpenAI 最新文章讨论科学家如何使用 AI 编程 Agent 改造科学计算软件，并以基因组学等场景说明 Agent 不只生成代码，也能参与旧系统现代化与研究工作流。",
      "GitHub Trending 中，aisuite 提供多个生成式 AI 服务的统一调用方式；ECC 聚焦 Claude Code、Codex、Cursor 等 Agent 工具的技能、记忆、安全和性能优化；Airi 则探索自托管实时语音与游戏互动角色。",
      "这里展示的是“技术动态”部分，不混入财经、行情和国际时政。后续每日任务会继续合并去重，再由 Kimi 生成中文摘要。",
    ],
    externalLinks: [
      { label: "OpenAI：Agentic AI 与科学计算", url: "https://openai.com/index/scientific-computing-agentic-ai" },
      { label: "GitHub Trending：aisuite", url: "https://github.com/andrewyng/aisuite" },
      { label: "GitHub Trending：ECC", url: "https://github.com/affaan-m/ECC" },
      { label: "GitHub Trending：Airi", url: "https://github.com/moeru-ai/airi" },
    ],
  },
  {
    id: "mel-toxic-people",
    source: "youtube",
    sourceLabel: "Mel Robbins",
    title: "识别操纵与有害关系：四类黑暗人格信号",
    summary:
      "法医心理学研究者 Leanne ten Brinke 解释冷漠、操纵和敌意如何组合，并给出更实际的边界策略。",
    time: "昨日采集",
    readTime: "8 分钟",
    accent: "violet",
    tags: ["心理学", "人际关系", "边界"],
    digestDate: "2026-07-28",
    publishedDate: "7月20日发布",
    sourceUrl: "https://www.youtube.com/watch?v=ybrv66DM9Dw",
    paragraphs: [
      "节目首先澄清，不应随意把别人诊断为“自恋者”或“反社会人格”。更有帮助的做法，是观察一个人是否长期、反复表现出冷漠、操纵和敌意，以及这些行为如何影响周围的人。",
      "嘉宾把常被讨论的黑暗人格分为心理病态、自恋、马基雅维利主义和施虐倾向。它们并不是非黑即白的标签，也可能彼此重叠；重点是持续出现的行为模式，而不是一次糟糕的互动。",
      "表面的魅力并不能排除伤害性。需要留意的是：一个人是否不断夺取功劳、散播冲突、利用他人、缺乏悔意，或只在有利于自己时表现友好。",
      "面对这类关系，节目建议减少无效争辩，保留清晰记录，缩小对方可以操纵的信息范围，并建立能真正执行的边界。安全和稳定比证明谁对谁错更重要。",
    ],
  },
  {
    id: "history-live-2",
    source: "youtube",
    sourceLabel: "Predictive History",
    title: "美国—伊朗局势、世界杯与 AI 泡沫推演",
    summary:
      "直播将体育、战争、选举与 AI 基础设施放在同一套权力分析框架里，并回答观众提问。",
    time: "昨日采集",
    readTime: "10 分钟",
    accent: "green",
    tags: ["国际关系", "AI 泡沫", "政治评论"],
    digestDate: "2026-07-28",
    publishedDate: "7月18日发布",
    sourceUrl: "https://www.youtube.com/watch?v=E7QKiRnw0M8",
    paragraphs: [
      "直播把世界杯视为一种国家叙事与大众注意力的载体，并由此延伸到阿根廷、西班牙、以色列和美国之间的关系。作者试图用资本与政治联盟解释赛事周边的舆论。",
      "在美国政治部分，节目讨论选举管理、移民、联邦与州权力的冲突，以及这些议题可能如何影响中期选举。这些内容夹杂事实陈述与主持人的预测，需要分别核对。",
      "谈到 AI，作者认为当前商业模式与数据中心投入之间存在张力，并推测未来可能通过市场调整、行业整合或政府介入来消化成本。",
      "这是一档立场鲜明的评论节目，不是新闻事实简报。摘要保留了主要论证路径，但节目中的因果判断和未来预测应被视为观点，而不是已证实结论。",
    ],
  },
  {
    id: "builders-2026-07-28",
    source: "builder",
    sourceLabel: "Follow Builders",
    title: "Builder 动态：手机上的 Codex 完成了一轮视频交付",
    summary:
      "Peter Yang 分享远程视频工作流，Guillermo Rauch 讨论 Agent 隔离，产品团队则重新思考评审和协作方式。",
    time: "昨日采集",
    readTime: "6 分钟",
    accent: "green",
    tags: ["Codex", "Agent 安全", "产品工作流"],
    digestDate: "2026-07-28",
    publishedDate: "7月27—28日更新",
    sourceUrl: "https://github.com/zarazhangrui/follow-builders",
    paragraphs: [
      "Peter Yang 转述了一次完整的远程工作流：开发者在骑车时通过手机让 Codex 操作电脑编辑发布视频，随后定时查看 Slack 反馈并连续导出新版本，回到家时视频已经通过审核。重点不在单次代码生成，而在跨工具、持续检查和迭代交付。",
      "Vercel CEO Guillermo Rauch 提醒，Agent 的运行边界需要比普通容器更强。他引用实验说明，Agent 可能触发底层系统故障，因此微虚拟机等更强隔离方式会成为生产环境的重要基础设施。",
      "Meta AI 产品负责人 Madhu Guru 认为，好的产品评审应该在一小时内压缩数月学习，并模拟市场对创意的反应；如果会议只剩状态更新和领导曝光，就会变成团队负担。",
      "这些动态共同指向一个趋势：Agent 逐渐进入真实交付流程后，团队不仅要关注模型能力，还要重新设计安全边界、反馈循环和人的协作方式。",
    ],
    externalLinks: [
      { label: "Peter Yang：Codex 远程视频工作流", url: "https://x.com/petergyang/status/2081775399097549083" },
      { label: "Guillermo Rauch：Agent 的安全隔离", url: "https://x.com/rauchg/status/2081842439304995169" },
      { label: "Madhu Guru：产品评审应该压缩学习", url: "https://x.com/realmadhuguru/status/2081781952437486052" },
    ],
  },
  {
    id: "tech-2026-07-28",
    source: "daily",
    sourceLabel: "技术动态",
    title: "AI 正在扩展工作边界，而不只是加速原有任务",
    summary:
      "OpenAI 的最新研究关注人们如何借助 AI 承担跨角色任务；技术源同时追踪多模型接口与 Agent 工程工具。",
    time: "昨日采集",
    readTime: "5 分钟",
    accent: "blue",
    tags: ["AI 工作", "多模型", "Agent 工程"],
    digestDate: "2026-07-28",
    publishedDate: "7月27日更新",
    sourceUrl: "https://github.com/yan203008/dailynews_0603",
    paragraphs: [
      "OpenAI 发布的研究把关注点放在“人借助 AI 做了哪些以前不做的事”，而不只是同一任务节省了多少时间。文章认为，使用者正在跨越原本的岗位边界，承担更广泛的分析、写作和技术任务。",
      "这一观察与近期开发工具的变化相呼应：统一多模型接口、Agent 运行框架和记忆/安全组件越来越多，团队可以更低成本地把模型接入完整工作流。",
      "技术动态会保留原始来源、标题和发布时间，然后只提取技术板块。相同事件来自多个来源时会合并，避免首页被重复新闻占满。",
    ],
    externalLinks: [
      { label: "OpenAI：AI 如何扩展人们的工作内容", url: "https://openai.com/index/how-ai-is-expanding-what-people-do-at-work" },
      { label: "GitHub Trending：aisuite", url: "https://github.com/andrewyng/aisuite" },
      { label: "GitHub Trending：ECC", url: "https://github.com/affaan-m/ECC" },
    ],
  },
];

function feedItem(input: {
  id: string;
  section: SectionId;
  source: Source;
  sourceLabel: string;
  title: string;
  summary: string;
  digestDate: string;
  publishedDate: string;
  sourceUrl: string;
  accent: string;
  tags: string[];
  detail?: string;
  paragraphs?: string[];
  externalLinks?: { label: string; url: string }[];
  facts?: { label: string; value: string }[];
  takeaways?: string[];
  utility?: string;
  sections?: { title: string; timeRange: string; paragraphs: string[] }[];
  inRecentWindow?: boolean;
}): Item {
  return {
    ...input,
    time: input.digestDate === "2026-07-29" ? "今天采集" : "昨日采集",
    readTime: "3 分钟",
    paragraphs: input.paragraphs ?? [
      input.summary,
      input.detail ?? "该条目来自公开信息源，InfoHub 保留原始链接，并按每日采集时间归档。",
    ],
  };
}

const feedItems: Item[] = [
  feedItem({
    id: "x-swyx-cost-per-task",
    section: "x",
    source: "builder",
    sourceLabel: "Swyx · Follow Builders",
    title: "衡量 AI 成本，应该从 token 单价转向每任务成本",
    summary: "Swyx 认为单纯比较输入、输出 token 价格已经不够，真实任务的完成成本更能反映模型与 Agent 的价值。",
    digestDate: "2026-07-29",
    publishedDate: "7月28日发布",
    sourceUrl: "https://x.com/swyx/status/2081904230768816487",
    accent: "green",
    tags: ["X", "AI 成本", "Agent"],
    paragraphs: [
      "中文介绍：Swyx 提出，衡量 AI 服务价格时，只比较每百万 token 的输入和输出单价已经越来越失真。Agent 为了完成一个任务，可能需要多轮推理、搜索、工具调用和返工，因此真正值得比较的是“成功完成一个任务一共花了多少钱”。",
      "这意味着一个 token 单价更高、但一次就能把事情做对的模型，实际使用成本可能反而更低。对产品团队而言，模型评估也应该从价格表转向完整任务的成功率、耗时和总成本。",
    ],
  }),
  feedItem({
    id: "x-aaron-ai-work",
    section: "x",
    source: "builder",
    sourceLabel: "Aaron Levie · Follow Builders",
    title: "AI 带来的不只是裁员，也可能是工作范围扩张",
    summary: "Aaron Levie 观察到企业正招聘工程、销售和内部 AI 部署人才，用 AI 去解决过去没有能力处理的问题。",
    digestDate: "2026-07-29",
    publishedDate: "7月28日发布",
    sourceUrl: "https://x.com/levie/status/2081930301752942703",
    accent: "green",
    tags: ["X", "未来工作", "企业 AI"],
    paragraphs: [
      "中文介绍：Aaron Levie 认为，AI 对工作的影响不应只被理解为“用更少的人完成原来的事情”。一些企业正在招聘工程师、销售人员和内部 AI 部署人才，把 AI 用于过去因为成本太高或能力不足而没有处理的问题。",
      "他的核心判断是，AI 可能让公司的服务范围扩张：同样的组织可以服务更多客户、处理更多长尾需求，并创造原本不存在的工作。只把 AI 当成削减成本工具的公司，可能会输给那些用 AI 扩大业务边界的公司。",
    ],
  }),
  feedItem({
    id: "x-random-walker-labor",
    section: "x",
    source: "daily",
    sourceLabel: "Arvind Narayanan · 技术动态 X 热榜",
    title: "一个关于 AI 与劳动关系的思想实验",
    summary: "Arvind Narayanan 从“如果互联网从未公开源代码”出发，讨论训练数据、技能扩散与 AI 劳动叙事之间的关系。",
    digestDate: "2026-07-29",
    publishedDate: "7月29日发布",
    sourceUrl: "https://x.com/random_walker/status/2082163285588107752",
    accent: "blue",
    tags: ["X 热榜", "AI 劳动", "观点"],
    paragraphs: [
      "中文介绍：Arvind Narayanan 通过一个思想实验讨论 AI、知识共享与劳动之间的关系：如果互联网和软件行业从未形成开放代码、公开教程与共享知识的传统，今天关于 AI 训练数据和技能来源的讨论会不会完全不同？",
      "这条推文提醒读者，AI 并不是凭空产生能力，它建立在长期积累的人类知识、公开资料与集体协作之上。因此，讨论 AI 对劳动者的回报、训练数据的许可和技术收益如何分配时，不能只把它看成一个单纯的模型性能问题。",
    ],
  }),
  feedItem({
    id: "paper-redesign",
    section: "papers",
    source: "daily",
    sourceLabel: "Hugging Face Daily Papers",
    title: "ReDesign：把平面图片恢复成可编辑设计结构",
    summary: "ReDesign 用 Agent 分解图片中的文字、矢量、颜色、分组与图层，并通过逐步验证减少长流程中的错误累积。",
    digestDate: "2026-07-29",
    publishedDate: "7月28日收录",
    sourceUrl: "https://huggingface.co/papers/2607.25565",
    accent: "violet",
    tags: ["热门论文", "Agent", "设计"],
    paragraphs: [
      "中文摘要：把一张普通的平面图片恢复成可编辑设计文件，是现代设计流程中常见且昂贵的瓶颈。真正的“可编辑”不仅要求画面看起来相似，还需要恢复字体、矢量形状、颜色、元素分组和图层顺序等多种属性。ReDesign 使用一个 Agent 框架，按步骤选择并组合不同工具，逐层构建可编辑的图层结构。",
      "为了避免长流程中一个小错误不断累积，系统会在每次扩展图层时进行局部验证，决定接受、删减或重试。研究团队还建立了 Figma Edit Replay Benchmark，包含 909 个原始 Figma 文件和 14,796 条受控编辑指令，用真实编辑操作检验重建结果是否好用。实验显示，ReDesign 在保持视觉相似度的同时，在布局、颜色和文字编辑方面获得了更好的可编辑性。",
    ],
    utility: "如果这类技术成熟，普通人以后可能不必拿到原始设计文件，也能把海报、截图或旧宣传图恢复成可修改的素材。它会降低重新排版、改文案、换颜色和复用旧设计的门槛，但并不意味着可以忽略图片版权或原设计者的权益。",
    externalLinks: [
      { label: "查看 Hugging Face 论文页", url: "https://huggingface.co/papers/2607.25565" },
      { label: "打开 arXiv 原文", url: "https://arxiv.org/abs/2607.25565" },
    ],
  }),
  feedItem({
    id: "paper-hifi-umi",
    section: "papers",
    source: "daily",
    sourceLabel: "Hugging Face Daily Papers",
    title: "HiFi-UMI：不依赖真实机器人后训练的操作策略",
    summary: "研究通过高精度、可规模化的人类操作数据，让策略无需真实机器人后训练也能直接部署，并公开大规模数据集。",
    digestDate: "2026-07-29",
    publishedDate: "7月28日收录",
    sourceUrl: "https://huggingface.co/papers/2607.25895",
    accent: "violet",
    tags: ["热门论文", "机器人", "多模态"],
    paragraphs: [
      "中文摘要：训练能直接部署到真实机器人的操作策略，长期受制于高质量数据不足。真实机器人遥操作的数据准确，但成本高、很难扩大规模；不使用机器人的 UMI 数据更容易收集，却通常只能用于预训练，最后仍要加入少量真实机器人数据做后训练。HiFi-UMI 的问题是：如果把无机器人数据本身做得足够精确，能不能完全去掉最后这一步？",
      "研究团队设计了一套便携的数据生产系统，同时提高轨迹精度、双手夹爪相对位置、同步精度和视野范围，在不使用外部跟踪设施的情况下，把末端执行器误差控制在约 3 毫米。只使用这些演示数据后训练的策略，可以直接部署到真实机器人，并在多个模型架构上接近真实遥操作数据的表现；最强策略在精密插入任务上达到 85% 成功率。团队还开源了 2,000 小时的高精度演示数据。",
    ],
    utility: "这篇论文离普通人的日常使用还有距离，但它可能降低机器人学习新家务和操作技能的成本。未来机器人公司不必为了每项技能反复占用真实机器采集数据，更可能通过人类示范快速扩充能力，从而影响家用机器人、仓储和制造自动化的普及速度。",
    externalLinks: [
      { label: "查看 Hugging Face 论文页", url: "https://huggingface.co/papers/2607.25895" },
      { label: "打开 arXiv 原文", url: "https://arxiv.org/abs/2607.25895" },
    ],
  }),
  feedItem({
    id: "paper-inmind",
    section: "papers",
    source: "daily",
    sourceLabel: "Hugging Face Daily Papers",
    title: "InMind：Agent 记忆检索的隐式关联盲区",
    summary: "论文发现，记忆内容与用户问题没有表面相似词时，多类记忆系统很难召回真正需要的信息。",
    digestDate: "2026-07-29",
    publishedDate: "7月27日收录",
    sourceUrl: "https://huggingface.co/papers/2607.24368",
    accent: "violet",
    tags: ["热门论文", "Agent Memory", "检索"],
    inRecentWindow: false,
  }),
  feedItem({
    id: "github-airi",
    section: "github",
    source: "daily",
    sourceLabel: "GitHub Trending",
    title: "moeru-ai/airi：自托管实时语音与游戏互动角色",
    summary: "一个由用户自己托管的 AI 角色项目，支持实时语音、桌面端以及 Minecraft、Factorio 等互动场景。",
    digestDate: "2026-07-29",
    publishedDate: "今日热榜",
    sourceUrl: "https://github.com/moeru-ai/airi",
    accent: "blue",
    tags: ["GitHub", "开源", "语音 Agent"],
    facts: [
      { label: "主要语言", value: "TypeScript" },
      { label: "Stars", value: "45k" },
      { label: "许可证", value: "MIT" },
      { label: "最近更新", value: "7月29日" },
    ],
    paragraphs: [
      "AIRI 是一个可自行托管、由用户掌控数据的虚拟角色项目，目标是把实时对话、角色形象、记忆与环境互动组合成持续存在的 AI 伙伴。它支持实时语音交流，并提供网页、macOS 和 Windows 版本。",
      "项目不仅是一个聊天界面。它围绕 Live2D、VRM、语音识别与合成、记忆系统和插件能力构建角色容器，还可以连接 Minecraft、Factorio 等游戏场景。浏览器版本大量使用 WebGPU、WebAudio、WebAssembly 和 WebSocket；桌面版本则可以利用 CUDA 或 Apple Metal。",
      "适合关注 AI 角色、实时语音 Agent、自托管个人助手和虚拟主播技术的人。项目仍处于快速开发期，安装或接入外部能力前应查看最新文档、系统要求和安全说明。",
    ],
    externalLinks: [
      { label: "阅读项目 README", url: "https://github.com/moeru-ai/airi#readme" },
      { label: "查看使用文档", url: "https://airi.moeru.ai/docs/" },
      { label: "查看 Releases", url: "https://github.com/moeru-ai/airi/releases" },
    ],
  }),
  feedItem({
    id: "github-aisuite",
    section: "github",
    source: "daily",
    sourceLabel: "GitHub Trending",
    title: "andrewyng/aisuite：统一调用多个生成式 AI 服务",
    summary: "用一套简洁接口连接不同模型服务，减少应用在多供应商之间切换时的适配成本。",
    digestDate: "2026-07-29",
    publishedDate: "今日热榜",
    sourceUrl: "https://github.com/andrewyng/aisuite",
    accent: "blue",
    tags: ["GitHub", "多模型", "开发工具"],
    facts: [
      { label: "主要语言", value: "Python" },
      { label: "Stars", value: "15.8k" },
      { label: "许可证", value: "MIT" },
      { label: "定位", value: "多模型 SDK" },
    ],
    paragraphs: [
      "aisuite 是一个轻量级 Python 库，用统一接口调用不同生成式 AI 服务。最基础的一层是兼容 OpenAI 风格的 Chat Completions API，应用只需要更换 provider:model 字符串，就能在 OpenAI、Anthropic、Google、Mistral、Hugging Face、AWS、Ollama 等服务之间切换。",
      "在统一聊天接口之上，项目还提供 Agents API、工具调用、工具包和 MCP 接入。开发者可以把普通 Python 函数交给模型使用，设置多轮工具执行，并通过策略控制哪些工具允许运行。文件、Git 和 Shell 等常见能力也被包装成可复用工具包。",
      "它适合需要比较多个模型、降低供应商绑定，或用同一套业务代码连接云端模型和本地模型的团队。实际使用仍需分别准备对应服务商的 API Key，并检查不同模型在参数、工具调用和流式输出上的差异。",
    ],
    externalLinks: [
      { label: "阅读项目 README", url: "https://github.com/andrewyng/aisuite#readme" },
      { label: "查看 Chat Completions 快速开始", url: "https://github.com/andrewyng/aisuite/blob/main/docs/chat-completions-quickstart.md" },
      { label: "查看 Agents 快速开始", url: "https://github.com/andrewyng/aisuite/blob/main/docs/agents-quickstart.md" },
      { label: "打开 PyPI", url: "https://pypi.org/project/aisuite/" },
    ],
  }),
  feedItem({
    id: "github-ecc",
    section: "github",
    source: "daily",
    sourceLabel: "GitHub Trending",
    title: "affaan-m/ECC：Agent Harness 性能优化系统",
    summary: "围绕 Claude Code、Codex、Cursor 等工具组织技能、记忆、安全和研究优先的开发流程。",
    digestDate: "2026-07-29",
    publishedDate: "今日热榜",
    sourceUrl: "https://github.com/affaan-m/ECC",
    accent: "blue",
    tags: ["GitHub", "Agent Harness", "Codex"],
    facts: [
      { label: "主要语言", value: "JavaScript" },
      { label: "Stars", value: "235k" },
      { label: "许可证", value: "MIT" },
      { label: "最近更新", value: "7月29日" },
    ],
    paragraphs: [
      "ECC 是一套面向编码 Agent 的工作流与配置集合，覆盖技能、命令、规则、记忆、安全检查和研究优先的开发方式。它的目标不是替代 Claude Code、Codex、Cursor 等工具，而是在这些工具之上提供可复用的工程方法。",
      "仓库同时支持多种 Agent Harness，但每个 Harness 应只选择一种安装方式，避免技能、命令或 hooks 被重复加载。对 Codex 用户，项目提供同步流程和原生格式技能；对 Claude Code 用户，则提供插件与按需规则包。",
      "项目强调把团队知识写进规则、技能和自动化检查，并提供规划、测试驱动开发、代码审查、构建修复、会话保存与恢复等工作流。由于 hooks、MCP 和项目指令都可能执行代码或接触凭据，使用前需要阅读安全说明，只安装真正需要的模块。",
    ],
    externalLinks: [
      { label: "阅读项目 README", url: "https://github.com/affaan-m/ECC#readme" },
      { label: "打开官方网站", url: "https://ecc.tools" },
      { label: "查看安全说明", url: "https://github.com/affaan-m/ECC#security" },
    ],
  }),
  feedItem({
    id: "podcast-granola",
    section: "podcasts",
    source: "podcast",
    sourceLabel: "AI & I by Every",
    title: "Granola 创始人：第一波 AI 应用之后，工作界面会变成什么",
    summary: "Chris Pedregal 与 Dan Shipper 讨论会议记录之外的机会、AI 原生团队结构，以及如何把上下文转化为决策和行动。",
    digestDate: "2026-07-29",
    publishedDate: "7月15日发布",
    sourceUrl: "https://www.youtube.com/playlist?list=PLuMcoKK9mKgHtW_o9h5sGO2vXrffKHwJL",
    accent: "orange",
    tags: ["播客", "Granola", "AI 产品"],
    detail: "嘉宾认为会议笔记只是入口，更大的机会是理解跨会议上下文、识别决策和行动，并探索适合普通用户的 AI 原生工作界面。",
    inRecentWindow: false,
  }),
  feedItem({
    id: "x-peter-codex-video",
    section: "x",
    source: "builder",
    sourceLabel: "Peter Yang · Follow Builders",
    title: "手机上的 Codex 完成了一轮视频修改与交付",
    summary: "开发者在骑车时远程让 Codex 编辑视频，随后定时检查 Slack 反馈并连续导出新版本。",
    digestDate: "2026-07-28",
    publishedDate: "7月27日发布",
    sourceUrl: "https://x.com/petergyang/status/2081775399097549083",
    accent: "green",
    tags: ["X", "Codex", "自动化"],
    inRecentWindow: false,
  }),
  feedItem({
    id: "x-claude-security",
    section: "x",
    source: "daily",
    sourceLabel: "tatsuki · 技术动态 X 热榜",
    title: "Claude Code 安全设置：从真实告警日志重新排序优先级",
    summary: "作者复盘两个月、逾万行安全日志，讨论哪些检测规则真正触发，以及配置安全措施的实际顺序。",
    digestDate: "2026-07-28",
    publishedDate: "7月28日发布",
    sourceUrl: "https://x.com/nobel_824/status/2081962142056792475",
    accent: "blue",
    tags: ["X 热榜", "Claude Code", "安全"],
    paragraphs: [
      "中文介绍：作者复盘了两个月、超过一万行 Claude Code 安全告警日志，试图回答一个很实际的问题：网上推荐的许多安全设置，哪些真的在日常开发中触发，哪些只是看起来完整却很少发挥作用？",
      "这条内容的重点不是让所有人照抄同一套配置，而是建议用真实告警和使用方式重新排序安全措施。应该优先处理高频、后果严重的风险，并持续检查误报；否则过多规则会制造噪音，让真正重要的告警更容易被忽略。",
    ],
  }),
  feedItem({
    id: "paper-cve-attack",
    section: "papers",
    source: "daily",
    sourceLabel: "Hugging Face Daily Papers",
    title: "LLM 扩充漏洞标签，未必能改善攻击技术分类",
    summary: "研究在 CVE 到 MITRE ATT&CK 的映射任务上发现，专家标注质量比用 LLM 扩大数据规模更关键。",
    digestDate: "2026-07-28",
    publishedDate: "7月28日收录",
    sourceUrl: "https://huggingface.co/papers/2607.25572",
    accent: "violet",
    tags: ["热门论文", "安全", "数据质量"],
    paragraphs: [
      "中文摘要：研究要解决的是如何根据漏洞的文字描述，把 CVE 映射到 MITRE ATT&CK 的企业攻击技术。作者没有依赖容易产生扩展误差的间接映射链，而是使用 1,207 个由专家整理的 CVE 建立高质量数据集，并训练多标签分类器。这个模型相较零样本相似度基线显著提高了检索表现。",
      "研究随后测试能否用大语言模型生成更多标签来扩充数据。最初不同实验看起来结论矛盾，但进一步复现发现，表面的提升主要来自评估噪音。LLM 标签与专家标注的一致度约为 0.39，在不同扩充规模下都没有带来可靠改进，数据接近一千条时还降低了稀有攻击技术的覆盖。修正评估流程后，结果再次显示：增加专家标注能稳定提高效果，增加 LLM 标签则不能。",
    ],
    utility: "它给普通人的启示不只属于网络安全：用 AI 快速生成更多数据，不等于数据真的更好。当招聘、医疗、风控或内容审核系统声称用了“大量 AI 标注数据”时，更应该追问标注是否经过专家验证、评估方法是否稳定，以及少数和罕见情况有没有因此被忽略。",
    externalLinks: [
      { label: "查看 Hugging Face 论文页", url: "https://huggingface.co/papers/2607.25572" },
      { label: "打开 arXiv 原文", url: "https://arxiv.org/abs/2607.25572" },
    ],
  }),
  feedItem({
    id: "paper-mage-vl",
    section: "papers",
    source: "daily",
    sourceLabel: "Hugging Face Daily Papers",
    title: "Mage-VL：面向实时视频理解的流式多模态模型",
    summary: "模型利用视频编码中的运动信息选择性处理高变化区域，减少视觉 token，并提升流式推理效率。",
    digestDate: "2026-07-28",
    publishedDate: "7月27日收录",
    sourceUrl: "https://huggingface.co/papers/2607.24904",
    accent: "violet",
    tags: ["热门论文", "多模态", "视频"],
    inRecentWindow: false,
  }),
  feedItem({
    id: "github-editor",
    section: "github",
    source: "daily",
    sourceLabel: "GitHub Trending",
    title: "pascalorg/editor：创建并分享 3D 建筑项目",
    summary: "面向浏览器的 3D 建筑设计与分享工具，进入本次 GitHub Trending 榜单。",
    digestDate: "2026-07-28",
    publishedDate: "回跑热榜",
    sourceUrl: "https://github.com/pascalorg/editor",
    accent: "blue",
    tags: ["GitHub", "3D", "设计工具"],
    inRecentWindow: false,
  }),
  feedItem({
    id: "github-jenkins",
    section: "github",
    source: "daily",
    sourceLabel: "GitHub Trending",
    title: "jenkinsci/jenkins：经典自动化服务器重回热榜",
    summary: "Jenkins 自动化服务器出现在本次榜单，反映成熟基础设施项目仍持续获得关注。",
    digestDate: "2026-07-28",
    publishedDate: "回跑热榜",
    sourceUrl: "https://github.com/jenkinsci/jenkins",
    accent: "blue",
    tags: ["GitHub", "CI/CD", "自动化"],
    inRecentWindow: false,
  }),
];

const demoFallbackItems: Item[] = [
  ...coreItems.map((item) => ({ ...item, inRecentWindow: false })),
  ...feedItems,
];
const fallbackItems: Item[] = generatedFeed.length > 0
  ? generatedFeed as Item[]
  : demoFallbackItems;

const sectionDefinitions: { id: SectionId; label: string; description: string }[] = [
  { id: "x", label: "X 推特内容", description: "Follow Builders + 技术动态 X 热榜" },
  { id: "papers", label: "热门论文", description: "Hugging Face Daily Papers" },
  { id: "github", label: "GitHub Trending", description: "每日开源项目热榜" },
  { id: "youtube", label: "热门 YouTube", description: "已订阅频道最近两天的新视频" },
  { id: "podcasts", label: "播客", description: "AI Builder 访谈与节目" },
];

const homeSectionDefinitions: {
  id: HomeSectionId;
  label: string;
  description: string;
  sections: SectionId[];
}[] = [
  { id: "x", label: "X 推特内容", description: "Follow Builders + 技术动态 X", sections: ["x"] },
  { id: "papers", label: "热门论文", description: "近期 AI 研究与普通人价值", sections: ["papers"] },
  { id: "github", label: "GitHub Trending", description: "热门开源项目与产品趋势", sections: ["github"] },
  { id: "media", label: "频道更新", description: "订阅的 YouTube 与播客最新内容", sections: ["youtube", "podcasts"] },
];

type SectionPreference = { id: SectionId; visible: boolean };

const defaultSectionPreferences: SectionPreference[] = sectionDefinitions.map((section) => ({
  id: section.id,
  visible: true,
}));

const sourceIcon = {
  youtube: Video,
  podcast: Headphones,
  daily: FileText,
  builder: Sparkles,
};

function fallbackSectionDigest(section: SectionId, items: Item[]): SectionSummary {
  const keywords = [...new Set(items.flatMap((item) => item.tags))].slice(0, 5);
  const technicalPercentage = section === "papers" ? 65 : section === "github" ? 55 : 30;
  const representativeTitles = items.slice(0, 3).map((item) => `《${item.title}》`);
  const valueBySection: Partial<Record<SectionId, string>> = {
    x: "适合观察 AI 产品与工作方式的真实变化，尤其是一线 Builder 正在使用、质疑和修正什么。",
    papers: "适合判断哪些研究方向可能影响未来的 AI 成本、速度和产品能力，不需要先掌握论文中的全部公式。",
    github: "适合发现正在成形的 AI 产品能力与开源生态，产品、内容和业务从业者也能据此观察趋势。",
    youtube: "适合从长内容中了解完整观点、案例和对话语境，再决定是否进入精读。",
    podcasts: "适合从长对话中了解嘉宾的方法、案例与判断过程。",
  };
  return {
    section,
    overview: items.length > 0
      ? `今天共有 ${items.length} 条更新，主要围绕${keywords.slice(0, 3).join("、") || "AI 行业新动向"}展开。代表内容包括${representativeTitles.join("、")}。`
      : "本日暂无新的内容。",
    trends: items.slice(0, 2).map((item) => `${item.title}：${item.summary}`),
    value: items.length > 0
      ? valueBySection[section] ?? "适合快速了解这一类内容的主要进展与实际影响。"
      : "可以切换到其他日期查看已有内容。",
    technicalLevel: technicalPercentage >= 60 ? "中高" : technicalPercentage >= 40 ? "中等" : "较低",
    technicalPercentage,
  };
}

function sectionKeywords(items: Item[], limit = 6) {
  const ignored = new Set(["x", "twitter", "github", "开源", "ai builders", "人工智能"]);
  const counts = new Map<string, { label: string; count: number; order: number }>();
  let order = 0;
  for (const tag of items.flatMap((item) => item.tags || [])) {
    const label = String(tag).trim();
    const key = label.toLocaleLowerCase();
    if (!label || ignored.has(key)) continue;
    const current = counts.get(key);
    counts.set(key, current
      ? { ...current, count: current.count + 1 }
      : { label, count: 1, order: order++ });
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .slice(0, limit)
    .map((entry) => entry.label);
}

function normalizeChineseTypography(value: string) {
  if ((value.match(/[\u3400-\u9fff]/g) || []).length < 3) return value;
  return value
    .replace(/"([^"\n]+)"/g, "“$1”")
    .replace(/,(?=\s|[\u3400-\u9fff]|$)/g, "，")
    .replace(/;(?!\/)/g, "；")
    .replace(/:(?!\/\/)/g, "：")
    .replace(/\?/g, "？")
    .replace(/!/g, "！")
    .replace(/([\u3400-\u9fff])\.(?=\s|[\u3400-\u9fff]|$)/g, "$1。")
    .replace(/([，。！？；：])\s+/g, "$1");
}

function splitReadableParagraph(value: string, maximumLength = 240) {
  const text = value.trim();
  if (text.length <= maximumLength) return [text];
  const sentences = text.match(/[^。！？!?]+[。！？!?]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [text];
  const paragraphs: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > maximumLength) {
      paragraphs.push(current);
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs;
}

function normalizeMissingContextText(value: string) {
  return normalizeChineseTypography(value
    .replaceAll("链接指向的内容无法访问", "当前采集结果未包含链接页内容")
    .replaceAll("链接内容无法访问", "当前采集结果未包含链接页内容")
    .replaceAll("链接无法访问", "当前采集结果未包含链接页内容")
    .replaceAll("链接内容无法确认", "当前采集结果未包含链接页详情")
    .replaceAll("链接指向内容无法确认", "当前采集结果未包含链接页详情"));
}

function normalizeItemCopy(item: Item): Item {
  return {
    ...item,
    title: normalizeMissingContextText(item.title),
    summary: normalizeMissingContextText(item.summary),
    paragraphs: item.paragraphs.map(normalizeMissingContextText),
    utility: item.utility ? normalizeMissingContextText(item.utility) : item.utility,
    sections: item.sections?.map((section) => ({
      ...section,
      paragraphs: section.paragraphs.map(normalizeMissingContextText),
    })),
  };
}

function getAvailableDailyDates(items: Item[]) {
  return [...new Set(
    items
      .filter((item) => !isCuratedItem(item) && item.inRecentWindow !== false && item.digestDate >= "2026-07-29")
      .map((item) => item.digestDate)
      .filter(Boolean),
  )].sort().reverse();
}

function displayDay(value: string, compact = false) {
  const date = new Date(`${value}T12:00:00`);
  if (compact) {
    return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(date);
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

function isCuratedItem(item: Item) {
  return item.id.startsWith("manual-")
    || item.section === "reading"
    || item.sourceLabel.startsWith("管理员精选");
}

export function InfoHubApp({ user }: { user: ChatGPTUser | null }) {
  const initialDailyDates = useMemo(() => getAvailableDailyDates(fallbackItems), []);
  const [tab, setTab] = useState<Tab>("daily");
  const [readingView, setReadingView] = useState<ReadingView>("curated");
  const [selectedDate, setSelectedDate] = useState(initialDailyDates[0] ?? "2026-07-29");
  const [activeHomeSection, setActiveHomeSection] = useState<HomeSectionId | null>(null);
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState<SearchScope>("all");
  const [pendingSearchResultId, setPendingSearchResultId] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [liveItems, setLiveItems] = useState<Item[]>([]);
  const [liveSectionSummaries, setLiveSectionSummaries] = useState<SectionSummary[]>(
    generatedSectionSummaries as SectionSummary[],
  );
  const [readingProgress, setReadingProgress] = useState(0);
  const [readingProgressStore, setReadingProgressStore] = useState<ReadingProgressStore>({});
  const [highlights, setHighlights] = useState<HighlightStore>({});
  const [note, setNote] = useState("");
  const [highlightNote, setHighlightNote] = useState("");
  const [selectedHighlight, setSelectedHighlight] = useState<{ paragraphKey: string; highlightId: string } | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [sectionSettingsOpen, setSectionSettingsOpen] = useState(false);
  const [sectionPreferences, setSectionPreferences] = useState<SectionPreference[]>(
    defaultSectionPreferences,
  );
  const readerRef = useRef<HTMLElement>(null);
  const returnScrollYRef = useRef(0);
  const progressSaveTimerRef = useRef<number | null>(null);
  const suppressProgressRef = useRef(false);
  const pendingParagraphKeyRef = useRef<string | null>(null);
  const items = useMemo(() => {
    const merged = new Map(fallbackItems.map((item) => [item.id, item]));
    liveItems.forEach((item) => merged.set(item.id, item));
    return [...merged.values()].map(normalizeItemCopy).sort((a, b) =>
      String(b.publishedAt ?? b.digestDate).localeCompare(String(a.publishedAt ?? a.digestDate)),
    );
  }, [liveItems]);
  const availableDailyDates = useMemo(() => getAvailableDailyDates(items), [items]);
  const recentDates = availableDailyDates.slice(0, 7);
  const latestDailyDate = items
    .filter((item) => !isCuratedItem(item) && item.inRecentWindow !== false)
    .map((item) => item.digestDate)
    .filter(Boolean)
    .sort()
    .at(-1);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/feed")
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { items?: Item[]; sectionSummaries?: SectionSummary[] };
      })
      .then((data) => {
        if (!cancelled && Array.isArray(data?.items) && data.items.length > 0) {
          setLiveItems(data.items);
        }
        if (!cancelled && Array.isArray(data?.sectionSummaries) && data.sectionSummaries.length > 0) {
          setLiveSectionSummaries(data.sectionSummaries);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("infohub-demo-note");
    if (!stored) return;
    const timer = window.setTimeout(() => setNote(stored), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("infohub-highlights");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as HighlightStore;
      const timer = window.setTimeout(() => setHighlights(parsed), 0);
      return () => window.clearTimeout(timer);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("infohub-reading-progress");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as ReadingProgressStore;
      const timer = window.setTimeout(() => setReadingProgressStore(parsed), 0);
      return () => window.clearTimeout(timer);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    if (!activeItem) return;
    let frame = 0;
    const updateProgress = () => {
      if (suppressProgressRef.current) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (suppressProgressRef.current) return;
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const percent = scrollable > 0 ? Math.min(100, Math.max(0, Math.round((window.scrollY / scrollable) * 100))) : 100;
        setReadingProgress(percent);
        const paragraphs = Array.from(readerRef.current?.querySelectorAll<HTMLElement>("[data-highlight-key]") ?? []);
        const anchor = [...paragraphs].reverse().find((element) => element.getBoundingClientRect().top <= 110) ?? paragraphs[0];
        const progress: ReadingProgress = {
          percent,
          anchorKey: anchor?.dataset.highlightKey,
          anchorOffset: anchor ? Math.round(window.scrollY - (anchor.getBoundingClientRect().top + window.scrollY)) : undefined,
          updatedAt: new Date().toISOString(),
        };
        setReadingProgressStore((current) => ({ ...current, [activeItem.id]: progress }));
        if (progressSaveTimerRef.current) window.clearTimeout(progressSaveTimerRef.current);
        progressSaveTimerRef.current = window.setTimeout(() => {
          const stored = window.localStorage.getItem("infohub-reading-progress");
          let current: ReadingProgressStore = {};
          try { current = stored ? JSON.parse(stored) as ReadingProgressStore : {}; } catch { current = {}; }
          window.localStorage.setItem("infohub-reading-progress", JSON.stringify({ ...current, [activeItem.id]: progress }));
        }, 250);
      });
    };
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      window.cancelAnimationFrame(frame);
      if (progressSaveTimerRef.current) window.clearTimeout(progressSaveTimerRef.current);
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, [activeItem]);

  useLayoutEffect(() => {
    if (!activeItem) return;
    const pendingParagraphKey = pendingParagraphKeyRef.current;
    pendingParagraphKeyRef.current = null;
    const stored = window.localStorage.getItem("infohub-reading-progress");
    let progress: ReadingProgress | undefined;
    try { progress = stored ? (JSON.parse(stored) as ReadingProgressStore)[activeItem.id] : undefined; } catch { progress = undefined; }
    const restore = () => {
      if (pendingParagraphKey) {
        const paragraph = readerRef.current?.querySelector<HTMLElement>(`[data-highlight-key="${CSS.escape(pendingParagraphKey)}"]`);
        if (paragraph) {
          window.scrollTo(0, Math.max(0, paragraph.getBoundingClientRect().top + window.scrollY - 110));
          return;
        }
      }
      if (progress?.anchorKey) {
        const anchor = readerRef.current?.querySelector<HTMLElement>(`[data-highlight-key="${CSS.escape(progress.anchorKey)}"]`);
        if (anchor) {
          window.scrollTo(0, anchor.getBoundingClientRect().top + window.scrollY + (progress.anchorOffset ?? 0));
          setReadingProgress(progress.percent);
          return;
        }
      }
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, progress ? scrollable * progress.percent / 100 : 0);
      setReadingProgress(progress?.percent ?? 0);
    };
    restore();
    const frame = window.requestAnimationFrame(restore);
    return () => window.cancelAnimationFrame(frame);
  }, [activeItem]);

  useEffect(() => {
    const stored = window.localStorage.getItem("infohub-library-state");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { saved?: string[]; completed?: string[] };
      const timer = window.setTimeout(() => {
        setSaved(Array.isArray(parsed.saved) ? parsed.saved : []);
        setCompleted(Array.isArray(parsed.completed) ? parsed.completed : []);
      }, 0);
      return () => window.clearTimeout(timer);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void fetch("/api/preferences/sections")
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { preferences: SectionPreference[] | null };
      })
      .then((data) => {
        if (cancelled || !data?.preferences) return;
        setSectionPreferences(data.preferences);
        window.localStorage.setItem(
          "infohub-section-preferences",
          JSON.stringify(data.preferences),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void fetch("/api/library")
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { saved: string[]; completed: string[] };
      })
      .then((data) => {
        if (cancelled || !data) return;
        setSaved(data.saved);
        setCompleted(data.completed);
        window.localStorage.setItem("infohub-library-state", JSON.stringify(data));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("infohub-section-preferences");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as SectionPreference[];
      const validIds = new Set(sectionDefinitions.map((section) => section.id));
      if (parsed.length !== sectionDefinitions.length || parsed.some((item) => !validIds.has(item.id))) {
        return;
      }
      const timer = window.setTimeout(() => setSectionPreferences(parsed), 0);
      return () => window.clearTimeout(timer);
    } catch {
      return;
    }
  }, []);

  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.digestDate === selectedDate &&
          item.section &&
          !isCuratedItem(item) &&
          item.inRecentWindow !== false,
      ),
    [items, selectedDate],
  );
  const orderedSections = sectionPreferences
    .map((preference) => ({
      ...sectionDefinitions.find((section) => section.id === preference.id)!,
      visible: preference.visible,
    }));
  const visibleSections = orderedSections.filter((section) => section.visible);
  const visibleSectionIds = new Set(visibleSections.map((section) => section.id));
  const preferenceOrder = new Map(sectionPreferences.map((section, index) => [section.id, index]));
  const homeSections = homeSectionDefinitions
    .filter((group) => group.sections.some((section) => visibleSectionIds.has(section)))
    .sort((a, b) => {
      const aIndex = Math.min(...a.sections.map((section) => preferenceOrder.get(section) ?? 99));
      const bIndex = Math.min(...b.sections.map((section) => preferenceOrder.get(section) ?? 99));
      return aIndex - bIndex;
    });
  const displayedItems = visibleItems.filter(
    (item) => item.section && visibleSectionIds.has(item.section),
  );
  const activeHomeDefinition = homeSections.find((section) => section.id === activeHomeSection) ?? null;
  const activeSectionItems = activeHomeDefinition
    ? visibleItems.filter((item) => item.section && activeHomeDefinition.sections.includes(item.section))
    : [];
  const builderDigestItems = activeSectionItems.filter((item) => item.digestFormat === "builders-digest");
  const regularSectionItems = activeSectionItems.filter((item) => item.digestFormat !== "builders-digest");
  const queueItems = items.filter(
    (item) => saved.includes(item.id) && item.inRecentWindow !== false,
  );
  const curatedItems = items.filter(
    (item) => isCuratedItem(item) && item.inRecentWindow !== false,
  );
  const readingListItems = readingView === "curated" ? curatedItems : queueItems;
  const highlightNoteEntries = Object.entries(highlights).flatMap(([itemId, paragraphs]) => {
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item) return [];
    return Object.entries(paragraphs).flatMap(([paragraphKey, ranges]) =>
      ranges
        .filter((range) => Boolean(range.note?.trim()))
        .map((range) => ({
          item,
          paragraphKey,
          range,
          highlightId: range.id ?? `${range.start}-${range.end}`,
        })),
    );
  }).sort((a, b) => String(b.range.updatedAt ?? "").localeCompare(String(a.range.updatedAt ?? "")));
  const searchResults = useMemo<SearchResult[]>(() => {
    const query = searchQuery.trim().toLocaleLowerCase("zh-CN");
    if (!query) return [];
    const contentResults = items
      .filter((item) => [
        item.title,
        item.summary,
        item.sourceLabel,
        item.tags.join(" "),
        item.utility ?? "",
        item.paragraphs.join(" "),
        item.sections?.flatMap((section) => [section.title, ...section.paragraphs]).join(" ") ?? "",
      ].join(" ").toLocaleLowerCase("zh-CN").includes(query))
      .map<SearchResult>((item) => {
        const sectionLabel = sectionDefinitions.find((section) => section.id === item.section)?.label ?? item.sourceLabel;
        const origin = isCuratedItem(item)
          ? "精读 · 管理员精选"
          : `日报 · ${displayDay(item.digestDate, true)} · ${sectionLabel}${saved.includes(item.id) ? " · 已感兴趣" : ""}`;
        return {
          id: `content:${item.id}`,
          kind: "content",
          title: item.title,
          excerpt: item.summary,
          origin,
          item,
        };
      });
    const noteResults = highlightNoteEntries
      .filter(({ item, range }) => `${item.title} ${range.text} ${range.note ?? ""}`.toLocaleLowerCase("zh-CN").includes(query))
      .map<SearchResult>(({ item, paragraphKey, range, highlightId }) => ({
        id: `note:${item.id}:${paragraphKey}:${highlightId}`,
        kind: "note",
        title: item.title,
        excerpt: range.note?.trim() || range.text,
        origin: "笔记 · 划线笔记",
        item,
        paragraphKey,
        highlight: range,
      }));
    if (note.toLocaleLowerCase("zh-CN").includes(query)) {
      noteResults.unshift({
        id: "note:free",
        kind: "note",
        title: "自由笔记",
        excerpt: note,
        origin: "笔记 · 自由笔记",
      });
    }
    return [...noteResults, ...contentResults].slice(0, 80);
  }, [highlightNoteEntries, items, note, saved, searchQuery]);
  const visibleSearchResults = searchScope === "all"
    ? searchResults
    : searchResults.filter((result) => result.kind === searchScope);

  useEffect(() => {
    if (!pendingSearchResultId) return;
    const timer = window.setTimeout(() => {
      const result = searchResults.find((candidate) => candidate.id === pendingSearchResultId);
      setPendingSearchResultId(null);
      if (!result) return;
      setSearchOpen(false);
      setSearchQuery("");
      if (!result.item) {
        setTab("notes");
        window.scrollTo(0, 0);
        return;
      }
      if (result.kind === "note" && result.paragraphKey && result.highlight) {
        openSavedHighlight(result.item, result.paragraphKey, result.highlight);
        return;
      }
      openItem(result.item);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pendingSearchResultId, searchResults]);

  function setContentState(id: string, state: "saved" | "completed" | null) {
    const nextSaved = state === "saved"
      ? [...new Set([...saved, id])]
      : saved.filter((value) => value !== id);
    const nextCompleted = state === "completed"
      ? [...new Set([...completed, id])]
      : completed.filter((value) => value !== id);
    setSaved(nextSaved);
    setCompleted(nextCompleted);
    window.localStorage.setItem(
      "infohub-library-state",
      JSON.stringify({ saved: nextSaved, completed: nextCompleted }),
    );
    if (user) {
      void fetch("/api/library", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentId: id, state }),
      }).catch(() => undefined);
    }
  }

  function toggleSaved(id: string) {
    if (saved.includes(id)) {
      setContentState(id, null);
      setToast("已取消感兴趣");
    } else {
      setContentState(id, "saved");
      setToast("已标记为感兴趣，可在“感兴趣”中查看");
    }
  }

  function markCompleted(id: string) {
    setContentState(id, "completed");
    const progress = { percent: 100, updatedAt: new Date().toISOString() };
    const nextProgress = { ...readingProgressStore, [id]: progress };
    setReadingProgressStore(nextProgress);
    setReadingProgress(100);
    window.localStorage.setItem("infohub-reading-progress", JSON.stringify(nextProgress));
    setToast("已完成阅读");
  }

  function saveNote() {
    if (selectedHighlight && activeItem) {
      const articleHighlights = highlights[activeItem.id] ?? {};
      const ranges = articleHighlights[selectedHighlight.paragraphKey] ?? [];
      const next: HighlightStore = {
        ...highlights,
        [activeItem.id]: {
          ...articleHighlights,
          [selectedHighlight.paragraphKey]: ranges.map((range) =>
            (range.id ?? `${range.start}-${range.end}`) === selectedHighlight.highlightId
              ? { ...range, id: selectedHighlight.highlightId, note: highlightNote.trim(), updatedAt: new Date().toISOString() }
              : range,
          ),
        },
      };
      setHighlights(next);
      window.localStorage.setItem("infohub-highlights", JSON.stringify(next));
      setToast(highlightNote.trim() ? "划线笔记已保存" : "划线已保存");
      setNoteOpen(false);
      setSelectedHighlight(null);
      return;
    }
    window.localStorage.setItem("infohub-demo-note", note);
    setToast("笔记已保存");
    setNoteOpen(false);
  }

  function closeNoteSheet() {
    if (selectedHighlight || note.trim()) {
      saveNote();
      return;
    }
    setNoteOpen(false);
    setSelectedHighlight(null);
  }

  function openItem(item: Item) {
    returnScrollYRef.current = window.scrollY;
    suppressProgressRef.current = false;
    window.scrollTo(0, 0);
    setActiveItem(item);
  }

  function closeReader() {
    const returnTo = returnScrollYRef.current;
    suppressProgressRef.current = true;
    setActiveItem(null);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.scrollTo({ top: returnTo, behavior: "auto" }));
    });
  }

  function addSelectedHighlight() {
    if (!activeItem || !readerRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      setToast("请先长按或拖动，选中想划线的文字");
      return;
    }
    const range = selection.getRangeAt(0);
    const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer as Element
      : range.startContainer.parentElement;
    const endElement = range.endContainer.nodeType === Node.ELEMENT_NODE
      ? range.endContainer as Element
      : range.endContainer.parentElement;
    const startParagraph = startElement?.closest<HTMLElement>("[data-highlight-key]");
    const endParagraph = endElement?.closest<HTMLElement>("[data-highlight-key]");
    if (!startParagraph || startParagraph !== endParagraph || !readerRef.current.contains(startParagraph)) {
      setToast("一次请在同一段内选择文字");
      return;
    }
    const before = document.createRange();
    before.selectNodeContents(startParagraph);
    before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length;
    const text = selection.toString().trim();
    const end = start + selection.toString().length;
    const key = startParagraph.dataset.highlightKey;
    if (!key || !text) {
      setToast("请先选择想划线的文字");
      return;
    }
    const current = highlights[activeItem.id]?.[key] ?? [];
    if (current.some((item) => start < item.end && end > item.start)) {
      setToast("这段文字已有划线");
      selection.removeAllRanges();
      return;
    }
    const highlightId = crypto.randomUUID();
    const nextRanges = [...current, { id: highlightId, start, end, text, note: "", updatedAt: new Date().toISOString() }]
      .sort((a, b) => a.start - b.start);
    const next = {
      ...highlights,
      [activeItem.id]: {
        ...(highlights[activeItem.id] ?? {}),
        [key]: nextRanges,
      },
    };
    setHighlights(next);
    window.localStorage.setItem("infohub-highlights", JSON.stringify(next));
    selection.removeAllRanges();
    setSelectedHighlight({ paragraphKey: key, highlightId });
    setHighlightNote("");
    setNoteOpen(true);
  }

  function openHighlightNote(paragraphKey: string, range: HighlightRange) {
    const highlightId = range.id ?? `${range.start}-${range.end}`;
    setSelectedHighlight({ paragraphKey, highlightId });
    setHighlightNote(range.note ?? "");
    setNoteOpen(true);
  }

  function openSavedHighlight(item: Item, paragraphKey: string, range: HighlightRange) {
    returnScrollYRef.current = window.scrollY;
    suppressProgressRef.current = false;
    pendingParagraphKeyRef.current = paragraphKey;
    setSelectedHighlight({
      paragraphKey,
      highlightId: range.id ?? `${range.start}-${range.end}`,
    });
    setHighlightNote(range.note ?? "");
    setNoteOpen(true);
    setActiveItem(item);
  }

  function saveSectionPreferences(next: SectionPreference[]) {
    setSectionPreferences(next);
    window.localStorage.setItem("infohub-section-preferences", JSON.stringify(next));
    if (user) {
      void fetch("/api/preferences/sections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ preferences: next }),
      }).catch(() => undefined);
    }
  }

  function toggleSection(id: SectionId) {
    saveSectionPreferences(
      sectionPreferences.map((section) =>
        section.id === id ? { ...section, visible: !section.visible } : section,
      ),
    );
  }

  function moveSection(id: SectionId, direction: -1 | 1) {
    const index = sectionPreferences.findIndex((section) => section.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sectionPreferences.length) return;
    const next = [...sectionPreferences];
    [next[index], next[target]] = [next[target], next[index]];
    saveSectionPreferences(next);
  }

  if (activeItem) {
    const readerSequence = tab === "reading" ? readingListItems : displayedItems;
    const activeIndex = readerSequence.findIndex((item) => item.id === activeItem.id);
    const nextItem = activeIndex >= 0 ? readerSequence[activeIndex + 1] : undefined;
    const itemHighlights = highlights[activeItem.id] ?? {};
    const highlightedEntries = Object.entries(itemHighlights).flatMap(([paragraphKey, ranges]) =>
      ranges.map((range) => ({ paragraphKey, range })),
    );
    const readerLinks = [
      {
        label: activeItem.section === "github"
          ? "打开 GitHub 仓库"
          : activeItem.section === "youtube" || activeItem.section === "podcasts"
            ? "跳转收听"
            : "查看原始内容",
        url: activeItem.sourceUrl,
      },
      ...(activeItem.externalLinks ?? []).filter(
        (link) => link.url !== activeItem.sourceUrl,
      ),
    ];
    return (
      <main className="app-shell reader-shell">
        <header className="reader-topbar">
          <button
            className="icon-button"
            onClick={closeReader}
            aria-label="返回刚才浏览的位置"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="reading-progress-wrap" aria-label={`阅读进度 ${readingProgress}%`} title="当前文章阅读进度">
            <div className="reading-progress">
              <span style={{ width: `${readingProgress}%` }} />
            </div>
            <small>{readingProgress}%</small>
          </div>
          <button
            className={`icon-button ${saved.includes(activeItem.id) ? "is-active" : ""}`}
            onClick={() => toggleSaved(activeItem.id)}
            aria-label={saved.includes(activeItem.id) ? "取消感兴趣" : "标记为感兴趣"}
          >
            <Bookmark size={20} fill={saved.includes(activeItem.id) ? "currentColor" : "none"} />
          </button>
          <a
            className="icon-button"
            href={activeItem.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={activeItem.section === "youtube" || activeItem.section === "podcasts" ? "跳转收听" : "打开原始内容"}
            title={activeItem.section === "youtube" || activeItem.section === "podcasts" ? "跳转收听" : "打开原始内容"}
          >
            <ExternalLink size={20} />
          </a>
        </header>

        <article className="reader" ref={readerRef}>
          <div className="reader-source">
            <SourceBadge item={activeItem} compact />
            <span>{activeItem.sourceLabel}</span>
            <span>·</span>
            <span>{activeItem.publishedDate}</span>
            <span>·</span>
            <span>{activeItem.readTime}</span>
          </div>
          <h1>{activeItem.title}</h1>
          <p className="reader-deck">{activeItem.summary}</p>
          {activeItem.section !== "papers" && (
            <div className="tag-row">
              {activeItem.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          )}
          <div className="article-rule" />
          {activeItem.takeaways && activeItem.takeaways.length > 0 && (
            <section className="reader-takeaways">
              <h2>Takeaway</h2>
              <ol>
                {activeItem.takeaways.slice(0, 6).map((takeaway) => (
                  <li key={takeaway}>{takeaway}</li>
                ))}
              </ol>
            </section>
          )}
          <h2 className="reader-section-title">阅读原文</h2>
          {activeItem.facts && activeItem.facts.length > 0 && (
            <>
              <section className="project-facts" aria-label="项目数据">
                {activeItem.facts.map((fact) => (
                  <div key={fact.label}>
                    <span>{fact.label}</span>
                    <strong>{fact.value}</strong>
                  </div>
                ))}
              </section>
              {activeItem.section === "github" && <GitHubStarGuide facts={activeItem.facts} />}
            </>
          )}
          {activeItem.section === "papers" ? (
            <>
              <section className="paper-abstract">
                <span>ABSTRACT</span>
                <h2>中文摘要</h2>
                <div className="article-body">
                  {activeItem.paragraphs.map((paragraph, index) => (
                    <SelectableParagraph
                      key={paragraph}
                      highlightKey={`paragraph:${index}`}
                      text={paragraph.replace(/^中文摘要：/, "")}
                      ranges={itemHighlights[`paragraph:${index}`] ?? []}
                      onHighlightClick={(range) => openHighlightNote(`paragraph:${index}`, range)}
                    />
                  ))}
                </div>
              </section>
              <section className="paper-keywords">
                <span>KEYWORDS</span>
                <h2>关键词</h2>
                <div className="tag-row">
                  {activeItem.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
              </section>
              <section className="paper-utility">
                <span>WHY IT MATTERS</span>
                <h2>对非技术读者有什么用</h2>
                <p>{activeItem.utility}</p>
              </section>
            </>
          ) : activeItem.sections && activeItem.sections.length > 0 ? (
            <div className="article-body article-sections">
              {activeItem.sections.map((section, sectionIndex) => (
                <section key={`${section.title}-${section.timeRange}`}>
                  <h3>{section.title} <small>{section.timeRange}</small></h3>
                  {section.paragraphs.map((paragraph, paragraphIndex) => (
                    <SelectableParagraph
                      key={paragraph}
                      highlightKey={`section:${sectionIndex}:${paragraphIndex}`}
                      text={paragraph}
                      ranges={itemHighlights[`section:${sectionIndex}:${paragraphIndex}`] ?? []}
                      onHighlightClick={(range) => openHighlightNote(`section:${sectionIndex}:${paragraphIndex}`, range)}
                    />
                  ))}
                </section>
              ))}
            </div>
          ) : (
            <div className="article-body">
              {activeItem.paragraphs.map((paragraph, index) => (
                <SelectableParagraph
                  key={paragraph}
                  highlightKey={`paragraph:${index}`}
                  text={paragraph}
                  ranges={itemHighlights[`paragraph:${index}`] ?? []}
                  onHighlightClick={(range) => openHighlightNote(`paragraph:${index}`, range)}
                />
              ))}
            </div>
          )}
          {activeItem.section === "x" ? (
            <p className="direct-link">
              <strong>链接直达：</strong>
              <a href={activeItem.sourceUrl} target="_blank" rel="noreferrer">{activeItem.sourceUrl}</a>
            </p>
          ) : (
            <section className="source-links" aria-label="相关链接">
              <h2>相关链接</h2>
              {readerLinks.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                  <span>{link.label}</span>
                  <ChevronRight size={16} />
                </a>
              ))}
            </section>
          )}
          <div className="article-end">
            <span>END</span>
          </div>
          <button
            className="next-article"
            onClick={() => {
              markCompleted(activeItem.id);
              if (nextItem) {
                setActiveItem(nextItem);
              } else {
                closeReader();
              }
            }}
          >
            <span>{nextItem ? "完成并读下一篇" : "完成阅读并返回"}</span>
            <strong>{nextItem?.title ?? "回到刚才浏览的位置"}</strong>
            <ChevronRight size={19} />
          </button>
        </article>

        <div className="reader-actions">
          <button
            onMouseDown={(event) => event.preventDefault()}
            onClick={addSelectedHighlight}
          >
            <PenLine size={19} />
            <span>划线</span>
          </button>
          <button onClick={() => { setSelectedHighlight(null); setNoteOpen(true); }}>
            <BookOpen size={19} />
            <span>笔记</span>
            {(note || highlightedEntries.some(({ range }) => range.note?.trim())) && <i />}
          </button>
          <button
            className={saved.includes(activeItem.id) || completed.includes(activeItem.id) ? "is-active" : ""}
            onClick={() => {
              if (saved.includes(activeItem.id)) markCompleted(activeItem.id);
              else toggleSaved(activeItem.id);
            }}
          >
            {saved.includes(activeItem.id) ? <Check size={19} /> : <Bookmark size={18} />}
            <span>
              {saved.includes(activeItem.id)
                ? "完成"
                : completed.includes(activeItem.id)
                  ? "再次标记"
                  : "感兴趣"}
            </span>
          </button>
          <a href={activeItem.sourceUrl} target="_blank" rel="noreferrer">
            <Play size={18} />
            <span>{activeItem.section === "youtube" || activeItem.section === "podcasts" ? "跳转收听" : "原文"}</span>
          </a>
        </div>

        {noteOpen && (
          <div className="sheet-backdrop" onClick={closeNoteSheet}>
            <section
              className="note-sheet"
              onClick={(event) => event.stopPropagation()}
              aria-label="文章笔记"
            >
              <div className="sheet-handle" />
              <div className="sheet-title">
                <div>
                  <span>{selectedHighlight ? "划线笔记" : "我的笔记"}</span>
                  <small>仅保存在当前设备</small>
                </div>
                <button
                  className="icon-button"
                  onClick={closeNoteSheet}
                  aria-label="关闭笔记"
                >
                  <X size={20} />
                </button>
              </div>
              {selectedHighlight ? (
                <blockquote>
                  {Object.values(itemHighlights).flat().find((range) =>
                    (range.id ?? `${range.start}-${range.end}`) === selectedHighlight.highlightId,
                  )?.text}
                </blockquote>
              ) : (
                <div className="highlight-note-list">
                  {highlightedEntries.map(({ paragraphKey, range }) => (
                    <button
                      key={`${paragraphKey}:${range.id ?? `${range.start}-${range.end}`}`}
                      onClick={() => openHighlightNote(paragraphKey, range)}
                    >
                      <blockquote>{range.text}</blockquote>
                      <span>{range.note?.trim() || "还没有写笔记，点击添加"}</span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                  {highlightedEntries.length === 0 && (
                    <p className="note-empty-copy">还没有划线。先在正文中选中一段文字，再点击“划线”。</p>
                  )}
                </div>
              )}
              <textarea
                value={selectedHighlight ? highlightNote : note}
                onChange={(event) => selectedHighlight ? setHighlightNote(event.target.value) : setNote(event.target.value)}
                placeholder={selectedHighlight ? "为这段划线写笔记（可留空）……" : "写下你的想法……"}
                autoFocus
              />
              <button className="primary-button" onClick={saveNote}>
                <Check size={18} />
                {selectedHighlight ? "保存" : "保存笔记"}
              </button>
            </section>
          </div>
        )}
        {toast && <div className="toast">{toast}</div>}
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="desktop-sidebar">
        <div className="brand">
          <div className="brand-mark">I</div>
          <span>InfoHub</span>
        </div>
        <nav>
          <button className="sidebar-search-button" onClick={() => setSearchOpen(true)}>
            <Search size={19} />
            <span>全局搜索</span>
            <kbd>⌘ K</kbd>
          </button>
          <NavButton
            active={tab === "daily"}
            icon={<CalendarDays size={20} />}
            label="日报"
            onClick={() => setTab("daily")}
          />
          <div className="sidebar-dates" aria-label="最近七天">
            {recentDates.map((date, index) => (
              <button
                key={date}
                className={selectedDate === date ? "active" : ""}
                onClick={() => { setSelectedDate(date); setActiveHomeSection(null); setTab("daily"); }}
              >
                <span>{index === 0 ? "最新" : index === 1 ? "昨天" : displayDay(date, true)}</span>
                <small>{items.filter((item) => item.digestDate === date && item.section && !isCuratedItem(item) && item.inRecentWindow !== false).length}</small>
              </button>
            ))}
            <label className="sidebar-more">
              <span>历史日报</span>
              <select value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setActiveHomeSection(null); setTab("daily"); }}>
                {availableDailyDates.map((date) => <option key={date} value={date}>{displayDay(date)}</option>)}
              </select>
            </label>
          </div>
          <NavButton
            active={tab === "reading"}
            icon={<BookOpen size={20} />}
            label="精读"
            onClick={() => setTab("reading")}
          />
          <NavButton
            active={tab === "notes"}
            icon={<BookOpen size={20} />}
            label="笔记"
            onClick={() => setTab("notes")}
          />
          <NavButton
            active={tab === "me"}
            icon={<UserRound size={20} />}
            label="我的"
            onClick={() => setTab("me")}
          />
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-mini">
            <span>本</span>
            <div>
              <strong>本地阅读模式</strong>
              <small>私人数据只在当前设备</small>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-column">
        <header className="mobile-header">
          <div className="brand">
            <div className="brand-mark">I</div>
            <span>InfoHub</span>
          </div>
          <div className="header-actions">
            <button className="icon-button" aria-label="全局搜索" onClick={() => setSearchOpen(true)}>
              <Search size={20} />
            </button>
          </div>
        </header>

        {tab === "daily" && (
          <div className="content-area">
            <section className="welcome">
              <div>
                <p>{displayDay(selectedDate)}</p>
                <h1>{selectedDate === recentDates[0] ? "最新一期，已经整理好了。" : "这一天，值得读的都在这里。"}</h1>
              </div>
              <button className="desktop-search" aria-label="全局搜索" onClick={() => setSearchOpen(true)}>
                <Search size={19} />
                搜索全部内容
                <kbd>⌘ K</kbd>
              </button>
            </section>

            <section className="date-filter" aria-label="每日日期筛选">
              <div className="date-chips">
                {recentDates.map((date, index) => (
                  <button
                    key={date}
                    className={selectedDate === date ? "active" : ""}
                    onClick={() => { setSelectedDate(date); setActiveHomeSection(null); }}
                  >
                    <small>{index === 0 ? "最新" : index === 1 ? "昨天" : new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(new Date(`${date}T12:00:00`))}</small>
                    <strong>{displayDay(date, true)}</strong>
                  </button>
                ))}
              </div>
              <label className="date-picker-button">
                <CalendarDays size={18} />
                <span>历史日报</span>
                <select value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setActiveHomeSection(null); }}>
                  {availableDailyDates.map((date) => <option key={date} value={date}>{displayDay(date)}</option>)}
                </select>
              </label>
            </section>

            {!activeHomeDefinition ? (
              <>
                <section className="digest-card">
                  <div className="digest-glow" />
                  <div className="digest-topline">
                    <span><Sparkles size={15} /> 每日摘要</span>
                    <small>{selectedDate === recentDates[0] ? "刚刚更新" : "已完成"}</small>
                  </div>
                  <h2>{homeSections.length} 个板块，{displayedItems.length} 条内容</h2>
                  <p>首页只展示板块总结。选择一个板块后，再查看其中的全部内容。</p>
                </section>

                <section className="section-heading section-toolbar">
                  <div>
                    <h2>今日板块</h2>
                    <span>点击总结查看全部内容</span>
                  </div>
                  <button onClick={() => setSectionSettingsOpen(true)}>
                    <SlidersHorizontal size={16} /> 调整板块
                  </button>
                </section>

                <div className="home-summary-list">
                  {homeSections.map((group) => {
                    const groupItems = visibleItems.filter(
                      (item) => item.section && group.sections.includes(item.section),
                    );
                    const firstSection = group.sections[0];
                    const sectionSummary = selectedDate === latestDailyDate && group.sections.length === 1
                      ? liveSectionSummaries.find((summary) => summary.section === firstSection)
                        ?? fallbackSectionDigest(firstSection, groupItems)
                      : fallbackSectionDigest(firstSection, groupItems);
                    const keywords = sectionKeywords(groupItems);
                    return (
                      <button
                        className="home-summary-card"
                        key={group.id}
                        onClick={() => { setActiveHomeSection(group.id); window.scrollTo(0, 0); }}
                      >
                        <header>
                          <div>
                            <span>{group.description}</span>
                            <h2>{group.label}</h2>
                          </div>
                          <b>{groupItems.length}</b>
                        </header>
                        <p>{sectionSummary.overview}</p>
                        {keywords.length > 0 && (
                          <div className="home-summary-keywords" aria-label="关键词">
                            {keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
                          </div>
                        )}
                        {sectionSummary.trends[0] && (
                          <div className="home-summary-trend">
                            <strong>趋势</strong>
                            <span>{sectionSummary.trends[0]}</span>
                          </div>
                        )}
                        <div className="home-summary-value">
                          <strong>为什么值得看</strong>
                          <span>{sectionSummary.value}</span>
                        </div>
                        <footer>
                          <small>专业程度 {sectionSummary.technicalLevel} · 约 {sectionSummary.technicalPercentage}%</small>
                          <span>查看全部 <ChevronRight size={16} /></span>
                        </footer>
                      </button>
                    );
                  })}
                  {homeSections.length === 0 && (
                    <div className="empty-daily">
                      <EyeOff size={24} />
                      <h3>所有板块都已隐藏</h3>
                      <button onClick={() => setSectionSettingsOpen(true)}>调整板块</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <section className="section-detail-page">
                <button className="section-back" onClick={() => setActiveHomeSection(null)}>
                  <ChevronLeft size={18} /> 返回板块总结
                </button>
                <header className="content-section-heading">
                  <div>
                    <h2>{activeHomeDefinition.label}</h2>
                    <p>{activeHomeDefinition.description}</p>
                  </div>
                  <span>{activeSectionItems.length}</span>
                </header>
                {activeSectionItems.length > 0 ? (
                  <>
                    {builderDigestItems.length > 0 && (
                      <section className="builders-digest">
                        <header className="builders-digest-intro">
                          <span>Follow Builders</span>
                          <h2>AI Builders Digest — {displayDay(selectedDate, true)}</h2>
                          <p>像是一位懂行的朋友在跟你聊天。以下内容来自关注的 AI Builders 过去 24 小时的动态。</p>
                        </header>
                        <div className="builders-digest-list">
                          {builderDigestItems.map((item) => (
                            <article key={item.id} className="builder-digest-entry">
                              <header>
                                <div>
                                  <span>{item.sourceLabel.replace(/\s*·\s*Follow Builders$/, "")}</span>
                                  <h3>{item.title}</h3>
                                </div>
                                <button
                                  className={saved.includes(item.id) ? "saved" : ""}
                                  onClick={() => toggleSaved(item.id)}
                                >
                                  <Bookmark size={17} fill={saved.includes(item.id) ? "currentColor" : "none"} />
                                  {saved.includes(item.id) ? "已感兴趣" : "感兴趣"}
                                </button>
                              </header>
                              {item.paragraphs
                                .flatMap((paragraph) => splitReadableParagraph(paragraph))
                                .map((paragraph, index) => <p key={`${item.id}-${index}`}>{paragraph}</p>)}
                              <div className="builder-tweet-links">
                                {(item.externalLinks?.length ? item.externalLinks : [{ label: "推文", url: item.sourceUrl }]).map((link) => (
                                  <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                                    {link.label} <ExternalLink size={14} />
                                  </a>
                                ))}
                              </div>
                              <button className="builder-read-action" onClick={() => openItem(item)}>
                                精读与记笔记 <ChevronRight size={16} />
                              </button>
                            </article>
                          ))}
                        </div>
                      </section>
                    )}
                    {regularSectionItems.length > 0 && (
                      <div className="feed single-column-feed">
                        {builderDigestItems.length > 0 && activeHomeDefinition.id === "x" && (
                          <h3 className="technical-x-heading">技术动态 X</h3>
                        )}
                        {regularSectionItems.map((item) => (
                          <ContentCard
                            key={item.id}
                            item={item}
                            saved={saved.includes(item.id)}
                            completed={completed.includes(item.id)}
                            progress={readingProgressStore[item.id]?.percent ?? 0}
                            onOpen={() => openItem(item)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="empty-section">本日暂无更新</div>
                )}
              </section>
            )}
          </div>
        )}

        {tab === "reading" && (
          <div className="content-area reading-list-page">
            <section className="welcome">
              <div>
                <p>长期阅读库</p>
                <h1>好内容不应该被困在某一天。</h1>
              </div>
            </section>
            <div className="reading-view-tabs" role="tablist" aria-label="精读内容类型">
              <button
                className={readingView === "curated" ? "active" : ""}
                onClick={() => setReadingView("curated")}
                role="tab"
                aria-selected={readingView === "curated"}
              >
                <Sparkles size={17} />
                <span><strong>公开精选</strong><small>管理员整理·长期保留</small></span>
              </button>
              <button
                className={readingView === "interested" ? "active" : ""}
                onClick={() => setReadingView("interested")}
                role="tab"
                aria-selected={readingView === "interested"}
              >
                <Bookmark size={17} />
                <span><strong>我的感兴趣</strong><small>私人清单·仅当前设备</small></span>
              </button>
            </div>
            <section className="queue-summary">
              {readingView === "curated" ? <Sparkles size={19} /> : <Bookmark size={19} />}
              <div>
                <strong>{readingListItems.length} 篇{readingView === "curated" ? "公开精选" : "感兴趣内容"}</strong>
                <span>{readingView === "curated" ? "按最新整理时间排序，不随日报过期" : "保存在当前设备"}</span>
              </div>
            </section>
            {readingListItems.length > 0 ? (
              <div className="feed">
                {readingListItems.map((item) => (
                  <ContentCard
                    key={item.id}
                    item={item}
                    saved={saved.includes(item.id)}
                    completed={completed.includes(item.id)}
                    progress={readingProgressStore[item.id]?.percent ?? 0}
                    onOpen={() => openItem(item)}
                    onSave={() => toggleSaved(item.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-daily queue-empty">
                {readingView === "curated" ? <Sparkles size={24} /> : <Bookmark size={24} />}
                <h3>{readingView === "curated" ? "还没有公开精选" : "还没有感兴趣的内容"}</h3>
                <p>{readingView === "curated" ? "管理员提交并处理完成的链接会长期保留在这里。" : "打开内容详情并标记“感兴趣”，内容就会集中到这里。"}</p>
                <button onClick={() => setTab("daily")}>返回日报</button>
              </div>
            )}
          </div>
        )}
        {tab === "notes" && (
          <div className="content-area notes-page">
            <section className="welcome">
              <div>
                <p>私人笔记</p>
                <h1>把值得记住的内容留下来。</h1>
              </div>
            </section>
            <section className="notes-summary">
              <BookOpen size={19} />
              <div>
                <strong>{highlightNoteEntries.length} 条划线笔记</strong>
                <span>仅保存在当前设备，点击可回到原文位置</span>
              </div>
            </section>
            {note && (
              <section className="free-note-card">
                <span>自由笔记</span>
                <p>{note}</p>
              </section>
            )}
            {highlightNoteEntries.length > 0 ? (
              <div className="saved-note-list">
                {highlightNoteEntries.map(({ item, paragraphKey, range, highlightId }) => (
                  <button
                    key={`${item.id}:${paragraphKey}:${highlightId}`}
                    onClick={() => openSavedHighlight(item, paragraphKey, range)}
                  >
                    <header>
                      <SourceBadge item={item} compact />
                      <span>{item.title}</span>
                      <ChevronRight size={17} />
                    </header>
                    <blockquote>{range.text}</blockquote>
                    <p>{range.note}</p>
                  </button>
                ))}
              </div>
            ) : !note ? (
              <div className="empty-daily queue-empty">
                <BookOpen size={24} />
                <h3>还没有笔记</h3>
                <p>在文章中选中内容并写下想法，会自动汇总到这里。</p>
                <button onClick={() => setTab("reading")}>去精读</button>
              </div>
            ) : null}
          </div>
        )}
        {tab === "me" && (
          <MobileAdminPanel />
        )}
      </div>

      {searchOpen && (
        <div className="search-backdrop" onClick={() => setSearchOpen(false)}>
          <section className="global-search-panel" onClick={(event) => event.stopPropagation()} aria-label="全局搜索">
            <header>
              <div className="global-search-field">
                <Search size={20} />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="搜索标题、关键词、正文或笔记"
                />
              </div>
              <button className="icon-button" onClick={() => setSearchOpen(false)} aria-label="关闭搜索">
                <X size={20} />
              </button>
            </header>
            <div className="search-scope-tabs" role="tablist" aria-label="搜索范围">
              {([
                ["all", "全部"],
                ["content", "内容"],
                ["note", "笔记"],
              ] as const).map(([scope, label]) => (
                <button
                  key={scope}
                  className={searchScope === scope ? "active" : ""}
                  onClick={() => setSearchScope(scope)}
                  role="tab"
                  aria-selected={searchScope === scope}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="global-search-results">
              {!searchQuery.trim() ? (
                <div className="search-empty">
                  <Search size={24} />
                  <strong>搜索整个 InfoHub</strong>
                  <span>日报、精读与当前设备上的私人笔记都会被检索。</span>
                </div>
              ) : visibleSearchResults.length > 0 ? (
                visibleSearchResults.map((result) => (
                  <button key={result.id} onClick={() => setPendingSearchResultId(result.id)}>
                    <span className={`search-result-origin ${result.kind}`}>{result.origin}</span>
                    <strong>{result.title}</strong>
                    <p>{result.excerpt}</p>
                    <ChevronRight size={18} />
                  </button>
                ))
              ) : (
                <div className="search-empty">
                  <Search size={24} />
                  <strong>没有找到相关内容</strong>
                  <span>可以换一个作者、项目名或关键词试试。</span>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {sectionSettingsOpen && (
        <div className="sheet-backdrop" onClick={() => setSectionSettingsOpen(false)}>
          <section
            className="note-sheet section-settings-sheet"
            onClick={(event) => event.stopPropagation()}
            aria-label="调整首页板块"
          >
            <div className="sheet-handle" />
            <div className="sheet-title">
              <div>
                <span>调整首页板块</span>
                <small>设置仅影响你的首页展示</small>
              </div>
              <button className="icon-button" onClick={() => setSectionSettingsOpen(false)} aria-label="关闭">
                <X size={20} />
              </button>
            </div>
            <div className="section-settings-list">
              {sectionPreferences.map((preference, index) => {
                const section = sectionDefinitions.find((item) => item.id === preference.id)!;
                return (
                  <div className="section-setting-row" key={preference.id}>
                    <button
                      className={`visibility-button ${preference.visible ? "active" : ""}`}
                      onClick={() => toggleSection(preference.id)}
                      aria-label={preference.visible ? `隐藏${section.label}` : `显示${section.label}`}
                    >
                      {preference.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                      <span>{preference.visible ? "移出首页" : "恢复"}</span>
                    </button>
                    <div>
                      <strong>{section.label}</strong>
                      <small>{section.description}</small>
                    </div>
                    <span className={`order-actions ${preference.visible ? "" : "is-hidden"}`}>
                      <button onClick={() => moveSection(preference.id, -1)} disabled={index === 0} aria-label="上移">
                        <ChevronUp size={18} />
                      </button>
                      <button onClick={() => moveSection(preference.id, 1)} disabled={index === sectionPreferences.length - 1} aria-label="下移">
                        <ChevronDown size={18} />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
            <button className="primary-button settings-done" onClick={() => setSectionSettingsOpen(false)}>
              <Check size={18} /> 完成
            </button>
          </section>
        </div>
      )}

      <nav className="bottom-nav" aria-label="主要导航">
        <NavButton
          active={tab === "daily"}
          icon={<CalendarDays size={21} />}
          label="日报"
          onClick={() => setTab("daily")}
        />
        <NavButton
          active={tab === "reading"}
          icon={<BookOpen size={21} />}
          label="精读"
          onClick={() => setTab("reading")}
        />
        <NavButton
          active={tab === "notes"}
          icon={<BookOpen size={21} />}
          label="笔记"
          onClick={() => setTab("notes")}
        />
        <NavButton
          active={tab === "me"}
          icon={<UserRound size={21} />}
          label="我的"
          onClick={() => setTab("me")}
        />
      </nav>
    </main>
  );
}

type CuratedSubmission = {
  id: string;
  url: string;
  timing: "immediate" | "morning";
  status: "submitted" | "scheduled" | "processing" | "published" | "failed";
  step?: "extract" | "ai" | "quality" | "publish";
  title?: string;
  error?: string;
  updatedAt: string;
};

const submissionStatusLabel: Record<CuratedSubmission["status"], string> = {
  submitted: "已提交",
  scheduled: "等待明早处理",
  processing: "正在处理",
  published: "已进入公开精选",
  failed: "处理失败",
};

const submissionStepLabel: Record<NonNullable<CuratedSubmission["step"]>, string> = {
  extract: "正在获取原文或文字稿",
  ai: "正在整理为中文文章",
  quality: "正在检查内容质量",
  publish: "正在发布",
};

const privateBackupKeys = [
  "infohub-demo-note",
  "infohub-highlights",
  "infohub-reading-progress",
  "infohub-library-state",
  "infohub-section-preferences",
  "infohub-curated-submissions",
] as const;

type PrivateBackup = {
  format: "infohub-private-backup";
  version: 1;
  exportedAt: string;
  values: Partial<Record<(typeof privateBackupKeys)[number], string>>;
};

function MobileAdminPanel() {
  const [apiUrl, setApiUrl] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState("");
  const [timing, setTiming] = useState<"immediate" | "morning">("immediate");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [submissions, setSubmissions] = useState<CuratedSubmission[]>([]);
  const [backupMessage, setBackupMessage] = useState("");
  const backupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedToken = window.localStorage.getItem("infohub-admin-token") ?? "";
    const savedSubmissions = window.localStorage.getItem("infohub-curated-submissions");
    const timer = window.setTimeout(() => {
      setToken(savedToken);
      if (savedToken) setAdminOpen(true);
      try {
        const parsed = savedSubmissions ? JSON.parse(savedSubmissions) as CuratedSubmission[] : [];
        if (Array.isArray(parsed)) setSubmissions(parsed);
      } catch {
        setSubmissions([]);
      }
    }, 0);
    void fetch("./infohub-config.json", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ submissionApiUrl?: string }> : null)
      .then((config) => setApiUrl(config?.submissionApiUrl?.replace(/\/$/, "") ?? ""))
      .catch(() => setApiUrl(""));
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (submissions.length === 0) return;
    let cancelled = false;
    const sync = async () => {
      try {
        const response = await fetch(`./generated-submission-status.json?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;
        const publicStatuses = await response.json() as CuratedSubmission[];
        if (!Array.isArray(publicStatuses) || cancelled) return;
        const byId = new Map(publicStatuses.map((item) => [item.id, item]));
        setSubmissions((current) => {
          const next = current.map((item) => ({ ...item, ...(byId.get(item.id) ?? {}) }));
          window.localStorage.setItem("infohub-curated-submissions", JSON.stringify(next));
          return next;
        });
      } catch {
        // The last known state remains visible when GitHub Pages is redeploying.
      }
    };
    void sync();
    const timer = window.setInterval(() => void sync(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [submissions.length]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    if (!apiUrl) {
      setMessage("管理员提交服务正在完成首次配置，请稍后再试。");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${apiUrl}/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json() as { token?: string; error?: string };
      if (!response.ok || !result.token) throw new Error(result.error ?? "登录失败");
      window.localStorage.setItem("infohub-admin-token", result.token);
      setToken(result.token);
      setPassword("");
      setMessage("管理员身份已确认");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!apiUrl || !token || !url.trim()) return;
    setBusy(true);
    setMessage("");
    const requestId = crypto.randomUUID();
    try {
      const response = await fetch(`${apiUrl}/submit`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim(), timing, requestId }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        if (response.status === 401) {
          window.localStorage.removeItem("infohub-admin-token");
          setToken("");
        }
        throw new Error(result.error ?? "提交失败");
      }
      const entry: CuratedSubmission = {
        id: requestId,
        url: url.trim(),
        timing,
        status: timing === "morning" ? "scheduled" : "submitted",
        updatedAt: new Date().toISOString(),
      };
      const next = [entry, ...submissions].slice(0, 50);
      setSubmissions(next);
      window.localStorage.setItem("infohub-curated-submissions", JSON.stringify(next));
      setUrl("");
      setMessage(timing === "morning" ? "链接已保存，明早随日报处理" : "链接已提交，可以继续添加下一条");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提交失败");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    window.localStorage.removeItem("infohub-admin-token");
    setToken("");
    setPassword("");
    setMessage("");
  }

  function exportPrivateBackup() {
    const values: PrivateBackup["values"] = {};
    privateBackupKeys.forEach((key) => {
      const value = window.localStorage.getItem(key);
      if (value !== null) values[key] = value;
    });
    const backup: PrivateBackup = {
      format: "infohub-private-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      values,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `infohub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1_000);
    setBackupMessage("备份文件已导出，请将它保存在安全位置");
  }

  async function restorePrivateBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<PrivateBackup>;
      if (parsed.format !== "infohub-private-backup" || parsed.version !== 1 || !parsed.values || typeof parsed.values !== "object") {
        throw new Error("这不是有效的 InfoHub 备份文件");
      }
      const values = parsed.values as Record<string, unknown>;
      for (const key of privateBackupKeys) {
        const value = values[key];
        if (value !== undefined && typeof value !== "string") throw new Error("备份文件的数据格式不正确");
        if (key !== "infohub-demo-note" && typeof value === "string") JSON.parse(value);
      }
      if (!window.confirm("恢复备份将替换当前设备上的笔记、划线、阅读进度和感兴趣状态。确定继续吗？")) return;
      privateBackupKeys.forEach((key) => {
        const value = values[key];
        if (typeof value === "string") window.localStorage.setItem(key, value);
        else window.localStorage.removeItem(key);
      });
      window.alert("备份已恢复，InfoHub 将重新加载。");
      window.location.reload();
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "备份恢复失败");
    }
  }

  return (
    <div className="content-area profile-page">
      <section className="welcome">
        <div>
          <p>我的 InfoHub</p>
          <h1>阅读属于你，内容由管理员统一整理。</h1>
        </div>
      </section>
      <section className="device-privacy-card">
        <UserRound size={22} />
        <div>
          <strong>私人阅读数据保存在当前设备</strong>
          <span>感兴趣、阅读进度、划线和笔记不会上传，也不会进入公共内容生产线。</span>
        </div>
      </section>

      <section className="backup-card">
        <header>
          <div>
            <strong>私人数据备份</strong>
            <span>导出笔记、划线、阅读进度、感兴趣与已读状态；不包含管理员密码或令牌。</span>
          </div>
        </header>
        <div>
          <button onClick={exportPrivateBackup}><Download size={18} /> 导出全部数据</button>
          <button onClick={() => backupInputRef.current?.click()}><Upload size={18} /> 恢复备份</button>
          <input ref={backupInputRef} type="file" accept="application/json,.json" onChange={restorePrivateBackup} />
        </div>
        {backupMessage && <p>{backupMessage}</p>}
      </section>

      {!adminOpen ? (
        <button className="admin-entry-button" onClick={() => setAdminOpen(true)}>
          <LockKeyhole size={18} /> 管理员提交精选内容
        </button>
      ) : (
        <section className="mobile-admin-card">
          <header>
            <div>
              <span>ADMIN</span>
              <h2>提交精选内容</h2>
              <p>YouTube、小宇宙、网页文章或公开 PDF 链接</p>
            </div>
            {token && <button onClick={logout} aria-label="退出管理员"><LogOut size={18} /></button>}
          </header>

          {!token ? (
            <form className="mobile-admin-form" onSubmit={login}>
              <label>
                管理员密码
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="输入管理员密码"
                />
              </label>
              <button className="primary-button" disabled={busy || !password}>
                {busy ? <LoaderCircle className="spin" size={18} /> : <LockKeyhole size={18} />}
                验证身份
              </button>
            </form>
          ) : (
            <form className="mobile-admin-form" onSubmit={submit}>
              <label>
                内容链接
                <div className="submission-url-field">
                  <Link2 size={18} />
                  <input
                    type="url"
                    inputMode="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="粘贴 https://..."
                  />
                </div>
              </label>
              <div className="mobile-timing-picker" role="radiogroup" aria-label="处理时间">
                <button type="button" className={timing === "immediate" ? "active" : ""} onClick={() => setTiming("immediate")}>现在处理</button>
                <button type="button" className={timing === "morning" ? "active" : ""} onClick={() => setTiming("morning")}>明早处理</button>
              </div>
              <button className="primary-button" disabled={busy || !url.trim()}>
                {busy ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}
                {busy ? "正在提交" : "提交链接"}
              </button>
            </form>
          )}
          {message && <p className="mobile-admin-message">{message}</p>}

          {token && submissions.length > 0 && (
            <div className="mobile-submission-list">
              <h3>最近提交</h3>
              {submissions.map((item) => (
                <article key={item.id}>
                  <div>
                    <a href={item.url} target="_blank" rel="noreferrer">{item.title || item.url}</a>
                    <span>{item.status === "processing" && item.step ? submissionStepLabel[item.step] : submissionStatusLabel[item.status]}</span>
                    {item.error && <em>{item.error}</em>}
                  </div>
                  <i className={item.status} />
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function SelectableParagraph({
  text,
  highlightKey,
  ranges,
  onHighlightClick,
}: {
  text: string;
  highlightKey: string;
  ranges: HighlightRange[];
  onHighlightClick: (range: HighlightRange) => void;
}) {
  const validRanges = ranges
    .filter((range) => range.start >= 0 && range.end <= text.length && range.end > range.start)
    .sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  validRanges.forEach((range, index) => {
    if (range.start > cursor) parts.push(text.slice(cursor, range.start));
    parts.push(
      <mark
        key={`${range.start}-${range.end}-${index}`}
        className={range.note ? "has-note" : ""}
        role="button"
        tabIndex={0}
        title={range.note ? "查看划线笔记" : "为这段划线添加笔记"}
        onClick={() => onHighlightClick(range)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") onHighlightClick(range);
        }}
      >
        {text.slice(range.start, range.end)}
      </mark>,
    );
    cursor = Math.max(cursor, range.end);
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <p data-highlight-key={highlightKey}>{parts.length > 0 ? parts : text}</p>;
}

function numericFact(value = "") {
  const normalized = value.replaceAll(",", "").trim().toLowerCase();
  const number = Number.parseFloat(normalized.replace(/[^\d.]/g, ""));
  if (Number.isNaN(number)) return 0;
  return normalized.includes("k") ? number * 1_000 : normalized.includes("m") ? number * 1_000_000 : number;
}

function GitHubStarGuide({ facts }: { facts: { label: string; value: string }[] }) {
  const total = numericFact(facts.find((fact) => fact.label === "Stars")?.value);
  const today = numericFact(facts.find((fact) => fact.label.includes("今日新增"))?.value);
  const totalContext = total >= 50_000
    ? "已经是跨圈层知名项目"
    : total >= 10_000
      ? "属于很受欢迎的成熟项目"
      : total >= 1_000
        ? "已经形成有规模的开发者社区"
        : "仍处于早期增长阶段";
  const todayContext = today >= 500
    ? "今天增长非常快"
    : today >= 100
      ? "今天热度明显"
      : today > 0
        ? "今天仍在持续获得关注"
        : "是否热门还要结合今日新增和项目年龄判断";
  return (
    <aside className="star-guide">
      <strong>Star 怎么看？</strong>
      <p>Star 类似开发者的收藏。这个项目{totalContext}；{todayContext}。粗略参考：1k 已值得关注，10k 算热门，50k 以上非常少见，但新项目更应该看“今日新增”。</p>
    </aside>
  );
}

function SourceBadge({ item, compact = false }: { item: Item; compact?: boolean }) {
  const Icon = sourceIcon[item.source];
  return (
    <span className={`source-badge ${item.accent} ${compact ? "compact" : ""}`}>
      <Icon size={compact ? 13 : 17} />
    </span>
  );
}

function ContentCard({
  item,
  saved,
  completed,
  progress,
  onOpen,
  onSave,
}: {
  item: Item;
  saved: boolean;
  completed: boolean;
  progress: number;
  onOpen: () => void;
  onSave?: () => void;
}) {
  return (
    <article className={`content-card ${completed ? "is-completed" : ""}`}>
      <button className="card-main" onClick={onOpen}>
        <SourceBadge item={item} />
        <div className="card-copy">
          <div className="card-meta">
            <span>{item.sourceLabel}</span>
            {saved && <b className="queue-badge">感兴趣</b>}
            {completed && <b className="read-badge">已读</b>}
            {!completed && progress > 0 && <b className="progress-badge">阅读中 · {progress}%</b>}
          </div>
          <h3>{item.title}</h3>
          <p>{item.summary}</p>
          <div className="card-footer">
            <span><Clock3 size={14} /> {item.readTime}</span>
            <span className="mobile-open">阅读 <ChevronRight size={15} /></span>
          </div>
        </div>
      </button>
      {onSave && (
        <button
          className={`save-button ${saved ? "is-active" : ""}`}
          onClick={onSave}
          aria-label={saved ? "取消感兴趣" : "标记为感兴趣"}
        >
          <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
        </button>
      )}
    </article>
  );
}

function NavButton({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      {icon}
      <span>{label}</span>
      {!!count && <small className="nav-count">{count}</small>}
    </button>
  );
}
