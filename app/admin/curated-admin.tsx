"use client";

import { ArrowDown, ArrowUp, Check, Eye, EyeOff, FileText, LayoutList, LoaderCircle, LogOut, Pencil, Plus, RotateCcw, Send, Tag, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MarkdownTakeaway } from "../markdown-takeaway";

type ArticleType = "podcast" | "video" | "article";
type PublishStatus = "draft" | "scheduled" | "publishing" | "live" | "failed" | "withdrawn";
type TakeawayFormat = "simple" | "markdown";

type CuratedDraft = {
  id: string;
  title: string;
  cardSummary: string;
  displayDate: string;
  type: ArticleType;
  takeaways: string[];
  takeawayRaw?: string;
  takeawayFormat: TakeawayFormat;
  topics: string[];
  body: string;
  sourceUrl?: string;
  status: PublishStatus;
  error?: string;
  updatedAt: string;
};

const emptyDraft = (): CuratedDraft => ({
  id: crypto.randomUUID(),
  title: "",
  cardSummary: "",
  displayDate: new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()),
  type: "article",
  takeaways: [],
  takeawayRaw: "",
  takeawayFormat: "simple",
  topics: [],
  body: "",
  sourceUrl: "",
  status: "draft",
  updatedAt: new Date().toISOString(),
});

const typeLabel: Record<ArticleType, string> = { podcast: "播客", video: "视频", article: "文章" };
const statusLabel: Record<PublishStatus, string> = {
  draft: "草稿",
  scheduled: "待展示",
  publishing: "发布中",
  live: "已发布",
  failed: "发布失败",
  withdrawn: "已撤回",
};

async function gatewayFetch(input: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function bodyBlocks(body: string) {
  return body.split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean);
}

function formatUpdatedAt(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")} ${read("hour")}:${read("minute")}`;
}

function publicItemToDraft(item: Record<string, unknown>): CuratedDraft | null {
  const id = typeof item.id === "string" && item.id.startsWith("curated-") ? item.id.slice(8) : "";
  const title = typeof item.title === "string" ? item.title : "";
  const displayDate = typeof item.digestDate === "string" ? item.digestDate : "";
  if (!id || !title || !displayDate) return null;
  const source = typeof item.source === "string" ? item.source : "article";
  const paragraphs = Array.isArray(item.paragraphs) ? item.paragraphs.filter((value): value is string => typeof value === "string") : [];
  const sections = Array.isArray(item.sections) ? item.sections as Array<{ title?: unknown; paragraphs?: unknown }> : [];
  const sectionBody = sections.flatMap((section) => [
    typeof section.title === "string" ? section.title : "",
    ...(Array.isArray(section.paragraphs) ? section.paragraphs.filter((value): value is string => typeof value === "string") : []),
  ]).filter(Boolean);
  return {
    id,
    title,
    cardSummary: typeof item.summary === "string" ? item.summary : "",
    displayDate,
    type: source === "podcast" ? "podcast" : source === "youtube" ? "video" : "article",
    takeaways: Array.isArray(item.takeaways) ? item.takeaways.filter((value): value is string => typeof value === "string") : [],
    takeawayRaw: typeof item.takeawayRaw === "string" ? item.takeawayRaw : undefined,
    takeawayFormat: item.takeawayFormat === "markdown" ? "markdown" : "simple",
    topics: Array.isArray(item.topics) ? item.topics.filter((value): value is string => typeof value === "string").slice(0, 2) : [],
    body: [...paragraphs, ...sectionBody].join("\n\n"),
    sourceUrl: typeof item.sourceUrl === "string" ? item.sourceUrl : undefined,
    status: displayDate > emptyDraft().displayDate ? "scheduled" : "live",
    updatedAt: typeof item.publishedAt === "string" ? item.publishedAt : `${displayDate}T00:00:00.000Z`,
  };
}

function parseSimpleTakeaways(raw: string) {
  return raw.split("\n")
    .map((line) => line.replace(/^\s*\d+[.、)]\s*/, "").trim())
    .filter(Boolean);
}

