"use client";

import {
  ArrowLeft,
  Check,
  ChevronDown,
  CircleAlert,
  ExternalLink,
  KeyRound,
  Link2,
  LoaderCircle,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { youtubeProcessingPrompt } from "../../lib/youtube-processing-prompt";

type SourceType = "youtube" | "podcast" | "daily" | "builder" | "wechat";
type Source = {
  id: string;
  type: SourceType;
  name: string;
  url: string;
  enabled: boolean;
};

type RunStage = {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  detail: string;
};

type RunSource = {
  id: string;
  label: string;
  status: "completed" | "failed";
  itemCount: number;
  error?: string;
};

type RunSummary = {
  generatedAt: string;
  status: "running" | "completed" | "completed_with_errors" | "failed";
  itemCount: number;
  publishedCount: number;
  stages: RunStage[];
  sources: RunSource[];
};

type ProviderStatus = {
  moonshot: boolean;
  supadata: boolean;
  getnote: boolean;
};

type ManualSubmission = {
  id: string;
  url: string;
  type: "youtube" | "podcast" | "article";
  timing: "immediate" | "morning";
  status: "pending" | "processing" | "published" | "failed";
  createdAt: string;
  updatedAt: string;
  currentStep?: "extract" | "ai" | "quality" | "publish";
  error?: string;
  title?: string;
  contentId?: string;
};

const submissionStepLabels = {
  extract: "正在获取原文/文字稿",
  ai: "正在整理为可读文章",
  quality: "正在检查内容完整性",
  publish: "正在发布到主页",
};

const sourceLabels: Record<SourceType, string> = {
  youtube: "YouTube",
  podcast: "小宇宙 / 播客",
  daily: "技术日报",
  builder: "Follow Builders",
  wechat: "公众号",
};

export function AdminConsole({ adminName }: { adminName: string }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>({
    moonshot: false,
    supadata: false,
    getnote: false,
  });
  const [type, setType] = useState<SourceType>("youtube");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [submissionUrl, setSubmissionUrl] = useState("");
  const [submissionTiming, setSubmissionTiming] = useState<"immediate" | "morning">("immediate");
  const [submitting, setSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState<ManualSubmission[]>([]);
  const [processingIds, setProcessingIds] = useState<string[]>([]);
  const [settings, setSettings] = useState({
    aiProvider: "kimi",
    aiBaseUrl: "https://api.moonshot.cn/v1",
    aiModel: "kimi-k2.5",
    digestTime: "08:00",
    articlePrompt:
      "将字幕整理成结构清晰、忠于原意的中文文章，删除口语赘词，保留关键论据与案例。",
    youtubeArticlePrompt: youtubeProcessingPrompt,
    keywordPrompt: "提取 3–6 个最能代表内容主题的关键词。",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/config");
      if (!response.ok) throw new Error("管理配置读取失败");
      const data = (await response.json()) as {
        sources: Source[];
        settings: Record<string, string>;
        runSummary?: RunSummary;
        providerStatus?: ProviderStatus;
        submissions?: ManualSubmission[];
      };
      setSources(data.sources);
      setRunSummary(data.runSummary ?? null);
      if (data.providerStatus) setProviderStatus(data.providerStatus);
      setSubmissions(data.submissions ?? []);
      setSettings((current) => ({ ...current, ...data.settings }));
    } catch {
      setMessage("暂时无法读取配置，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function send<T = { ok: boolean }>(payload: unknown) {
    const response = await fetch("/api/admin/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as T & { error?: string };
    if (!response.ok) {
      throw new Error(body.error ?? "保存失败");
    }
    return body;
  }

  async function addSource(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await send({ action: "addSource", type, name, url });
      setName("");
      setUrl("");
      setMessage("信息源已添加");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "添加失败");
    } finally {
      setSaving(false);
    }
  }

  async function submitContent(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await send<{ ok: boolean; submission: ManualSubmission }>({
        action: "submitContent",
        url: submissionUrl,
        timing: submissionTiming,
      });
      setSubmissionUrl("");
      setSubmissions((current) => [result.submission, ...current]);
      setMessage(submissionTiming === "immediate"
        ? "链接已保存并开始处理，你可以继续提交下一条"
        : "链接已保存，将在明早随日报一起处理");
      setSubmitting(false);
      if (submissionTiming === "immediate") void processSubmissionInBackground(result.submission.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "链接提交失败");
      setSubmitting(false);
      await load();
    }
  }

  async function processSubmissionInBackground(id: string) {
    setProcessingIds((current) => [...new Set([...current, id])]);
    try {
      await send({ action: "processSubmission", id });
      setMessage("一条内容处理完成，已经发布到主页");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "内容处理失败");
    } finally {
      setProcessingIds((current) => current.filter((value) => value !== id));
      await load();
    }
  }

  async function scheduleSubmission(id: string) {
    try {
      await send({ action: "scheduleSubmission", id });
      setMessage("已改为明早随日报一起处理");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "设置失败");
    }
  }

  async function toggleSource(source: Source) {
    setSources((current) =>
      current.map((item) =>
        item.id === source.id ? { ...item, enabled: !item.enabled } : item,
      ),
    );
    try {
      await send({
        action: "toggleSource",
        id: source.id,
        enabled: !source.enabled,
      });
    } catch {
      await load();
      setMessage("状态更新失败");
    }
  }

  async function deleteSource(id: string) {
    try {
      await send({ action: "deleteSource", id });
      setSources((current) => current.filter((source) => source.id !== id));
      setMessage("信息源已删除");
    } catch {
      setMessage("删除失败");
    }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      await send({ action: "saveSettings", values: settings });
      setMessage("AI 与推送设置已保存");
    } catch {
      setMessage("设置保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function retrySource(source: string) {
    setSaving(true);
    try {
      await send({ action: "requestRetry", source });
      setMessage("已加入重试，下次采集会优先重新处理这个来源");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "重试请求失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Link href="/" aria-label="返回 InfoHub">
          <ArrowLeft size={19} />
        </Link>
        <div>
          <span>InfoHub</span>
          <small>管理后台</small>
        </div>
        <p>{adminName}</p>
      </header>

      <div className="admin-wrap">
        <section className="admin-intro">
          <div>
            <span>ADMIN CONSOLE</span>
            <h1>管理公共信息流</h1>
            <p>这里的配置决定所有读者每天看到和收到什么。</p>
          </div>
          <div className="admin-health">
            <i />
            YouTube 字幕采集已启用
          </div>
        </section>

        {message && (
          <div className="admin-message">
            <Check size={16} />
            {message}
          </div>
        )}

        <section className="admin-panel submission-panel">
          <div className="panel-heading">
            <div className="panel-icon purple"><Link2 size={19} /></div>
            <div>
              <h2>提交内容</h2>
              <p>粘贴 YouTube、小宇宙或文章链接</p>
            </div>
            <span>{submissions.length}</span>
          </div>
          <form className="submission-form" onSubmit={submitContent}>
            <label>
              内容链接
              <input
                inputMode="url"
                type="url"
                value={submissionUrl}
                onChange={(event) => setSubmissionUrl(event.target.value)}
                placeholder="https://..."
              />
            </label>
            <div className="submission-actions">
              <div className="submission-timing" role="radiogroup" aria-label="处理时间">
                <button
                  type="button"
                  className={submissionTiming === "immediate" ? "active" : ""}
                  onClick={() => setSubmissionTiming("immediate")}
                >现在处理</button>
                <button
                  type="button"
                  className={submissionTiming === "morning" ? "active" : ""}
                  onClick={() => setSubmissionTiming("morning")}
                >明早处理</button>
              </div>
              <button className="primary-button" disabled={submitting || !submissionUrl.trim()}>
                {submitting ? <LoaderCircle className="spin" size={18} /> : <Plus size={18} />}
                {submitting ? "正在保存" : "提交链接"}
              </button>
            </div>
          </form>
          <p className="submission-help">系统会自动识别内容类型。普通读者看不到这个入口，也不会接触你的 API Key。</p>
          {submissions.length > 0 && (
            <div className="submission-list">
              {submissions.slice(0, 5).map((submission) => (
                <div className="submission-row" key={submission.id}>
                  <span>{submission.type === "youtube" ? "YouTube" : submission.type === "podcast" ? "小宇宙" : "文章"}</span>
                  <div className="submission-copy">
                    <a href={submission.url} target="_blank" rel="noreferrer">{submission.title || submission.url}</a>
                    {submission.error && <em>{submission.error}</em>}
                  </div>
                  <small>
                    {submission.status === "pending"
                      ? submission.timing === "morning" ? "明早随日报处理" : "等待处理"
                      : submission.status === "processing"
                        ? submissionStepLabels[submission.currentStep ?? "extract"]
                        : submission.status === "published"
                          ? "已发布"
                          : "处理失败"}
                  </small>
                  {submission.status === "failed" && (
                    <div className="submission-row-actions">
                      <button
                        className="submission-retry"
                        disabled={processingIds.includes(submission.id)}
                        onClick={() => void processSubmissionInBackground(submission.id)}
                      >
                        {processingIds.includes(submission.id) ? "重试中" : "现在重试"}
                      </button>
                      <button className="submission-retry" onClick={() => void scheduleSubmission(submission.id)}>
                        明早处理
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="admin-panel workflow-panel">
          <div className="panel-heading workflow-heading">
            <div className="panel-icon"><RefreshCw size={19} /></div>
            <div>
              <h2>最近一次内容处理</h2>
              <p>
                {runSummary
                  ? `${new Date(runSummary.generatedAt).toLocaleString("zh-CN")} · ${runSummary.itemCount} 条内容`
                  : "尚未获得运行记录"}
              </p>
            </div>
            <span className={`run-badge ${runSummary?.status ?? "pending"}`}>
              {runSummary?.status === "running"
                ? "处理中"
                : runSummary?.status === "completed"
                  ? "已完成"
                  : runSummary?.status === "completed_with_errors"
                    ? "部分失败"
                    : runSummary?.status === "failed"
                      ? "失败"
                      : "等待"}
            </span>
          </div>

          <div className="workflow-stages">
            {(runSummary?.stages ?? [
              { id: "collect", label: "采集", status: "pending", detail: "等待处理" },
              { id: "summarize", label: "处理总结", status: "pending", detail: "等待处理" },
              { id: "quality", label: "质量检查", status: "pending", detail: "等待处理" },
              { id: "publish", label: "发布", status: "pending", detail: "等待处理" },
            ]).map((item, index) => (
              <div className={`workflow-stage ${item.status}`} key={item.id}>
                <span>{item.status === "completed" ? <Check size={16} /> : index + 1}</span>
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </div>
              </div>
            ))}
          </div>

          {runSummary && runSummary.sources.length > 0 && (
            <div className="run-sources">
              {runSummary.sources.map((source) => (
                <div className={`run-source ${source.status}`} key={source.id}>
                  <i />
                  <div>
                    <strong>{source.label}</strong>
                    <small>{source.error || `${source.itemCount} 条内容`}</small>
                  </div>
                  {source.status === "failed" && (
                    <button disabled={saving} onClick={() => void retrySource(source.id)}>
                      重试
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="admin-grid">
          <section className="admin-panel source-panel">
            <div className="panel-heading">
              <div className="panel-icon"><Radio size={19} /></div>
              <div>
                <h2>公共信息源</h2>
                <p>YouTube、播客与每日动态</p>
              </div>
              <span>{sources.length}</span>
            </div>

            <form className="source-form" onSubmit={addSource}>
              <label>
                类型
                <span className="select-wrap">
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value as SourceType)}
                  >
                    {Object.entries(sourceLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} />
                </span>
              </label>
              <label>
                显示名称
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例如：Latent Space"
                />
              </label>
              <label className="url-field">
                频道或节目链接
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://..."
                />
              </label>
              <button className="primary-button" disabled={saving}>
                {saving ? <LoaderCircle className="spin" size={18} /> : <Plus size={18} />}
                添加信息源
              </button>
            </form>

            <div className="source-list">
              {loading ? (
                <div className="empty-sources"><LoaderCircle className="spin" /></div>
              ) : sources.length === 0 ? (
                <div className="empty-sources">
                  <Video size={24} />
                  <p>还没有信息源，从上面添加第一个频道。</p>
                </div>
              ) : (
                sources.map((source) => (
                  <div className="source-row" key={source.id}>
                    <button
                      className={`switch ${source.enabled ? "on" : ""}`}
                      onClick={() => toggleSource(source)}
                      aria-label={source.enabled ? "停用信息源" : "启用信息源"}
                    >
                      <i />
                    </button>
                    <div>
                      <strong>{source.name}</strong>
                      <small>{sourceLabels[source.type]} · {source.url}</small>
                    </div>
                    <a href={source.url} target="_blank" rel="noreferrer" aria-label="打开链接">
                      <ExternalLink size={16} />
                    </a>
                    <button
                      className="delete-source"
                      onClick={() => deleteSource(source.id)}
                      aria-label="删除信息源"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <div className="admin-stack">
            <section className="admin-panel">
              <div className="panel-heading">
                <div className="panel-icon purple"><Sparkles size={19} /></div>
                <div>
                  <h2>AI 内容处理</h2>
                  <p>模型与文章整理规则</p>
                </div>
              </div>
              <div className="settings-form">
                <div className="two-fields">
                  <label>
                    服务商
                    <select
                      value={settings.aiProvider}
                      onChange={(event) =>
                        setSettings({ ...settings, aiProvider: event.target.value })
                      }
                    >
                      <option value="kimi">Kimi / Moonshot</option>
                      <option value="openai">OpenAI</option>
                      <option value="custom">OpenAI 兼容服务</option>
                    </select>
                  </label>
                  <label>
                    模型
                    <input
                      value={settings.aiModel}
                      onChange={(event) =>
                        setSettings({ ...settings, aiModel: event.target.value })
                      }
                    />
                  </label>
                </div>
                <label>
                  API Base URL
                  <input
                    value={settings.aiBaseUrl}
                    onChange={(event) =>
                      setSettings({ ...settings, aiBaseUrl: event.target.value })
                    }
                  />
                </label>
                <label>
                  YouTube 文字稿加工 Prompt
                  <textarea
                    className="prompt-editor"
                    value={settings.youtubeArticlePrompt}
                    onChange={(event) =>
                      setSettings({ ...settings, youtubeArticlePrompt: event.target.value })
                    }
                  />
                  <small>固定输出顺序：Takeaways 在前，完整阅读文章在后；不再询问用户二次选择。</small>
                </label>
                <label>
                  关键词 Prompt
                  <textarea
                    value={settings.keywordPrompt}
                    onChange={(event) =>
                      setSettings({ ...settings, keywordPrompt: event.target.value })
                    }
                  />
                </label>
              </div>
            </section>

            <section className="admin-panel secret-panel">
              <div className="panel-heading">
                <div className="panel-icon amber"><KeyRound size={19} /></div>
                <div>
                  <h2>密钥状态</h2>
                  <p>密钥只保存在服务器，不进入代码仓库</p>
                </div>
              </div>
              {[
                ["Kimi / Moonshot", providerStatus.moonshot],
                ["Supadata", providerStatus.supadata],
                ["Get笔记", providerStatus.getnote],
              ].map(([label, configured]) => (
                <div className={`secret-row ${configured ? "configured" : ""}`} key={String(label)}>
                  <span>{configured ? <Check size={16} /> : <CircleAlert size={16} />} {label}</span>
                  <b className={configured ? "configured" : ""}>{configured ? "已配置" : "未配置"}</b>
                </div>
              ))}
              <p className="secret-note">密钥值不会在管理后台显示。YouTube 文字稿可以在 Supadata 与 Get笔记之间切换。</p>
            </section>

            <button className="primary-button admin-save" onClick={saveSettings} disabled={saving}>
              {saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />}
              保存全部设置
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
