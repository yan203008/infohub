import { env } from "cloudflare:workers";
import { jsonrepair } from "jsonrepair";

export type ManualContentType = "youtube" | "podcast" | "article";

export type ProcessedManualContent = {
  externalId: string;
  source: {
    id: string;
    type: "youtube" | "podcast" | "daily";
    name: string;
    url: string;
  };
  title: string;
  sourceUrl: string;
  summary: string;
  publishedAt: string;
  keywords: string[];
  body: Record<string, unknown>;
};

export type ManualExtraction = { title: string; text: string };

type JsonRecord = Record<string, unknown>;

const runtimeEnv = () => env as unknown as Record<string, string | undefined>;

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? value as JsonRecord : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asStrings(value: unknown) {
  return Array.isArray(value)
    ? value.map(asString).filter(Boolean)
    : [];
}

function youtubeVideoId(url: string) {
  return url.match(/[?&]v=([\w-]{11})/)?.[1]
    ?? url.match(/youtu\.be\/([\w-]{11})/)?.[1]
    ?? url.match(/shorts\/([\w-]{11})/)?.[1];
}

function transcriptText(payload: JsonRecord) {
  if (typeof payload.content === "string") return payload.content;
  if (!Array.isArray(payload.content)) return "";
  const stamp = (milliseconds: unknown) => {
    const total = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
    return `${String(Math.floor(total / 3600)).padStart(2, "0")}:${String(Math.floor((total % 3600) / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };
  return payload.content.map((raw) => {
    const chunk = asRecord(raw);
    const start = Number(chunk.offset || 0);
    const end = start + Number(chunk.duration || 0);
    return `[${stamp(start)} → ${stamp(end)}] ${asString(chunk.text)}`;
  }).filter(Boolean).join("\n");
}

async function supadataTranscript(url: string) {
  const apiKey = runtimeEnv().SUPADATA_API_KEY?.trim();
  if (!apiKey) throw new Error("Supadata API Key 未配置");
  const endpoint = new URL("https://api.supadata.ai/v1/transcript");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("text", "false");
  endpoint.searchParams.set("chunkSize", "2000");
  endpoint.searchParams.set("mode", "auto");
  const headers = { "x-api-key": apiKey };
  const response = await fetch(endpoint, { headers });
  const payload = asRecord(await response.json().catch(() => ({})));
  if (!response.ok) throw new Error(`Supadata 获取文字稿失败（${response.status}）`);
  const immediate = transcriptText(payload);
  if (immediate) return immediate;
  const jobId = asString(payload.jobId);
  if (!jobId) throw new Error("Supadata 没有返回文字稿任务编号");
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(2_000);
    const result = await fetch(`https://api.supadata.ai/v1/transcript/${encodeURIComponent(jobId)}`, { headers });
    const resultPayload = asRecord(await result.json().catch(() => ({})));
    const text = transcriptText(resultPayload);
    if (text) return text;
    if (!result.ok && result.status !== 202) {
      throw new Error(`Supadata 文字稿任务失败（${result.status}）`);
    }
  }
  throw new Error("Supadata 获取文字稿超时");
}

async function getNoteRequest(path: string, init?: RequestInit) {
  const values = runtimeEnv();
  const apiKey = values.GETNOTE_API_KEY?.trim();
  const clientId = values.GETNOTE_CLIENT_ID?.trim();
  if (!apiKey || !clientId) throw new Error("Get笔记 API Key 或 Client ID 未配置");
  const base = (values.GETNOTE_API_URL || "https://openapi.biji.com")
    .replace(/\/$/, "")
    .replace(/\/open(?:\/api\/v1)?$/, "");
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "x-client-id": clientId,
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const payload = asRecord(await response.json().catch(() => ({})));
  if (!response.ok || payload.success === false) {
    const error = asRecord(payload.error);
    throw new Error(asString(error.reason) || asString(error.message) || `Get笔记请求失败（${response.status}）`);
  }
  return payload;
}

function getNoteTaskId(data: unknown) {
  const record = asRecord(data);
  const direct = asString(record.task_id);
  if (direct) return direct;
  const first = Array.isArray(record.tasks) ? asRecord(record.tasks[0]) : {};
  return asString(first.task_id);
}

