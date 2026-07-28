"use client";

import {
  Bell,
  Bookmark,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Headphones,
  Home,
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
type Tab = "today" | "discover" | "notes" | "me";

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
};

const items: Item[] = [
  {
    id: "agent-memory",
    source: "youtube",
    sourceLabel: "Latent Space",
    title: "Agent 的长期记忆，正在从功能变成基础设施",
    summary:
      "从记忆写入、检索到遗忘机制，梳理新一代 Agent 系统真正需要解决的工程问题。",
    time: "07:12",
    readTime: "8 分钟",
    accent: "violet",
    tags: ["Agent", "Memory", "Infrastructure"],
  },
  {
    id: "product-loop",
    source: "podcast",
    sourceLabel: "硅谷101",
    title: "AI 产品如何建立真正的数据飞轮",
    summary:
      "模型能力趋同之后，产品团队如何通过用户行为、反馈与评估体系建立长期优势。",
    time: "06:45",
    readTime: "12 分钟",
    accent: "orange",
    tags: ["AI 产品", "数据飞轮", "评估"],
  },
  {
    id: "daily-models",
    source: "daily",
    sourceLabel: "技术日报",
    title: "今天值得关注的 5 条技术动态",
    summary:
      "开源推理模型、浏览器 Agent、新型向量数据库，以及两项值得关注的开发者工具更新。",
    time: "06:20",
    readTime: "5 分钟",
    accent: "blue",
    tags: ["模型", "开发工具", "开源"],
  },
  {
    id: "builder-tools",
    source: "builder",
    sourceLabel: "Follow Builders",
    title: "本周新增的 7 个 AI Builder 工作流",
    summary:
      "聚焦内容研究、自动化发布与产品原型，把最有复用价值的工作流整理成清单。",
    time: "昨天",
    readTime: "6 分钟",
    accent: "green",
    tags: ["Workflow", "Builder", "Skill"],
  },
];

const articleParagraphs = [
  "过去一年，Agent 的记忆能力常常被描述成一个附加功能：把对话写进向量数据库，下次再检索出来。但当 Agent 开始承担跨天、跨设备、跨任务的工作时，记忆已经不再只是“记住聊天记录”，而是一套决定系统能否持续工作的基础设施。",
  "真正可用的长期记忆至少包含三个环节。第一是写入决策：并不是所有发生过的事情都值得保存。系统需要区分事实、偏好、临时状态与推断，并知道它们各自应该保留多久。",
  "第二是检索。相似度搜索只能回答“哪些内容看起来相关”，却不能保证找回的就是当前任务真正需要的信息。更成熟的方案会综合时间、来源可信度、用户确认状态和任务上下文。",
  "第三是遗忘与修订。记忆不是只增不减的仓库。过期偏好、错误推断和互相冲突的事实都需要被发现、降权或替换。没有遗忘机制的 Agent，长期使用后反而会越来越不可靠。",
  "因此，记忆系统的核心竞争力不在存了多少，而在于能否让正确的信息在正确的时刻出现，同时让用户理解它为什么出现，并且有能力修正它。",
];

const sourceIcon = {
  youtube: Video,
  podcast: Headphones,
  daily: FileText,
  builder: Sparkles,
};

function formatDate() {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
}

export function InfoHubApp({ user }: { user: ChatGPTUser | null }) {
  const [tab, setTab] = useState<Tab>("today");
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [highlighted, setHighlighted] = useState(false);
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem("infohub-demo-note");
    if (stored) setNote(stored);
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
            {articleParagraphs.map((paragraph, index) => (
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
          <a href="https://www.youtube.com/" target="_blank" rel="noreferrer">
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
            active={tab === "today"}
            icon={<Home size={20} />}
            label="今日"
            onClick={() => setTab("today")}
          />
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
          <button>
            <Settings size={19} />
            设置
          </button>
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

        {tab === "today" && (
          <div className="content-area">
            <section className="welcome">
              <div>
                <p>{formatDate()}</p>
                <h1>早上好，今天有些值得读的。</h1>
              </div>
              <button className="desktop-search" aria-label="搜索内容">
                <Search size={19} />
                搜索内容
                <kbd>⌘ K</kbd>
              </button>
            </section>

            <section className="digest-card">
              <div className="digest-glow" />
              <div className="digest-topline">
                <span>
                  <Sparkles size={15} />
                  今日摘要
                </span>
                <small>08:00 更新</small>
              </div>
              <h2>4 个信息源，8 条新内容</h2>
              <p>
                今天的重点围绕 Agent 记忆、AI 产品数据飞轮和新一代开发工具展开。
              </p>
              <div className="digest-stats">
                <span><Video size={16} /> 2 视频</span>
                <span><Headphones size={16} /> 1 播客</span>
                <span><FileText size={16} /> 5 动态</span>
              </div>
            </section>

            <section className="section-heading">
              <div>
                <h2>今日精选</h2>
                <span>{items.length} 篇</span>
              </div>
              <button>全部已读 <Check size={16} /></button>
            </section>

            <div className="feed">
              {items.map((item) => (
                <ContentCard
                  key={item.id}
                  item={item}
                  saved={saved.includes(item.id)}
                  onOpen={() => setActiveItem(item)}
                  onSave={() => toggleSaved(item.id)}
                />
              ))}
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
              user ? undefined : (
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
          active={tab === "today"}
          icon={<Home size={21} />}
          label="今日"
          onClick={() => setTab("today")}
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
