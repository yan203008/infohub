"use client";

import {
  ArrowLeft,
  Check,
  ChevronDown,
  CircleAlert,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  Plus,
  Radio,
  Save,
  Sparkles,
  Trash2,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

type SourceType = "youtube" | "podcast" | "daily" | "builder" | "wechat";
type Source = {
  id: string;
  type: SourceType;
  name: string;
  url: string;
  enabled: boolean;
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
  const [type, setType] = useState<SourceType>("youtube");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [settings, setSettings] = useState({
    aiProvider: "kimi",
    aiBaseUrl: "https://api.moonshot.cn/v1",
    aiModel: "kimi-k2.6",
    digestTime: "08:00",
    articlePrompt:
      "将字幕整理成结构清晰、忠于原意的中文文章，删除口语赘词，保留关键论据与案例。",
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
      };
      setSources(data.sources);
      setSettings((current) => ({ ...current, ...data.settings }));
    } catch {
      setMessage("暂时无法读取配置，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(payload: unknown) {
    const response = await fetch("/api/admin/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      throw new Error(body.error ?? "保存失败");
    }
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

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <a href="/" aria-label="返回 InfoHub">
          <ArrowLeft size={19} />
        </a>
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
            采集服务等待 API Key
          </div>
        </section>

        {message && (
          <div className="admin-message">
            <Check size={16} />
            {message}
          </div>
        )}

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
                  文章整理 Prompt
                  <textarea
                    value={settings.articlePrompt}
                    onChange={(event) =>
                      setSettings({ ...settings, articlePrompt: event.target.value })
                    }
                  />
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
              <div className="secret-row">
                <span><CircleAlert size={16} /> Kimi / Moonshot API</span>
                <b>待配置</b>
              </div>
              <div className="secret-row">
                <span><CircleAlert size={16} /> Supadata API</span>
                <b>待配置</b>
              </div>
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