async function getNoteContent(url: string, requestId: string) {
  const saved = await getNoteRequest("/open/api/v1/resource/note/save", {
    method: "POST",
    body: JSON.stringify({
      note_type: "link",
      link_url: url,
      tags: ["InfoHub"],
      client_request_id: requestId,
    }),
  });
  let noteId = "";
  const taskId = getNoteTaskId(saved.data);
  if (taskId) {
    for (let attempt = 0; attempt < 45; attempt += 1) {
      await sleep(2_000);
      const progress = await getNoteRequest("/open/api/v1/resource/note/task/progress", {
        method: "POST",
        body: JSON.stringify({ task_id: taskId }),
      });
      const data = asRecord(progress.data);
      const status = asString(data.status);
      if (status === "failed") throw new Error(asString(data.error_msg) || asString(data.msg) || "Get笔记提取失败");
      if (status === "done" || status === "success") {
        noteId = asString(data.note_id);
        break;
      }
    }
  } else {
    noteId = asString(asRecord(saved.data).note_id) || asString(asRecord(saved.data).id);
  }
  if (!noteId) throw new Error("Get笔记处理超时或未返回笔记编号");
  const detail = await getNoteRequest(`/open/api/v1/resource/note/detail?id=${encodeURIComponent(noteId)}`);
  const note = asRecord(asRecord(detail.data).note);
  const webPage = asRecord(note.web_page);
  const audio = asRecord(note.audio);
  const original = asString(audio.original)
    || asString(webPage.content)
    || asString(note.web_content)
    || asString(note.audio_original)
    || asString(note.content);
  if (!original) throw new Error("Get笔记已完成，但没有返回可用的原文或文字稿");
  return {
    title: asString(note.title),
    text: original,
  };
}

async function fetchArticleFallback(url: string) {
  const response = await fetch(url, { headers: { "user-agent": "InfoHub/1.0" } });
  if (!response.ok) throw new Error(`文章页面无法读取（${response.status}）`);
  const html = await response.text();
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    ?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "精选文章";
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 200) throw new Error("文章正文过短，无法整理");
  return { title, text };
}

async function fetchPageTitle(url: string) {
  try {
    const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 InfoHub/1.0" } });
    if (!response.ok) return "";
    const html = await response.text();
    const title = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1]
      ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    return (title ?? "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
      .replace(/<[^>]+>/g, "")
      .trim();
  } catch {
    return "";
  }
}

async function kimiJson(system: string, input: unknown, maxTokens = 12_000) {
  const values = runtimeEnv();
  const apiKey = values.MOONSHOT_API_KEY?.trim();
  if (!apiKey) throw new Error("Moonshot API Key 未配置");
  const base = (values.MOONSHOT_BASE_URL || "https://api.moonshot.cn/v1").replace(/\/$/, "");
  const models = [...new Set([values.MOONSHOT_EDITOR_MODEL || "kimi-k2.5", "moonshot-v1-128k"])];
  let response: Response | undefined;
  let payload: JsonRecord = {};
  let responseContent = "";
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const model = models[Math.min(Math.floor((attempt - 1) / 2), models.length - 1)];
    response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        ...(model === "kimi-k3" ? { reasoning_effort: "low" } : {}),
        ...(model === "kimi-k2.5" ? { thinking: { type: "disabled" } } : {}),
        temperature: model === "kimi-k2.5" ? 0.6 : 1,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(input) },
        ],
      }),
    });
    payload = asRecord(await response.json().catch(() => ({})));
    if (response.ok) {
      const attemptChoices = Array.isArray(payload.choices) ? payload.choices : [];
      responseContent = asString(asRecord(asRecord(attemptChoices[0]).message).content);
      if (responseContent) break;
      if (attempt < 4) {
        await sleep(attempt * 1_500);
        continue;
      }
      throw new Error("Kimi 多次未返回正文，请稍后重试");
    }
    if (attempt < 4 && (response.status === 429 || response.status >= 500)) {
      await sleep(attempt * 1_500);
      continue;
    }
    const apiError = asRecord(payload.error);
    throw new Error(asString(apiError.message) || `Kimi 加工失败（${response.status}）`);
  }
  if (!response?.ok) throw new Error("Kimi 暂时不可用，请稍后重试");
  const content = responseContent
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  if (!content) throw new Error("Kimi 没有返回加工结果");
  try {
    return asRecord(JSON.parse(content));
  } catch {
    return asRecord(JSON.parse(jsonrepair(content)));
  }
}

function splitText(text: string, size = 20_000) {
  const chunks: string[] = [];
  for (let cursor = 0; cursor < text.length && chunks.length < 8; cursor += size) {
    chunks.push(text.slice(cursor, cursor + size));
  }
  return chunks;
}