export function CuratedAdminApp() {
  const [apiUrl, setApiUrl] = useState("");
  const [token, setToken] = useState(() => typeof window === "undefined" ? "" : window.localStorage.getItem("infohub-admin-token") ?? "");
  const [password, setPassword] = useState("");
  const [draft, setDraft] = useState<CuratedDraft>(emptyDraft);
  const [takeawayText, setTakeawayText] = useState("");
  const [topicInput, setTopicInput] = useState("");
  const [drafts, setDrafts] = useState<CuratedDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [sortKey, setSortKey] = useState<"displayDate" | "updatedAt">("displayDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const canSubmit = Boolean(draft.title.trim() && draft.cardSummary.trim() && draft.displayDate && draft.body.trim());
  const previewTakeaways = useMemo(() => draft.takeawayFormat === "simple" ? parseSimpleTakeaways(takeawayText) : [], [draft.takeawayFormat, takeawayText]);
  const sortedDrafts = useMemo(() => [...drafts].sort((a, b) => {
    const comparison = a[sortKey].localeCompare(b[sortKey]);
    return sortDirection === "asc" ? comparison : -comparison;
  }), [drafts, sortDirection, sortKey]);

  useEffect(() => {
    void fetch("./infohub-config.json", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ submissionApiUrl?: string }> : null)
      .then((config) => setApiUrl(config?.submissionApiUrl?.replace(/\/$/, "") ?? ""))
      .catch(() => setMessage("无法读取管理员服务地址"));
  }, []);

  useEffect(() => {
    if (!apiUrl || !token) return;
    void loadDrafts();
    // loadDrafts reads only the two values listed below and is intentionally kept as an action helper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl, token]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    if (!apiUrl || !password) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await gatewayFetch(`${apiUrl}/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json() as { token?: string; error?: string };
      if (!response.ok || !result.token) throw new Error(result.error ?? "登录失败");
      window.localStorage.setItem("infohub-admin-token", result.token);
      setToken(result.token);
      setPassword("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  async function loadDrafts() {
    try {
      const response = await gatewayFetch(`${apiUrl}/curated/list`, { headers: { authorization: `Bearer ${token}` } });
      if (response.status === 401) return logout();
      const result = await response.json() as { drafts?: CuratedDraft[]; error?: string };
      if (response.status === 404) {
        const publicResponse = await fetch("./generated-curated.json", { cache: "no-store" });
        const publicItems = publicResponse.ok ? await publicResponse.json() as Record<string, unknown>[] : [];
        setDrafts(publicItems.map(publicItemToDraft).filter((item): item is CuratedDraft => Boolean(item)));
        setMessage("当前为本地预览；发布服务上线后可进行隐藏、恢复和正式发布操作。");
        return;
      }
      if (!response.ok) throw new Error(result.error ?? "读取失败");
      setDrafts((result.drafts ?? []).map((item) => ({ ...item, topics: Array.isArray(item.topics) ? item.topics : [], takeawayFormat: item.takeawayFormat === "markdown" ? "markdown" : "simple" })));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取失败");
    }
  }

  function logout() {
    window.localStorage.removeItem("infohub-admin-token");
    setToken("");
    setDrafts([]);
  }

  function newDraft() {
    setDraft(emptyDraft());
    setTakeawayText("");
    setTopicInput("");
    setMessage("");
    setEditorOpen(true);
  }

  function editDraft(item: CuratedDraft) {
    setDraft(item);
    setTakeawayText(item.takeawayRaw || item.takeaways.join("\n"));
    setTopicInput("");
    setMessage("");
    setEditorOpen(true);
  }

  function addTopic(rawValue = topicInput) {
    const nextTopics = rawValue.split(/[，,]/).map((value) => value.trim()).filter(Boolean);
    if (nextTopics.length === 0) return;
    setDraft({ ...draft, topics: [...new Set([...draft.topics, ...nextTopics])].slice(0, 2) });
    setTopicInput("");
  }

  function toggleSort(key: "displayDate" | "updatedAt") {
    if (sortKey === key) setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    else {
      setSortKey(key);
      setSortDirection("desc");
    }
  }

  async function save(status: "draft" | "publish") {
    if (!canSubmit) return setMessage("请完整填写标题、卡片摘要、展示日期和正文");
    setBusy(true);
    setMessage(status === "publish" ? "正在发布……" : "正在保存……");
    const payload = { ...draft, takeaways: previewTakeaways, takeawayRaw: takeawayText.trim(), updatedAt: new Date().toISOString() };
    try {
      const response = await gatewayFetch(`${apiUrl}/curated/${status === "publish" ? "publish" : "save"}`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { draft?: CuratedDraft; error?: string };
      if (response.status === 401) return logout();
      if (!response.ok || !result.draft) throw new Error(result.error ?? "操作失败");
      setDraft(result.draft);
      setTakeawayText(result.draft.takeawayRaw || result.draft.takeaways.join("\n"));
      setMessage(status === "publish" ? (result.draft.status === "scheduled" ? "发布成功，将在设定日期展示" : "发布成功") : "草稿已保存");
      await loadDrafts();
      if (status === "publish") {
        setPreviewOpen(false);
        setEditorOpen(false);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function restore(item: CuratedDraft) {
    if (!window.confirm(`确定恢复展示《${item.title}》吗？`)) return;
    setDraft(item);
    setTakeawayText(item.takeawayRaw || item.takeaways.join("\n"));
    setBusy(true);
    setMessage("正在恢复展示……");
    try {
      const response = await gatewayFetch(`${apiUrl}/curated/publish`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ ...item, updatedAt: new Date().toISOString() }),
      });
      const result = await response.json() as { draft?: CuratedDraft; error?: string };
      if (!response.ok || !result.draft) throw new Error(result.error ?? "恢复失败");
      setMessage(result.draft.status === "scheduled" ? "已恢复，将在设定日期展示" : "已恢复展示");
      await loadDrafts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "恢复失败");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDraft(item: CuratedDraft) {
    if (!window.confirm(`确定永久删除草稿《${item.title}》吗？此操作不能撤销。`)) return;
    setBusy(true);
    try {
      const response = await gatewayFetch(`${apiUrl}/curated/delete`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "删除失败");
      setMessage("草稿已删除");
      await loadDrafts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(item: CuratedDraft) {
    if (!window.confirm(`确定撤回《${item.title}》吗？`)) return;
    setBusy(true);
    try {
      const response = await gatewayFetch(`${apiUrl}/curated/unpublish`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "撤回失败");
      setMessage("内容已撤回");
      await loadDrafts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "撤回失败");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return <main className="curated-admin-login"><form onSubmit={login}><div className="brand-mark">I</div><p>InfoHub 编辑后台</p><h1>管理员登录</h1><label>管理员密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" autoFocus /></label><button disabled={busy || !password}>{busy ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}验证身份</button>{message && <span className="admin-message">{message}</span>}</form></main>;
  }

  return <main className="curated-admin-shell">
    <aside className="admin-navigation">
      <div className="admin-brand"><span className="brand-mark">I</span><div><small>InfoHub</small><strong>管理后台</strong></div></div>
      <nav><button className="active"><LayoutList size={19} /><span>发布文章</span></button></nav>
      <div className="admin-nav-placeholder"><Plus size={16} /><span>其他管理功能<br />后续在这里增加</span></div>
      <button className="admin-logout" onClick={logout}><LogOut size={17} />退出登录</button>
    </aside>
    <section className="admin-workspace">
      <header className="admin-list-header"><div><p>内容管理</p><h1>发布文章</h1><span>管理已经发布、计划展示和正在编辑的精选文章。</span></div><button className="primary" onClick={newDraft}><Plus size={19} />新增文章</button></header>
      <div className="admin-stat-row"><article><span>全部文章</span><strong>{drafts.length}</strong></article><article><span>展示中</span><strong>{drafts.filter((item) => item.status === "live" || item.status === "scheduled").length}</strong></article><article><span>草稿</span><strong>{drafts.filter((item) => item.status === "draft").length}</strong></article><article><span>已隐藏</span><strong>{drafts.filter((item) => item.status === "withdrawn").length}</strong></article></div>
      {message && <p className="admin-message list-message">{message}</p>}
      <section className="admin-table-card">
        <header><strong>精选文章</strong><button onClick={() => void loadDrafts()}>刷新数据</button></header>
        {drafts.length === 0 ? (
          <div className="admin-empty">
            <FileText size={26} />
            <h2>还没有精选文章</h2>
            <p>点击右上角“新增文章”创建第一篇内容。</p>
          </div>
        ) : (
          <div className="admin-table-scroll">
            <table>
              <thead>
                <tr>
                  <th className="date-column">
                    <button className={sortKey === "displayDate" ? "active" : ""} onClick={() => toggleSort("displayDate")}>
                      展示日期{sortKey === "displayDate" ? sortDirection === "desc" ? <ArrowDown size={14} /> : <ArrowUp size={14} /> : null}
                    </button>
                  </th>
                  <th>标题</th>
                  <th>Summary</th>
                  <th>主题</th>
                  <th>类型</th>
                  <th>状态</th>
                  <th className="updated-column">
                    <button className={sortKey === "updatedAt" ? "active" : ""} onClick={() => toggleSort("updatedAt")}>
                      最后更新{sortKey === "updatedAt" ? sortDirection === "desc" ? <ArrowDown size={14} /> : <ArrowUp size={14} /> : null}
                    </button>
                  </th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedDrafts.map((item) => (
                  <tr key={item.id}>
                    <td className="admin-date-cell">
                      <strong>{item.displayDate}</strong>
                    </td>
                    <td className="admin-title-cell"><strong>{item.title}</strong>{item.error && <em>{item.error}</em>}</td>
                    <td className="admin-summary-cell"><div className="admin-summary-text">{item.cardSummary}</div></td>
                    <td><div className="topic-list">{item.topics.length > 0 ? item.topics.map((topic) => <span key={topic}>{topic}</span>) : <small>未设置</small>}</div></td>
                    <td><span className="type-chip">{typeLabel[item.type]}</span></td>
                    <td><span className={`status status-${item.status}`}>{statusLabel[item.status]}</span></td>
                    <td className="admin-updated-cell">{formatUpdatedAt(item.updatedAt)}</td>
                    <td>
                      <div className="table-actions">
                        <button title="预览" onClick={() => { editDraft(item); setEditorOpen(false); setPreviewOpen(true); }}><Eye size={16} /></button>
                        <button title="编辑" onClick={() => editDraft(item)}><Pencil size={16} /></button>
                        {item.status === "live" || item.status === "scheduled" ? (
                          <button title="隐藏" onClick={() => void withdraw(item)}><EyeOff size={16} /></button>
                        ) : item.status === "withdrawn" ? (
                          <button title="恢复展示" onClick={() => void restore(item)}><RotateCcw size={16} /></button>
                        ) : (
                          <button className="danger" title="删除草稿" onClick={() => void deleteDraft(item)}><Trash2 size={16} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
    {editorOpen && <div className="admin-editor-backdrop" role="dialog" aria-modal="true">
      <section className="curated-editor admin-editor-modal">
        <div className="editor-title"><div><p>{draft.status === "draft" && !draft.title ? "新增文章" : "编辑文章"}</p><h1>{draft.title || "新建精选"}</h1></div><button className="modal-close" onClick={() => setEditorOpen(false)} aria-label="关闭"><X size={20} /></button></div>
        <div className="editor-grid">
          <label className="field-full"><span>标题 *</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="粘贴文章标题" /></label>
          <label className="field-full"><span>卡片摘要 *</span><textarea rows={3} value={draft.cardSummary} onChange={(event) => setDraft({ ...draft, cardSummary: event.target.value })} placeholder="用 2—3 句话告诉用户这篇内容讲什么、为什么值得读" /></label>
          <label><span>展示日期 *</span><input type="date" value={draft.displayDate} onChange={(event) => setDraft({ ...draft, displayDate: event.target.value })} /></label>
          <label><span>类型 *</span><select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as ArticleType })}><option value="podcast">播客</option><option value="video">视频</option><option value="article">文章</option></select></label>
          <div className="field-full topic-editor"><span>主题</span><div className="topic-input-row"><Tag size={17} /><input value={topicInput} disabled={draft.topics.length >= 2} onChange={(event) => setTopicInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === "," || event.key === "，") { event.preventDefault(); addTopic(); } }} onBlur={() => addTopic()} placeholder={draft.topics.length >= 2 ? "每篇最多设置 2 个主题" : "输入主题后按回车，例如：AI 相关"} /><button type="button" disabled={draft.topics.length >= 2} onClick={() => addTopic()}>添加</button></div>{draft.topics.length > 0 && <div className="topic-list editable">{draft.topics.map((topic) => <button type="button" key={topic} onClick={() => setDraft({ ...draft, topics: draft.topics.filter((value) => value !== topic) })}>{topic}<X size={13} /></button>)}</div>}<small>完全由你手动填写，每篇建议 1—2 个宽泛主题，例如“AI 相关”“健康相关”。</small></div>
          <div className="field-full takeaway-editor-field">
            <div className="takeaway-editor-heading"><span>Takeaways</span><div className="takeaway-format-picker" role="radiogroup" aria-label="Takeaway 输入格式"><button type="button" className={draft.takeawayFormat === "simple" ? "active" : ""} onClick={() => setDraft({ ...draft, takeawayFormat: "simple" })}>简单输入</button><button type="button" className={draft.takeawayFormat === "markdown" ? "active" : ""} onClick={() => setDraft({ ...draft, takeawayFormat: "markdown" })}>Markdown</button></div></div>
            <textarea rows={draft.takeawayFormat === "markdown" ? 16 : 7} value={takeawayText} onChange={(event) => setTakeawayText(event.target.value)} placeholder={draft.takeawayFormat === "markdown" ? "直接粘贴 Markdown 内容，标题、加粗、列表、段落和分隔线会原样渲染" : "每行填写一条，系统会自动显示 1、2、3……"} />
            <small>{draft.takeawayFormat === "markdown" ? "Markdown 会按原结构安全渲染；原始 HTML 不会执行。" : "一行就是一条，不需要自己输入序号。"}</small>
          </div>
          <label className="field-full"><span>正文 *</span><textarea rows={18} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder={'直接粘贴处理好的正文。段落之间空一行；小标题单独占一行。'} /><small>无需 Markdown。空行会自动分段，简短的独立行会显示为小标题。</small></label>
          <label className="field-full"><span>来源链接（选填）</span><input type="url" value={draft.sourceUrl ?? ""} onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })} placeholder="https://...（播客、视频或原文章链接）" /></label>
        </div>
        <div className="editor-actions"><button className="secondary" onClick={() => setEditorOpen(false)}>取消</button><button className="secondary" disabled={busy || !canSubmit} onClick={() => void save("draft")}><FileText size={18} />保存草稿</button><button className="primary" disabled={!canSubmit} onClick={() => { setEditorOpen(false); setPreviewOpen(true); }}><Eye size={18} />预览文章</button></div>
      </section>
    </div>}
    {previewOpen && <div className="admin-preview-backdrop" role="dialog" aria-modal="true"><article className="admin-preview"><button className="preview-close" onClick={() => setPreviewOpen(false)} aria-label="关闭"><X /></button><div className="preview-meta">{draft.displayDate} · {typeLabel[draft.type]}</div><h1>{draft.title}</h1><p className="preview-summary">{draft.cardSummary}</p>{takeawayText.trim() && (draft.takeawayFormat === "markdown" ? <MarkdownTakeaway value={takeawayText} /> : <section className="takeaway-preview"><h2>Takeaway</h2><ol>{previewTakeaways.map((item) => <li key={item}>{item}</li>)}</ol></section>)}<section><h2>阅读原文</h2>{bodyBlocks(draft.body).map((block, index) => block.length <= 30 && !/[。！？.!?]$/.test(block) ? <h3 key={`${block}-${index}`}>{block}</h3> : <p key={`${block}-${index}`}>{block}</p>)}</section>{draft.sourceUrl && <a href={draft.sourceUrl} target="_blank" rel="noreferrer">跳转来源</a>}<footer className="preview-actions"><button onClick={() => { setPreviewOpen(false); setEditorOpen(true); }}><Pencil size={17} />返回修改</button><button className="primary" disabled={busy} onClick={() => void save("publish")}><Send size={17} />确认发布</button></footer></article></div>}
  </main>;
}
