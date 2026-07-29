"use client";

import {
  Bell,
  Bookmark,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Headphones,
  MoreHorizontal,
  PenLine,
  Play,
  Search,
  Settings,
  Sparkles,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ChatGPTUser } from "./chatgpt-auth";

type Source = "youtube" | "podcast" | "daily" | "builder";
type Tab = "daily" | "discover" | "notes" | "me";

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
};

const items: Item[] = [
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
];

const sourceIcon = {
  youtube: Video,
  podcast: Headphones,
  daily: FileText,
  builder: Sparkles,
};

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getRecentDates() {
  const anchor = new Date(2026, 6, 29);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchor);
    date.setDate(anchor.getDate() - index);
    return toIsoDate(date);
  });
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

export function InfoHubApp({ user }: { user: ChatGPTUser | null }) {
  const recentDates = useMemo(() => getRecentDates(), []);
  const [tab, setTab] = useState<Tab>("daily");
  const [selectedDate, setSelectedDate] = useState(recentDates[0]);
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [highlighted, setHighlighted] = useState(false);
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem("infohub-demo-note");
    if (!stored) return;
    const timer = window.setTimeout(() => setNote(stored), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const sourceCount = useMemo(
    () => new Set(items.map((item) => item.source)).size,
    [],
  );
  const visibleItems = useMemo(
    () => items.filter((item) => item.digestDate === selectedDate),
    [selectedDate],
  );
  const visibleSourceCount = new Set(visibleItems.map((item) => item.sourceLabel)).size;

  function toggleSaved(id: string) {
    setSaved((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function saveNote() {
    window.localStorage.setItem("infohub-demo-note", note);
    setToast("笔记已保存");
    setNoteOpen(false);
  }

  if (activeItem) {
    return (
      <main className="app-shell reader-shell">
        <header className="reader-topbar">
          <button
            className="icon-button"
            onClick={() => setActiveItem(null)}
            aria-label="返回今日汇总"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="reading-progress" aria-label="阅读进度 36%">
            <span style={{ width: "36%" }} />
          </div>
          <button
            className={`icon-button ${saved.includes(activeItem.id) ? "is-active" : ""}`}
            onClick={() => toggleSaved(activeItem.id)}
            aria-label="收藏文章"
          >
            <Bookmark size={20} fill="currentColor" />
          </button>
          <button className="icon-button" aria-label="更多操作">
            <MoreHorizontal size={22} />
          </button>
        </header>

        <article className="reader">
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
          <div className="tag-row">
            {activeItem.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <div className="article-rule" />
          <div className="article-body">
            {activeItem.paragraphs.map((paragraph, index) => (
              <p
                key={paragraph}
                className={highlighted && index === 1 ? "highlighted" : ""}
              >
                {paragraph}
              </p>
            ))}
          </div>
          <div className="article-end">
            <span>END</span>
          </div>
        </article>

        <div className="reader-actions">
          <button
            onClick={() => {
              setHighlighted((value) => !value);
              setToast(highlighted ? "已取消示例划线" : "已添加示例划线");
            }}
          >
            <PenLine size={19} />
            <span>划线</span>
          </button>
          <button onClick={() => setNoteOpen(true)}>
            <BookOpen size={19} />
            <span>笔记</span>
            {note && <i />}
          </button>
          <a href={activeItem.sourceUrl} target="_blank" rel="noreferrer">
            <Play size={18} />
            <span>原文</span>
          </a>
        </div>

        {noteOpen && (
          <div className="sheet-backdrop" onClick={() => setNoteOpen(false)}>
            <section
              className="note-sheet"
              onClick={(event) => event.stopPropagation()}
              aria-label="文章笔记"
            >
              <div className="sheet-handle" />
              <div className="sheet-title">
                <div>
                  <span>我的笔记</span>
                  <small>仅自己可见 · 自动跨端同步</small>
                </div>
                <button
                  className="icon-button"
                  onClick={() => setNoteOpen(false)}
                  aria-label="关闭笔记"
                >
                  <X size={20} />
                </button>
              </div>
              {highlighted && (
                <blockquote>
                  真正可用的长期记忆至少包含三个环节。第一是写入决策……
                </blockquote>
              )}
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="写下你的想法……"
                autoFocus
              />
              <button className="primary-button" onClick={saveNote}>
                <Check size={18} />
                保存笔记
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
          <NavButton
            active={tab === "daily"}
            icon={<CalendarDays size={20} />}
            label="每日"
            onClick={() => setTab("daily")}
          />
          <div className="sidebar-dates" aria-label="最近七天">
            {recentDates.map((date, index) => (
              <button
                key={date}
                className={selectedDate === date ? "active" : ""}
                onClick={() => { setSelectedDate(date); setTab("daily"); }}
              >
                <span>{index === 0 ? "最新" : index === 1 ? "昨天" : displayDay(date, true)}</span>
                <small>{items.filter((item) => item.digestDate === date).length}</small>
              </button>
            ))}
            <label className="sidebar-more">
              <span>更多日期</span>
              <input type="date" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setTab("daily"); }} />
            </label>
          </div>
          <NavButton
            active={tab === "discover"}
            icon={<Search size={20} />}
            label="发现"
            onClick={() => setTab("discover")}
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
          <a className="settings-link" href="/admin">
            <Settings size={19} />
            管理后台
          </a>
          <div className="profile-mini">
            <span>{user?.displayName.slice(0, 1).toUpperCase() ?? "访"}</span>
            <div>
              <strong>{user?.displayName ?? "访客模式"}</strong>
              <small>{user ? "笔记已同步" : "登录后同步笔记"}</small>
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
            <button className="icon-button" aria-label="搜索">
              <Search size={20} />
            </button>
            <button className="icon-button notification-button" aria-label="通知">
              <Bell size={20} />
              <i />
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
              <button className="desktop-search" aria-label="搜索内容">
                <Search size={19} />
                搜索内容
                <kbd>⌘ K</kbd>
              </button>
            </section>

            <section className="date-filter" aria-label="每日日期筛选">
              <div className="date-chips">
                {recentDates.map((date, index) => (
                  <button
                    key={date}
                    className={selectedDate === date ? "active" : ""}
                    onClick={() => setSelectedDate(date)}
                  >
                    <small>{index === 0 ? "最新" : index === 1 ? "昨天" : new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(new Date(`${date}T12:00:00`))}</small>
                    <strong>{displayDay(date, true)}</strong>
                  </button>
                ))}
              </div>
              <label className="date-picker-button">
                <CalendarDays size={18} />
                <span>选择单日</span>
                <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
              </label>
            </section>

            <section className="digest-card">
              <div className="digest-glow" />
              <div className="digest-topline">
                <span>
                  <Sparkles size={15} />
                  每日摘要
                </span>
                <small>{selectedDate === recentDates[0] ? "刚刚更新" : "已完成"}</small>
              </div>
              <h2>{visibleSourceCount} 个信息源，{visibleItems.length} 条内容</h2>
              <p>
                {visibleItems.length > 0
                  ? selectedDate === recentDates[0]
                    ? "本次已跑通两个 YouTube 频道的视频发现、字幕抓取与中文整理。"
                    : "历史回跑已完成，内容按采集日期归档，可继续阅读和记笔记。"
                  : "这一天两个频道没有新的采集结果。你仍可切换日期查看历史内容。"}
              </p>
              <div className="digest-stats">
                <span><Video size={16} /> {visibleItems.length} 视频</span>
                <span><FileText size={16} /> {visibleItems.length} 篇整理</span>
              </div>
            </section>

            <section className="section-heading">
              <div>
                <h2>本日内容</h2>
                <span>{visibleItems.length} 篇</span>
              </div>
              <button>全部已读 <Check size={16} /></button>
            </section>

            <div className="feed">
              {visibleItems.map((item) => (
                <ContentCard
                  key={item.id}
                  item={item}
                  saved={saved.includes(item.id)}
                  onOpen={() => setActiveItem(item)}
                  onSave={() => toggleSaved(item.id)}
                />
              ))}
              {visibleItems.length === 0 && (
                <div className="empty-daily">
                  <CalendarDays size={24} />
                  <h3>这一天没有新内容</h3>
                  <p>两个频道均已检查完成。可切换到“最新”查看最近一次采集。</p>
                  <button onClick={() => setSelectedDate(recentDates[0])}>返回最新</button>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "discover" && (
          <PlaceholderPage
            icon={<Search size={24} />}
            eyebrow="发现"
            title="从全部内容中找到下一篇"
            description={`当前公共内容流整合了 ${sourceCount} 类信息源。搜索、标签与历史日报会在这里集中呈现。`}
          />
        )}
        {tab === "notes" && (
          <PlaceholderPage
            icon={<BookOpen size={24} />}
            eyebrow="私人空间"
            title={note ? "你的笔记已经在这里了" : "读到有启发的地方，就留下它"}
            description={
              note ||
              "划线、批注和自由笔记仅自己可见；登录后会在手机与网页之间同步。"
            }
          />
        )}
        {tab === "me" && (
          <PlaceholderPage
            icon={<UserRound size={24} />}
            eyebrow={user ? "账户已连接" : "访客模式"}
            title={user?.displayName ?? "登录后，让笔记跟着你走"}
            description={
              user
                ? "笔记、阅读进度与私人文档会自动同步。"
                : "公开日报无需登录即可阅读；登录后可以同步笔记、进度和私人文档。"
            }
            action={
              user ? (
                <a className="primary-button sign-in" href="/admin">
                  进入管理后台
                </a>
              ) : (
                <a className="primary-button sign-in" href="/signin-with-chatgpt?return_to=%2F">
                  登录并同步
                </a>
              )
            }
          />
        )}
      </div>

      <nav className="bottom-nav" aria-label="主要导航">
        <NavButton
          active={tab === "daily"}
          icon={<CalendarDays size={21} />}
          label="每日"
          onClick={() => setTab("daily")}
        />
        <NavButton
          active={tab === "discover"}
          icon={<Search size={21} />}
          label="发现"
          onClick={() => setTab("discover")}
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
  onOpen,
  onSave,
}: {
  item: Item;
  saved: boolean;
  onOpen: () => void;
  onSave: () => void;
}) {
  return (
    <article className="content-card">
      <button className="card-main" onClick={onOpen}>
        <SourceBadge item={item} />
        <div className="card-copy">
          <div className="card-meta">
            <span>{item.sourceLabel}</span>
            <i />
            <span>{item.time}</span>
          </div>
          <h3>{item.title}</h3>
          <p>{item.summary}</p>
          <div className="card-footer">
            <span><Clock3 size={14} /> {item.readTime}</span>
            <span className="mobile-open">阅读 <ChevronRight size={15} /></span>
          </div>
        </div>
      </button>
      <button
        className={`save-button ${saved ? "is-active" : ""}`}
        onClick={onSave}
        aria-label={saved ? "取消收藏" : "收藏"}
      >
        <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
      </button>
    </article>
  );
}

function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function PlaceholderPage({
  icon,
  eyebrow,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="placeholder-page">
      <div className="placeholder-icon">{icon}</div>
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
      {action}
    </section>
  );
}