async function processWithKimi(type: ManualContentType, originalTitle: string, text: string) {
  const chunks = splitText(text);
  const results: JsonRecord[] = [];
  const format = `只返回 JSON：{"title":"中文标题","summary":"2-3句具体摘要","keywords":["关键词"],"takeaways":["可行动或值得记住的结论"],"sections":[{"title":"章节标题","timeRange":"若原文有时间戳则填写，否则留空","paragraphs":["完整、适合阅读的中文段落"]}]}`;
  const instruction = type === "youtube" || type === "podcast"
    ? `你是长内容编辑。把文字稿忠实整理为中文阅读文章。
这不是摘要任务，不得将整段内容压缩成概览。要保留论点、论据、案例、对话中的具体经历、步骤、条件、例外、数据和重要细节，只删除口头禅、无信息量的寒暄与连续重复。
对每个输入片段，通常输出 6–12 个有实质内容的章节，每章 2–5 个完整段落；不要用几句概括代替详细转述。标题、时间戳和内容必须与原文一致，不得猜测或添加材料外的信息。
Takeaways 必须放在文章前。${format}`
    : `你是中文内容编辑。把原文整理成忠实、清晰、适合精读的文章，保留关键事实、论证、例子和限制，不添加原文没有的信息。${format}`;
  for (let index = 0; index < chunks.length; index += 1) {
    results.push(await kimiJson(instruction, {
      originalTitle,
      part: index + 1,
      totalParts: chunks.length,
      text: chunks[index],
    }));
  }
  const allSections = results.flatMap((result) => Array.isArray(result.sections) ? result.sections : []);
  if (allSections.length === 0) throw new Error("AI 加工结果缺少正文段落");
  const combined = chunks.length === 1
    ? results[0]
    : await kimiJson(
      `根据各部分的摘要生成整篇内容的中文标题、简短的 2-3 句摘要（总长度 120-180 个中文字）、5-8个关键词和 6 条 Takeaways。不要添加材料外信息。只返回 JSON：{"title":"","summary":"","keywords":[],"takeaways":[]}`,
      results.map((result) => ({
        title: result.title,
        summary: result.summary,
        keywords: result.keywords,
        takeaways: result.takeaways,
      })),
      2_500,
    );
  return {
    title: asString(combined.title) || asString(results[0]?.title) || originalTitle,
    summary: asString(combined.summary) || asString(results[0]?.summary),
    keywords: asStrings(combined.keywords).length ? asStrings(combined.keywords) : asStrings(results[0]?.keywords),
    takeaways: asStrings(combined.takeaways).length ? asStrings(combined.takeaways) : results.flatMap((result) => asStrings(result.takeaways)),
    sections: allSections.map((raw) => {
      const section = asRecord(raw);
      return {
        title: asString(section.title) || "正文",
        timeRange: asString(section.timeRange),
        paragraphs: asStrings(section.paragraphs),
      };
    }).filter((section) => section.paragraphs.length > 0),
  };
}

function shanghaiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function processManualContent(
  id: string,
  url: string,
  type: ManualContentType,
  options: {
    onStep?: (step: "extract" | "ai" | "quality" | "publish") => Promise<void>;
    cachedExtraction?: ManualExtraction;
    onExtracted?: (extraction: ManualExtraction) => Promise<void>;
  } = {},
): Promise<ProcessedManualContent> {
  await options.onStep?.("extract");
  let extracted = options.cachedExtraction;
  if (!extracted && type === "youtube") {
    const videoId = youtubeVideoId(url);
    if (!videoId) throw new Error("无法识别 YouTube 视频编号");
    const metadataResponse = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    const metadata = asRecord(await metadataResponse.json().catch(() => ({})));
    try {
      extracted = { title: asString(metadata.title) || "YouTube 视频", text: await supadataTranscript(url) };
    } catch (supadataError) {
      try {
        extracted = await getNoteContent(url, id);
      } catch {
        throw supadataError;
      }
    }
  } else if (!extracted && type === "podcast") {
    extracted = await getNoteContent(url, id);
    const originalTitle = await fetchPageTitle(url);
    if (originalTitle) extracted = { ...extracted, title: originalTitle };
  } else if (!extracted) {
    try {
      extracted = await fetchArticleFallback(url);
    } catch {
      extracted = await getNoteContent(url, id);
    }
  }
  if (!extracted) throw new Error("没有获得可处理的原文或文字稿");
  await options.onExtracted?.(extracted);

  await options.onStep?.("ai");
  const processed = await processWithKimi(type, extracted.title, extracted.text);
  await options.onStep?.("quality");
  if (!processed.title || !processed.summary || processed.sections.length === 0) {
    throw new Error("质量检查未通过：标题、摘要或正文不完整");
  }

  const now = new Date();
  const sourceType = type === "youtube" ? "youtube" : type === "podcast" ? "podcast" : "daily";
  const section = type === "youtube" ? "youtube" : type === "podcast" ? "podcasts" : "reading";
  const sourceName = type === "youtube" ? "管理员精选 YouTube" : type === "podcast" ? "管理员精选播客" : "管理员精选文章";
  const digestDate = shanghaiDate();
  await options.onStep?.("publish");
  return {
    externalId: id,
    source: {
      id: `manual-${type}`,
      type: sourceType,
      name: sourceName,
      url: `https://infohub.local/manual/${type}`,
    },
    title: extracted.title || processed.title,
    sourceUrl: url,
    summary: processed.summary,
    publishedAt: now.toISOString(),
    keywords: processed.keywords.slice(0, 12),
    body: {
      section,
      digestDate,
      publishedDate: new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(now),
      time: "刚刚处理",
      readTime: "深度阅读",
      accent: type === "youtube" ? "violet" : type === "podcast" ? "orange" : "green",
      inRecentWindow: true,
      originalTitle: extracted.title,
      paragraphs: [],
      takeaways: processed.takeaways,
      sections: processed.sections,
      externalLinks: [{ label: "查看原始内容", url }],
    },
  };
}
