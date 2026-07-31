#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { jsonrepair } from "jsonrepair";

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const config = JSON.parse(await readFile(join(root, "config/sources.json"), "utf8"));
const isDryRun = process.argv.includes("--dry-run");
const now = new Date();
const cutoff = new Date(`${shanghaiDate(new Date(now.valueOf() - 24 * 60 * 60 * 1000))}T00:00:00+08:00`);
const runDigestDate = process.env.INFOHUB_DIGEST_DATE?.trim() || shanghaiDate(now);
const moonshotKey = process.env.MOONSHOT_API_KEY?.trim();
const moonshotBaseUrl = (process.env.MOONSHOT_BASE_URL || "https://api.kimi.com/coding/v1").replace(/\/$/, "");
const isKimiCode = moonshotBaseUrl.includes("api.kimi.com/coding");
let activeMoonshotModel = process.env.MOONSHOT_MODEL || (isKimiCode ? "k3-256k" : "kimi-k3");
const supadataKey = process.env.SUPADATA_API_KEY?.trim();
const summaryOnly = process.argv.includes("--summaries-only");

const sleep = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

const sourceLabels = {
  "follow-builders": "Follow Builders",
  "technical-x": "技术动态 X",
  papers: "热门论文",
  github: "GitHub Trending",
  youtube: "YouTube",
};

const sectionLabels = {
  x: "X 推特内容",
  papers: "热门论文",
  github: "GitHub Trending",
  youtube: "热门 YouTube",
  podcasts: "播客",
};

function shanghaiDate(value = now) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function recent(value) {
  const date = new Date(value);
  return !Number.isNaN(date.valueOf()) && date >= cutoff && date <= now;
}

function stripHtml(value = "") {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function reportSubsection(html, name) {
  const marker = `data-sub-content="${name}"`;
  const start = html.indexOf(marker);
  if (start === -1) return "";
  const next = html.indexOf('<div class="sub-content"', start + marker.length);
  return html.slice(start, next === -1 ? html.length : next);
}

function reportArticles(html, subsection) {
  return [...reportSubsection(html, subsection).matchAll(/<article class="article">([\s\S]*?)<\/article>/g)]
    .map((match) => match[1]);
}

function reportField(block, className) {
  return stripHtml(block.match(new RegExp(`<[^>]+class="${className}"[^>]*>([\\s\\S]*?)<\\/[^>]+>`))?.[1] || "");
}

function reportDate(value) {
  const match = value.match(/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/);
  if (!match) return now.toISOString();
  const [, month, day, hour, minute] = match;
  return new Date(`${now.getUTCFullYear()}-${month}-${day}T${hour}:${minute}:00+08:00`).toISOString();
}

function parseFollowBuildersReport(html) {
  return reportArticles(html, "follow-builders").flatMap((block) => {
    const link = block.match(/class="article-title">\s*<a href="([^"]+)"/)?.[1];
    const id = link?.match(/status\/(\d+)/)?.[1];
    const stats = reportField(block, "article-stats");
    const author = stats.split("·")[1]?.trim() || "unknown";
    const text = reportField(block, "article-excerpt");
    const createdAt = reportDate(reportField(block, "article-meta"));
    const likes = Number(stats.match(/([\d,]+) likes/)?.[1].replaceAll(",", "") || 0);
    if (!link || !id || !text) return [];
    return [{ id, url: link, text, createdAt, likes, builder: author, bio: "" }];
  });
}

async function curlGet(url, options = {}) {
  const headers = {
    "user-agent": "InfoHub-Collector/1.0",
    ...(options.headers || {}),
  };
  const args = ["--max-time", "30", "--silent", "--show-error", "--location"];
  for (const [name, value] of Object.entries(headers)) {
    args.push("--header", `${name}: ${value}`);
  }
  args.push("--write-out", "\n__INFOHUB_STATUS__%{http_code}", url);
  const { stdout } = await execFileAsync("curl", args, {
    cwd: root,
    maxBuffer: 1024 * 1024 * 30,
    timeout: 35_000,
  });
  const marker = "\n__INFOHUB_STATUS__";
  const markerIndex = stdout.lastIndexOf(marker);
  if (markerIndex === -1) throw new Error("curl response status missing");
  const body = stdout.slice(0, markerIndex);
  const status = Number(stdout.slice(markerIndex + marker.length));
  const response = new Response(body, { status });
  if (!response.ok) throw new Error(`${status} ${response.statusText}`);
  return response;
}

async function curlJsonPost(url, { headers = {}, body = "", timeoutMs = 240_000 } = {}) {
  const args = [
    "--max-time", String(Math.ceil(timeoutMs / 1000)),
    "--silent", "--show-error", "--location",
    "--request", "POST",
  ];
  for (const [name, value] of Object.entries(headers)) {
    args.push("--header", `${name}: ${value}`);
  }
  args.push("--data-binary", body, "--write-out", "\n__INFOHUB_STATUS__%{http_code}", url);
  let stdout;
  try {
    ({ stdout } = await execFileAsync("curl", args, {
      cwd: root,
      maxBuffer: 1024 * 1024 * 30,
      timeout: timeoutMs + 5_000,
    }));
  } catch {
    throw new Error("Moonshot request timed out or lost connection");
  }
  const marker = "\n__INFOHUB_STATUS__";
  const markerIndex = stdout.lastIndexOf(marker);
  if (markerIndex === -1) throw new Error("curl response status missing");
  const responseBody = stdout.slice(0, markerIndex);
  const status = Number(stdout.slice(markerIndex + marker.length));
  if (status < 200 || status >= 300) {
    let detail = "";
    try {
      const payload = JSON.parse(responseBody);
      detail = String(payload?.error?.message || payload?.message || payload?.error?.code || "")
        .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
        .slice(0, 240);
    } catch {
      detail = "";
    }
    const error = new Error(`Moonshot returned HTTP ${status}${detail ? `: ${detail}` : ""}`);
    error.status = status;
    throw error;
  }
  return JSON.parse(responseBody);
}

async function fetchWithRetry(url, options = {}, attempts = 2) {
  const { timeoutMs = 12_000, ...fetchOptions } = options;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          "user-agent": "InfoHub-Collector/1.0",
          ...(fetchOptions.headers || {}),
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 800));
    }
  }
  if (!fetchOptions.method || fetchOptions.method.toUpperCase() === "GET") {
    try {
      return await curlGet(url, fetchOptions);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function fetchJson(url, options) {
  return (await fetchWithRetry(url, options)).json();
}

async function kimiJson(system, input, { maxTokens = 5_000, timeoutMs = 240_000 } = {}) {
  if (!moonshotKey) throw new Error("MOONSHOT_API_KEY is not configured");
  const url = `${moonshotBaseUrl}/chat/completions`;
  const headers = {
    authorization: `Bearer ${moonshotKey}`,
    "content-type": "application/json",
  };
  const maximumAttempts = 5;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      const body = JSON.stringify({
        model: activeMoonshotModel,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        ...(isKimiCode ? { reasoning_effort: "low" } : { temperature: 1 }),
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(input) },
        ],
      });
      const payload = await curlJsonPost(url, { headers, body, timeoutMs });
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("Kimi returned an empty response");
      const jsonText = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      try {
        return JSON.parse(jsonText);
      } catch {
        return JSON.parse(jsonrepair(jsonText));
      }
    } catch (error) {
      const canUseStandardModel = isKimiCode
        && activeMoonshotModel !== "kimi-for-coding"
        && error?.status === 401
        && /does not have access|subscription.*access|model id does not exist/i.test(error?.message || "");
      if (canUseStandardModel) {
        console.warn(`[kimi] ${activeMoonshotModel} is unavailable for this subscription; switching to kimi-for-coding`);
        activeMoonshotModel = "kimi-for-coding";
        continue;
      }
      const retryable = error?.status === 429
        || error?.status >= 500
        || /timed out|lost connection|overloaded|繁忙/i.test(error?.message || "");
      if (!retryable || attempt === maximumAttempts) throw error;
      const delayMs = Math.min(90_000, 10_000 * (2 ** (attempt - 1))) + Math.floor(Math.random() * 2_000);
      console.warn(`[kimi] temporary failure (${attempt}/${maximumAttempts}): ${error.message}; retrying in ${Math.ceil(delayMs / 1000)}s`);
      await sleep(delayMs);
    }
  }
  throw new Error("Kimi retry loop ended unexpectedly");
}

async function kimiItems(system, inputs, { batchSize = 2, maxTokens = 3_500, concurrency = 2 } = {}) {
  const batches = [];
  for (let index = 0; index < inputs.length; index += batchSize) {
    batches.push(inputs.slice(index, index + batchSize));
  }
  const results = new Array(batches.length).fill(null);
  let cursor = 0;
  async function worker() {
    while (cursor < batches.length) {
      const batchIndex = cursor++;
      try {
        const processed = await kimiJson(system, batches[batchIndex], {
          maxTokens,
          timeoutMs: 3 * 60 * 1000,
        });
        results[batchIndex] = processed.items || [];
        console.log(`[kimi] batch ${batchIndex + 1}/${batches.length} completed`);
        await sleep(1_500);
      } catch (error) {
        results[batchIndex] = [];
        console.warn(`[kimi] batch ${batchIndex + 1}/${batches.length} skipped: ${error.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, () => worker()));
  return results.flat();
}

function baseBody(section, publishedAt, extra = {}) {
  return {
    section,
    digestDate: runDigestDate,
    publishedDate: new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      month: "numeric",
      day: "numeric",
    }).format(new Date(publishedAt)),
    time: "本次更新",
    readTime: "3 分钟",
    accent: section === "x" ? "green" : section === "papers" ? "violet" : section === "github" ? "blue" : "orange",
    inRecentWindow: true,
    ...extra,
  };
}

function fallbackSectionSummary(section, items) {
  const keywords = [...new Set(items.flatMap((item) => item.keywords || []))].slice(0, 5);
  const representativeItems = items.slice(0, 3);
  const sectionValue = {
    x: "帮助非技术读者了解一线 AI 从业者正在发布、争论和修正什么，并判断哪些变化可能影响日常使用与工作方式。",
    papers: "帮助非技术读者观察 AI 研究正在解决哪些现实问题，以及这些研究未来可能转化成怎样的产品能力。",
    github: "帮助非技术读者发现正在形成的开源工具和产品方向，判断哪些能力已从概念进入可以实际尝试的阶段。",
    youtube: "帮助读者先理解长内容的核心观点与适用对象，再决定是否投入时间精读。",
    podcasts: "帮助读者快速了解长对话中的核心议题、经验和判断，再决定是否深入阅读或收听。",
  };
  const overview = representativeItems
    .map((item) => `《${item.title}》${item.summary ? `：${item.summary}` : ""}`)
    .join("；")
    .slice(0, 420);
  return {
    section,
    label: sectionLabels[section] || section,
    overview: `本次收录 ${items.length} 条内容。${overview}`,
    trends: keywords.length > 0
      ? [`可先从${keywords.slice(0, 3).join("、")}几个方向了解本批内容；这是一份基于原始摘要的导读，具体判断以各条正文为准。`]
      : [],
    value: sectionValue[section] || "帮助读者快速理解本批内容的范围与可能价值，再自主决定是否深入阅读。",
    technicalLevel: section === "papers" || section === "github" ? "中高" : "中等",
    technicalPercentage: section === "papers" ? 65 : section === "github" ? 55 : 30,
  };
}

function sectionPrompt(section) {
  const sectionGuidance = {
    x: "这是 X 动态。请说明一线 AI Builder 今天具体在发布、讨论或争论什么，以及这些动态共同反映的产品或行业变化。",
    papers: "这是热门论文。请用非技术语言说明研究在解决什么问题、采用了什么新思路，以及它可能带来的现实能力；不要照抄论文摘要。",
    github: "这是 GitHub Trending。请说明这些项目能让人做什么、集中出现了哪些产品或开源趋势，以及非程序员为什么需要关注；不要复述 README。",
    youtube: "这是 YouTube 长内容。请说明核心议题、主要观点和适合阅读的人群。",
    podcasts: "这是播客长内容。请说明核心议题、嘉宾的关键判断和适合阅读的人群。",
  };
  return `你是面向关注 AI、但不是算法或研发人员的信息主编。${sectionGuidance[section] || "请写一份清楚、具体的板块导读。"}

根据输入中的标题、摘要和正文要点生成一张首页导读。不得筛选、排名或删除内容，不得补充输入之外的事实。

返回 JSON：{section,overview,trends,value,technicalLevel,technicalPercentage}。
- overview：55-90 个中文字，最多 3 句，只概括最重要的 2-3 个内容方向。不要罗列人名、项目名或逐条复述。
- trends：1-2 条，每条 25-45 个中文字，只写跨越多条内容才能得出的共同变化或差异。
- value：30-55 个中文字，只回答“非技术读者看完后能获得什么具体判断”，必须结合本批内容。
- technicalLevel：只能是低、中等、中高、高；technicalPercentage：0-100 整数。

禁止使用“先点击查看”“先通过标题判断”“主要涉及若干内容”“X 是主要主题”“具体内容以正文为准”等无信息量表达，也不要逐条重复标题。信息不足时直接说明能够确认的边界，不要猜测。`;
}

function summaryInput(item) {
  const takeaways = Array.isArray(item.body?.takeaways) ? item.body.takeaways.slice(0, 6) : [];
  const sections = Array.isArray(item.body?.sections)
    ? item.body.sections.slice(0, 5).map((entry) => `${entry.title || ""} ${entry.content || ""}`.trim().slice(0, 320))
    : [];
  const paragraphs = Array.isArray(item.body?.paragraphs) ? item.body.paragraphs.slice(0, 4) : [];
  const digestEntries = Array.isArray(item.body?.digestEntries)
    ? item.body.digestEntries.slice(0, 8).map((entry) => `${entry.builder || ""} ${entry.summary || entry.text || ""}`.trim().slice(0, 320))
    : [];
  return {
    title: item.title,
    summary: item.summary,
    keywords: item.keywords || [],
    keyPoints: [...takeaways, ...sections, ...paragraphs, ...digestEntries].filter(Boolean).slice(0, 10),
  };
}

function usefulSectionSummary(summary) {
  if (!summary || typeof summary !== "object") return false;
  const overview = String(summary.overview || "").trim();
  const value = String(summary.value || "").trim();
  const trends = Array.isArray(summary.trends) ? summary.trends.filter(Boolean) : [];
  const filler = /先(?:点击|通过标题)|主要涉及若干|是(?:本次更新中)?的主要主题|具体内容以|再进入详情/;
  return overview.length >= 35
    && overview.length <= 110
    && value.length >= 20
    && value.length <= 70
    && trends.length > 0
    && trends.length <= 2
    && trends.every((trend) => String(trend).length <= 65)
    && !filler.test(`${overview} ${value} ${trends.join(" ")}`);
}

async function buildSectionSummaries(items) {
  const groups = Object.groupBy(items, (item) => item.body?.section || "other");
  const fallback = Object.entries(groups)
    .filter(([section]) => sectionLabels[section])
    .map(([section, sectionItems]) => fallbackSectionSummary(section, sectionItems || []));
  if (!moonshotKey || fallback.length === 0) {
    return { summaries: fallback, failures: moonshotKey ? [] : [{ source: "summary", message: "MOONSHOT_API_KEY is not configured" }] };
  }

  const summaries = [];
  const failures = [];
  // Item processing can consume the account's short-window token allowance. Give it time to recover.
  if (!summaryOnly) await sleep(15_000);
  for (const entry of fallback) {
    const sectionItems = groups[entry.section] || [];
    try {
      let processed = await kimiJson(
        sectionPrompt(entry.section),
        { section: entry.section, label: entry.label, items: sectionItems.map(summaryInput) },
        { maxTokens: 1_600, timeoutMs: 180_000 },
      );
      if (!usefulSectionSummary(processed)) {
        processed = await kimiJson(
          "你是中文信息编辑。把输入的板块导读压缩成首页卡片文案，不增加新事实。只返回 JSON：{section,overview,trends,value,technicalLevel,technicalPercentage}。overview 55-90 个中文字、最多 3 句；trends 只留 1-2 条、每条 25-45 字；value 30-55 个中文字。删除人名和项目名罗列，只保留最重要的内容范围、一个共同趋势和对非技术读者的具体价值。",
          processed,
          { maxTokens: 800, timeoutMs: 120_000 },
        );
      }
      if (!usefulSectionSummary(processed)) throw new Error("Kimi section summary did not pass the usefulness check after compression");
      summaries.push({
        ...entry,
        overview: processed.overview,
        trends: processed.trends.slice(0, 3),
        value: processed.value,
        technicalLevel: processed.technicalLevel || entry.technicalLevel,
        technicalPercentage: Number.isFinite(Number(processed.technicalPercentage))
          ? Math.max(0, Math.min(100, Math.round(Number(processed.technicalPercentage))))
          : entry.technicalPercentage,
      });
    } catch (error) {
      const message = error?.message || String(error);
      console.error(`[collect] ${entry.section} summary fallback: ${message}`);
      failures.push({ source: `summary:${entry.section}`, message });
      summaries.push(entry);
    }
    await sleep(3_000);
  }
  return { summaries, failures };
}

function checkItems(items) {
  const rejected = [];
  const accepted = items.filter((item) => {
    const missing = [
      !item.externalId && "内容 ID",
      !item.title && "标题",
      !item.summary && "摘要",
      !item.sourceUrl && "原始链接",
      !item.body?.section && "板块",
    ].filter(Boolean);
    if (missing.length === 0) return true;
    rejected.push({
      source: item.source?.id || "unknown",
      message: `${item.title || item.externalId || "未命名内容"} 缺少${missing.join("、")}`,
    });
    return false;
  });
  return { accepted, rejected };
}

async function collectFollowBuilders() {
  const reportPath = process.env.INFOHUB_DAILY_REPORT_PATH?.trim();
  const feed = reportPath
    ? { x: [{ name: "Follow Builders", bio: "", tweets: parseFollowBuildersReport(await readFile(reportPath, "utf8")) }] }
    : await fetchJson(config.followBuilders.url);
  const tweets = (feed.x || [])
    .flatMap((builder) => (builder.tweets || []).map((tweet) => ({
      ...tweet,
      builder: tweet.builder || builder.name,
      bio: tweet.bio || builder.bio,
    })))
    .filter((tweet) => recent(tweet.createdAt))
    .filter((tweet) => tweet.text.replace(/https?:\/\/\S+/g, "").trim().length >= 12)
    .sort((a, b) => (b.likes || 0) - (a.likes || 0))
    .slice(0, 30);
  if (tweets.length === 0) return [];

  const grouped = Object.entries(Object.groupBy(tweets, (tweet) => tweet.builder)).map(
    ([builder, builderTweets], index) => ({
      id: index,
      builder,
      bio: builderTweets?.find((tweet) => tweet.bio)?.bio || "",
      tweets: (builderTweets || []).map((tweet) => ({
        id: String(tweet.id),
        text: tweet.text,
        url: tweet.url,
        likes: tweet.likes || 0,
        createdAt: tweet.createdAt,
      })),
    }),
  );

  const buildersPrompt = "你是 AI Builders Digest 的中文编辑。把同一位 Builder 在过去 24 小时的全部推文合并成一段像懂行朋友介绍动态的自然中文，不做评价、推荐、延伸分析或链接页猜测。所有英文内容必须翻译成自然中文，中文正文统一使用全角中文标点；产品名、人名和必要术语可以保留英文。保留具体产品、人名、数字、观点和幽默语气；多条推文之间有关系时自然串联，没有关系时用清楚的转折分开。人物身份只能来自 bio；bio 不足时只写姓名。返回 JSON：{items:[{id,title,summary,paragraph,keywords}]}。title 为“身份 + 姓名”或姓名；summary 为一句话概览；paragraph 为完整中文介绍；keywords 为 3-6 个中文关键词。链接由系统另行展示，不要写入 paragraph。";
  const processedItems = await kimiItems(
    buildersPrompt,
    grouped,
    { batchSize: 2, maxTokens: 4_000, concurrency: 2 },
  );
  const validBuilderItem = (entry) => entry
    && String(entry.paragraph || "").match(/[\u3400-\u9fff]/g)?.length >= 8
    && Array.isArray(entry.keywords)
    && entry.keywords.length > 0;
  const missingGroups = grouped.filter((group) => !validBuilderItem(
    processedItems.find((entry) => String(entry.id) === String(group.id)),
  ));
  if (missingGroups.length > 0) {
    console.warn(`[collect] retrying ${missingGroups.length} incomplete Follow Builders entries`);
    processedItems.push(...await kimiItems(
      buildersPrompt,
      missingGroups,
      { batchSize: 1, maxTokens: 3_500, concurrency: 1 },
    ));
  }
  const unresolvedGroups = grouped.filter((group) => !validBuilderItem(
    [...processedItems].reverse().find((entry) => String(entry.id) === String(group.id)),
  ));
  if (unresolvedGroups.length > 0) {
    throw new Error(`Kimi did not finish ${unresolvedGroups.length} Follow Builders entries`);
  }

  return grouped.map((group) => {
    const item = [...processedItems].reverse().find((entry) => String(entry.id) === String(group.id));
    const latestTweet = [...group.tweets].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    const keywords = Array.isArray(item?.keywords) ? item.keywords : ["X", "AI Builders"];
    const digestDate = shanghaiDate(new Date(latestTweet.createdAt));
    return {
      externalId: `digest-${digestDate}-${group.builder.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || group.id}`,
      source: {
        id: config.followBuilders.id,
        type: "builder",
        name: `${group.builder} · Follow Builders`,
        url: "https://github.com/zarazhangrui/follow-builders",
      },
      title: item?.title || group.builder,
      sourceUrl: latestTweet.url,
      summary: item?.summary || `${group.builder} 今天发布了 ${group.tweets.length} 条动态。`,
      publishedAt: latestTweet.createdAt,
      keywords,
      body: baseBody("x", latestTweet.createdAt, {
        digestFormat: "builders-digest",
        paragraphs: [item.paragraph],
        externalLinks: group.tweets.map((tweet, index) => ({
          label: group.tweets.length === 1 ? "推文" : `推文 ${index + 1}`,
          url: tweet.url,
        })),
      }),
    };
  });
}

async function collectTechnicalX() {
  const feed = await fetchJson(config.technicalX.url);
  const entries = (feed.entries || [])
    .filter((entry) => recent(entry.tweetCreatedAt))
    .slice(0, 3);
  if (entries.length === 0) return [];

  const processed = await kimiJson(
    "你是中文科技编辑。根据 X 长文标题和预览内容，忠实翻译并介绍，不得把预览中没有的信息写成事实。返回 JSON：{items:[{id,title,summary,translation,detail,keywords}]}。translation 是中文翻译；detail 解释其核心观点和阅读时需要注意的语境；keywords 为 3-6 个。",
    entries.map((entry) => ({
      id: entry.tweetId,
      author: entry.author,
      title: entry.title,
      previewText: entry.previewText,
      tags: entry.tags,
    })),
  );

  return (processed.items || []).flatMap((item) => {
    const entry = entries.find((value) => String(value.tweetId) === String(item.id));
    if (!entry) return [];
    const url = `https://x.com/${entry.author.handle}/status/${entry.tweetId}`;
    const keywords = Array.isArray(item.keywords) ? item.keywords : ["X 热榜", "AI"];
    return [{
      externalId: String(entry.tweetId),
      source: {
        id: config.technicalX.id,
        type: "daily",
        name: `${entry.author.name} · 技术动态 X 热榜`,
        url: config.technicalX.url,
      },
      title: item.title,
      sourceUrl: url,
      summary: item.summary,
      publishedAt: entry.tweetCreatedAt,
      keywords,
      body: baseBody("x", entry.tweetCreatedAt, {
        paragraphs: [item.translation, item.detail].filter(Boolean),
      }),
    }];
  });
}

function normalizePaper(entry) {
  const paper = entry.paper || entry;
  return {
    id: paper.id || paper._id || entry.id,
    title: paper.title || entry.title,
    abstract: paper.summary || paper.abstract || entry.summary || entry.abstract,
    publishedAt: paper.publishedAt || paper.published_at || entry.publishedAt || entry.published_at,
  };
}

function parseArxivFeed(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].flatMap((match) => {
    const block = match[1];
    const idUrl = block.match(/<id>([^<]+)<\/id>/)?.[1];
    const id = idUrl?.match(/\/abs\/([^v<]+)(?:v\d+)?$/)?.[1];
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const abstract = block.match(/<summary>([\s\S]*?)<\/summary>/)?.[1];
    const publishedAt = block.match(/<published>([^<]+)<\/published>/)?.[1];
    if (!id || !title || !abstract || !publishedAt) return [];
    return [{ id, title: stripHtml(title), abstract: stripHtml(abstract), publishedAt }];
  });
}

async function recentArxivPapers() {
  const start = shanghaiDate(new Date(now.valueOf() - 24 * 60 * 60 * 1000)).replaceAll("-", "");
  const end = shanghaiDate(now).replaceAll("-", "");
  const query = new URLSearchParams({
    search_query: `submittedDate:[${start}0000 TO ${end}2359] AND (cat:cs.AI OR cat:cs.CL OR cat:cs.LG)`,
    start: "0",
    max_results: "10",
    sortBy: "submittedDate",
    sortOrder: "descending",
  });
  const xml = await (await fetchWithRetry(`https://export.arxiv.org/api/query?${query}`)).text();
  return parseArxivFeed(xml);
}

async function collectPapers() {
  const dates = [shanghaiDate(now), shanghaiDate(new Date(now.valueOf() - 24 * 60 * 60 * 1000))];
  const pages = await Promise.all(dates.map(async (date) => {
    try {
      return await fetchJson(`${config.papers.url}?date=${date}`);
    } catch {
      return [];
    }
  }));
  let papers = pages
    .flat()
    .map(normalizePaper)
    .filter((paper) => paper.id && paper.title && paper.abstract && recent(paper.publishedAt))
    .filter((paper, index, all) => all.findIndex((entry) => entry.id === paper.id) === index)
    .slice(0, 3);
  if (papers.length === 0) {
    papers = (await recentArxivPapers()).filter((paper) => recent(paper.publishedAt)).slice(0, 3);
  }
  if (papers.length === 0) return [];

  const processedItems = [];
  for (const paper of papers) {
    try {
      const item = await kimiJson(
        "你是面向普通读者的论文编辑。只根据给定英文标题和摘要处理，不得补充摘要外的研究结果。严格返回 JSON 对象：{id,titleZh,summaryZh,paragraphs,keywords,utility}。paragraphs 是忠实、完整、清楚的中文摘要翻译，可分 2-4 段；keywords 为 3-6 个中文关键词；utility 用非技术语言说明普通人为什么值得了解、可能影响什么生活或工作判断，不能夸大论文结论。",
        paper,
        { maxTokens: 4_000, timeoutMs: 4 * 60 * 1000 },
      );
      if (item.id && item.titleZh && item.summaryZh && Array.isArray(item.paragraphs)
        && item.paragraphs.join("").length >= 120 && Array.isArray(item.keywords) && item.utility) {
        processedItems.push(item);
      }
    } catch (error) {
      console.error(`[collect] paper ${paper.id} skipped: ${error?.message || String(error)}`);
    }
  }
  if (processedItems.length === 0) throw new Error("Kimi did not return a complete paper entry");

  return processedItems.flatMap((item) => {
    const paper = papers.find((entry) => String(entry.id) === String(item.id));
    if (!paper) return [];
    const publishedAt = paper.publishedAt || now.toISOString();
    const keywords = Array.isArray(item.keywords) ? item.keywords : ["热门论文"];
    return [{
      externalId: String(paper.id),
      source: {
        id: config.papers.id,
        type: "daily",
        name: config.papers.name,
        url: "https://huggingface.co/papers",
      },
      title: item.titleZh || paper.title,
      sourceUrl: `https://huggingface.co/papers/${paper.id}`,
      summary: item.summaryZh,
      publishedAt,
      keywords,
      body: baseBody("papers", publishedAt, {
        paragraphs: Array.isArray(item.paragraphs) ? item.paragraphs : [item.summaryZh],
        utility: item.utility,
        externalLinks: [
          { label: "查看 Hugging Face 论文页", url: `https://huggingface.co/papers/${paper.id}` },
          { label: "打开 arXiv 原文", url: `https://arxiv.org/abs/${paper.id}` },
        ],
      }),
    }];
  });
}

function trendingRepositories(html) {
  return [...html.matchAll(/<article[^>]*Box-row[^>]*>([\s\S]*?)<\/article>/g)]
    .flatMap((match) => {
      const href = match[1].match(/<h2[^>]*>[\s\S]*?<a[^>]+href="\/([^"?#]+)"/i)?.[1];
      const dailyStars = Number(match[1].match(/([\d,]+)\s+stars today/i)?.[1].replaceAll(",", "") || 0);
      return href && href.split("/").length === 2 ? [{ repository: href, dailyStars }] : [];
    })
    .slice(0, 15);
}

function reportTrendingRepositories(html) {
  return reportArticles(html, "github-trending").flatMap((block) => {
    const url = block.match(/class="article-title">\s*<a href="([^"]+)"/)?.[1];
    const repository = url?.match(/github\.com\/([^/]+\/[^/?#]+)/)?.[1];
    const stats = reportField(block, "article-stats");
    const dailyStars = Number(stats.match(/([\d,]+) stars today/i)?.[1].replaceAll(",", "") || 0);
    return repository ? [{ repository, dailyStars }] : [];
  }).slice(0, 15);
}

async function collectGithub() {
  const reportPath = process.env.INFOHUB_DAILY_REPORT_PATH?.trim();
  const repositoryEntries = reportPath
    ? reportTrendingRepositories(await readFile(reportPath, "utf8"))
    : trendingRepositories(await (await fetchWithRetry(config.github.url)).text());
  if (repositoryEntries.length === 0) throw new Error("GitHub Trending returned no repositories");
  const details = [];
  for (let index = 0; index < repositoryEntries.length; index += 3) {
    const batch = repositoryEntries.slice(index, index + 3);
    details.push(...await Promise.all(batch.map(async ({ repository, dailyStars }) => {
      const [metadata, readme] = await Promise.all([
        fetchJson(`https://api.github.com/repos/${repository}`, {
          headers: { accept: "application/vnd.github+json" },
        }),
        fetchWithRetry(`https://raw.githubusercontent.com/${repository}/HEAD/README.md`)
          .then((response) => response.text())
          .catch(() => ""),
      ]);
      return {
        repository,
        description: metadata.description,
        homepage: metadata.homepage,
        language: metadata.language,
        stars: metadata.stargazers_count,
        dailyStars,
        forks: metadata.forks_count,
        license: metadata.license?.spdx_id,
        updatedAt: metadata.pushed_at,
        readme: readme.slice(0, 5_000),
      };
    })));
  }

  const githubPrompt = "你是面向非程序员的开源项目编辑。根据仓库元数据与 README，返回 JSON：{items:[{repository,titleZh,summaryZh,paragraphs,keywords}]}。titleZh 使用清楚的中文产品式标题；summaryZh 用一句话说明这是什么、能帮助人做什么；paragraphs 必须用 2-4 段自然中文具体说明项目用途、核心能力、适用人群和使用门槛，让不写代码的读者也能判断它是否有价值。不得只让读者去看 README，不得用 README 缺少细节作为正文，不得编造没有的功能；keywords 为 4-7 个中文关键词。";
  const processedItems = await kimiItems(
    githubPrompt,
    details,
    { batchSize: 2, maxTokens: 4_500, concurrency: 2 },
  );
  const validGithubItem = (entry) => entry
    && String(entry.summaryZh || "").match(/[\u3400-\u9fff]/g)?.length >= 8
    && Array.isArray(entry.paragraphs)
    && entry.paragraphs.length >= 2
    && Array.isArray(entry.keywords)
    && entry.keywords.length >= 3
    && !/详细功能请|阅读项目 README|去看 README/i.test(entry.paragraphs.join(" "));
  const missingRepositories = details.filter((repo) => !validGithubItem(
    processedItems.find((entry) => entry.repository === repo.repository),
  ));
  if (missingRepositories.length > 0) {
    console.warn(`[collect] retrying ${missingRepositories.length} incomplete GitHub entries`);
    processedItems.push(...await kimiItems(
      githubPrompt,
      missingRepositories,
      { batchSize: 1, maxTokens: 3_500, concurrency: 1 },
    ));
  }
  const unresolvedRepositories = details.filter((repo) => !validGithubItem(
    [...processedItems].reverse().find((entry) => entry.repository === repo.repository),
  ));
  if (unresolvedRepositories.length > 0) {
    throw new Error(`Kimi did not finish ${unresolvedRepositories.length} GitHub entries`);
  }

  return details.map((repo) => {
    const item = [...processedItems].reverse().find((entry) => entry.repository === repo.repository);
    const publishedAt = now.toISOString();
    const keywords = Array.isArray(item?.keywords) ? item.keywords : ["GitHub", "开源"];
    return {
      externalId: repo.repository,
      source: {
        id: config.github.id,
        type: "daily",
        name: config.github.name,
        url: config.github.url,
      },
      title: item.titleZh || repo.repository,
      sourceUrl: `https://github.com/${repo.repository}`,
      summary: item.summaryZh,
      publishedAt,
      keywords,
      body: baseBody("github", publishedAt, {
        paragraphs: item.paragraphs,
        facts: [
          { label: "主要语言", value: repo.language || "未标注" },
          { label: "Stars", value: Number(repo.stars || 0).toLocaleString("en-US") },
          { label: "今日新增 Stars", value: repo.dailyStars ? `+${Number(repo.dailyStars).toLocaleString("en-US")}` : "未获取" },
          { label: "Forks", value: Number(repo.forks || 0).toLocaleString("en-US") },
          { label: "许可证", value: repo.license || "未标注" },
          { label: "最近更新", value: shanghaiDate(new Date(repo.updatedAt)) },
        ],
        externalLinks: [
          { label: "阅读项目 README", url: `https://github.com/${repo.repository}#readme` },
          ...(repo.homepage ? [{ label: "打开项目网站", url: repo.homepage }] : []),
          { label: "查看 Releases", url: `https://github.com/${repo.repository}/releases` },
        ],
      }),
    };
  });
}

function parseYoutubeFeed(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].flatMap((match) => {
    const block = match[1];
    const videoId = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const publishedAt = block.match(/<published>([^<]+)<\/published>/)?.[1];
    if (!videoId || !title || !publishedAt) return [];
    return [{ videoId, title: stripHtml(title), publishedAt }];
  });
}

function parseYoutubeProxyFeed(payload) {
  return (payload.items || []).flatMap((item) => {
    const videoId = item.guid?.replace(/^yt:video:/, "") || item.link?.match(/(?:v=|shorts\/)([\w-]{11})/)?.[1];
    const publishedAt = item.pubDate ? `${item.pubDate.replace(" ", "T")}Z` : undefined;
    if (!videoId || !item.title || !publishedAt) return [];
    return [{ videoId, title: item.title, publishedAt }];
  });
}

async function youtubeFeed(channelId) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "InfoHub-Collector/1.0" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return parseYoutubeFeed(await response.text());
  } catch {
    const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
    return parseYoutubeProxyFeed(await fetchJson(proxyUrl));
  }
}

async function resolveYoutubeChannelId(url) {
  const { stdout } = await execFileAsync(
    "yt-dlp",
    ["--flat-playlist", "--playlist-end", "1", "--dump-single-json", `${url.replace(/\/$/, "")}/videos`],
    { cwd: root, maxBuffer: 1024 * 1024 * 10, timeout: 90_000 },
  );
  const metadata = JSON.parse(stdout);
  if (!metadata.channel_id) throw new Error(`Cannot resolve YouTube channel ID: ${url}`);
  return metadata.channel_id;
}

async function configuredYoutubeSources() {
  const baseUrl = process.env.INFOHUB_BASE_URL?.replace(/\/$/, "");
  const ingestSecret = process.env.INGEST_SECRET?.trim();
  let sources = config.youtube;
  if (baseUrl && ingestSecret) {
    try {
      const payload = await fetchJson(`${baseUrl}/api/ingest`, {
        headers: { authorization: `Bearer ${ingestSecret}` },
      });
      const remote = (payload.sources || []).filter((source) => source.type === "youtube");
      if (remote.length > 0) {
        sources = remote.map((source) => ({
          id: source.id,
          name: source.name,
          url: source.url,
          channelId: config.youtube.find((item) => item.url === source.url)?.channelId,
        }));
      }
    } catch {
      // The local source list remains a safe fallback when the hosted site is private or offline.
    }
  }
  return Promise.all(sources.map(async (source) => ({
    ...source,
    channelId: source.channelId || await resolveYoutubeChannelId(source.url),
  })));
}

function youtubeVideoId(value) {
  return value.match(/[?&]v=([\w-]{11})/)?.[1]
    || value.match(/youtu\.be\/([\w-]{11})/)?.[1]
    || (/^[\w-]{11}$/.test(value) ? value : undefined);
}

async function supadataRequest(path, params = {}) {
  if (!supadataKey) throw new Error("SUPADATA_API_KEY is not configured");
  const url = new URL(`https://api.supadata.ai/v1${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const response = await fetch(url, {
    headers: { "x-api-key": supadataKey },
    signal: AbortSignal.timeout(60_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Supadata returned HTTP ${response.status}`);
  return { response, payload };
}

function transcriptText(payload) {
  if (typeof payload.content === "string") return payload.content;
  if (!Array.isArray(payload.content)) return "";
  const stamp = (milliseconds) => {
    const totalSeconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };
  return payload.content.map((chunk) => {
    const end = Number(chunk.offset || 0) + Number(chunk.duration || 0);
    return `[${stamp(chunk.offset)} → ${stamp(end)}] ${chunk.text}`;
  }).join("\n");
}

async function supadataTranscript(videoId) {
  const cachePath = join(root, "work/youtube-transcripts", `supadata-${videoId}.txt`);
  try {
    const cached = await readFile(cachePath, "utf8");
    if (cached.trim()) return cached;
  } catch {
    // Fetch and cache below.
  }
  const remember = async (text) => {
    if (!text) return text;
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(cachePath, text);
    return text;
  };
  const { response, payload } = await supadataRequest("/transcript", {
    url: `https://www.youtube.com/watch?v=${videoId}`,
    text: false,
    chunkSize: 2000,
    mode: "auto",
  });
  if (response.status === 200) return remember(transcriptText(payload));
  const jobId = payload.jobId;
  if (!jobId) throw new Error("Supadata did not return transcript or job ID");
  for (let attempt = 0; attempt < 300; attempt += 1) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000));
    const result = await supadataRequest(`/transcript/${jobId}`);
    const text = transcriptText(result.payload);
    if (text) return remember(text);
  }
  throw new Error("Supadata transcript job timed out");
}

function splitTranscript(transcript, maximumCharacters = 12_000) {
  const chunks = [];
  let current = "";
  for (const line of transcript.split("\n")) {
    if (current && current.length + line.length + 1 > maximumCharacters) {
      chunks.push(current);
      current = "";
    }
    current += `${current ? "\n" : ""}${line}`;
  }
  if (current) chunks.push(current);
  return chunks;
}

async function processYoutubeTranscript(title, transcript) {
  const chunks = splitTranscript(transcript);
  const prompt = "你是 YouTube 长内容编辑。忠实处理给定的连续文字稿片段，不能删减论点、论据、案例、步骤、条件、例外和重要细节；只删除无信息量口头禅和完全重复。返回 JSON：{items:[{id,titleZh,summary,keywords,takeaways,sections:[{title,timeRange,paragraphs}]}]}。titleZh 是适合中文阅读的标题；takeaways 为该片段最可应用的内容；sections 按时间顺序整理成阅读友好的中文文章，每节必须使用片段中真实的起止时间戳；不得补充文字稿外信息。";
  const inputs = chunks.map((transcriptChunk, id) => ({ id, title, transcript: transcriptChunk }));
  const processed = await kimiItems(
    prompt,
    inputs,
    { batchSize: 1, maxTokens: 6_500, concurrency: 2 },
  );
  for (const input of inputs.filter((entry) => !processed.some((item) => Number(item.id) === entry.id))) {
    try {
      const retry = await kimiJson(prompt, [input], { maxTokens: 6_500, timeoutMs: 5 * 60 * 1000 });
      processed.push(...(retry.items || []));
      console.log(`[kimi] youtube segment ${input.id + 1}/${inputs.length} recovered`);
    } catch (error) {
      console.warn(`[kimi] youtube segment ${input.id + 1}/${inputs.length} retry failed: ${error.message}`);
    }
  }
  if (inputs.some((entry) => !processed.some((item) => Number(item.id) === entry.id))) {
    throw new Error("Kimi did not process every YouTube transcript segment");
  }
  processed.sort((a, b) => Number(a.id) - Number(b.id));
  const sections = processed.flatMap((item) => Array.isArray(item.sections) ? item.sections : []);
  if (sections.length === 0) throw new Error("Kimi did not return YouTube article sections");
  const summaries = processed.map((item) => item.summary).filter(Boolean);
  return {
    title: processed.find((item) => item.titleZh)?.titleZh || title,
    summary: summaries[0] || "已根据完整视频文字稿整理为中文阅读文章。",
    keywords: [...new Set(processed.flatMap((item) => Array.isArray(item.keywords) ? item.keywords : []))].slice(0, 8),
    takeaways: [...new Set(processed.flatMap((item) => Array.isArray(item.takeaways) ? item.takeaways : []))].slice(0, 10),
    sections,
  };
}

async function supadataVideo(value) {
  const { payload } = await supadataRequest("/youtube/video", { id: value });
  return payload;
}

async function transcriptFor(videoId) {
  if (supadataKey) return supadataTranscript(videoId);
  const script = process.env.BAOYU_TRANSCRIPT_SCRIPT || join(
    homedir(),
    ".codex/skills/baoyu-youtube-transcript/scripts/main.ts",
  );
  const outputDir = join(root, "work/youtube-transcripts");
  await mkdir(outputDir, { recursive: true });
  const { stdout } = await execFileAsync(
    "npx",
    ["-y", "bun", script, videoId, "--languages", "en,zh", "--chapters", "--output-dir", outputDir],
    { cwd: root, maxBuffer: 1024 * 1024 * 30, timeout: 8 * 60 * 1000 },
  );
  const filePath = stdout.trim().split("\n").at(-1);
  if (!filePath) throw new Error(`Transcript path missing for ${videoId}`);
  return readFile(filePath, "utf8");
}

async function collectYoutube() {
  const previewUrl = process.env.INFOHUB_PREVIEW_YOUTUBE_URL?.trim();
  let videos;
  if (previewUrl) {
    const videoId = youtubeVideoId(previewUrl);
    if (!videoId) throw new Error("Invalid INFOHUB_PREVIEW_YOUTUBE_URL");
    const metadata = await supadataVideo(videoId);
    videos = [{
      videoId,
      title: metadata.title,
      publishedAt: now.toISOString(),
      channel: {
        id: `youtube-preview-${metadata.channel?.id || videoId}`,
        name: `${metadata.channel?.name || "YouTube"} · 临时示例`,
        url: metadata.channel?.id
          ? `https://www.youtube.com/channel/${metadata.channel.id}`
          : previewUrl,
      },
    }];
  } else {
    const youtubeSources = await configuredYoutubeSources();
    videos = (await Promise.all(youtubeSources.map(async (channel) => {
      return (await youtubeFeed(channel.channelId))
        .filter((video) => recent(video.publishedAt))
        .map((video) => ({ ...video, channel }));
    }))).flat();
  }

  const items = [];
  for (const video of videos) {
    try {
      const transcript = await transcriptFor(video.videoId);
      const processed = await processYoutubeTranscript(video.title, transcript);
      if (!Array.isArray(processed.takeaways) || !Array.isArray(processed.sections)) {
        throw new Error("Kimi did not return complete YouTube sections");
      }
      const keywords = Array.isArray(processed.keywords) ? processed.keywords : ["YouTube"];
      items.push({
        externalId: video.videoId,
        source: {
          id: video.channel.id,
          type: "youtube",
          name: video.channel.name,
          url: video.channel.url,
        },
        title: processed.title || video.title,
        sourceUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
        summary: processed.summary,
        publishedAt: video.publishedAt,
        keywords,
        body: baseBody("youtube", video.publishedAt, {
          takeaways: processed.takeaways,
          sections: processed.sections,
          paragraphs: [],
          readTime: "深度阅读",
        }),
      });
    } catch (error) {
      console.error(`[collect] youtube ${video.videoId} skipped: ${error?.message || String(error)}`);
    }
  }
  return items;
}

function stage(id, label) {
  return { id, label, status: "pending", detail: "等待处理" };
}

async function saveReport(report, outputPath) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
}

function publicFeedItem(item) {
  return {
    ...item.body,
    id: `${item.source.id}:${item.externalId}`,
    title: item.title,
    sourceUrl: item.sourceUrl,
    summary: item.summary,
    tags: item.keywords,
    source: item.source.type,
    sourceLabel: item.source.name,
    publishedAt: item.publishedAt,
  };
}

async function publishStaticFiles(items, sectionSummaries, runSummary) {
  const feedPath = join(root, "app/generated-feed.json");
  const summariesPath = join(root, "app/generated-section-summaries.json");
  let existing = [];
  let existingSummaries = [];
  try {
    const parsed = JSON.parse(await readFile(feedPath, "utf8"));
    if (Array.isArray(parsed)) existing = parsed;
  } catch {
    existing = [];
  }
  try {
    const parsed = JSON.parse(await readFile(summariesPath, "utf8"));
    if (Array.isArray(parsed)) existingSummaries = parsed;
  } catch {
    existingSummaries = [];
  }

  const publicItems = items.map(publicFeedItem);
  const buildersDigestDates = new Set(
    publicItems
      .filter((item) => item.digestFormat === "builders-digest")
      .map((item) => item.digestDate),
  );
  const retained = existing.filter((item) => !(
    buildersDigestDates.has(item.digestDate)
    && String(item.sourceLabel || "").includes("Follow Builders")
  ));
  const merged = new Map(retained.map((item) => [item.id, item]));
  for (const item of publicItems) merged.set(item.id, item);
  const feed = [...merged.values()].sort((a, b) =>
    String(b.publishedAt ?? b.digestDate ?? "").localeCompare(String(a.publishedAt ?? a.digestDate ?? "")),
  );
  const mergedSummaries = new Map(existingSummaries.map((summary) => [summary.section, summary]));
  for (const summary of sectionSummaries) mergedSummaries.set(summary.section, summary);

  await Promise.all([
    writeFile(feedPath, `${JSON.stringify(feed, null, 2)}\n`),
    writeFile(summariesPath, `${JSON.stringify([...mergedSummaries.values()], null, 2)}\n`),
    writeFile(join(root, "app/generated-run-summary.json"), `${JSON.stringify(runSummary, null, 2)}\n`),
  ]);
}

async function syncRunSummary(report) {
  if (isDryRun) return;
  const baseUrl = process.env.INFOHUB_BASE_URL?.replace(/\/$/, "");
  const ingestSecret = process.env.INGEST_SECRET?.trim();
  if (!baseUrl || !ingestSecret) return;
  try {
    const summary = { ...report };
    delete summary.items;
    delete summary.upload;
    await fetchWithRetry(`${baseUrl}/api/ingest`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ingestSecret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ items: [], runSummary: summary }),
    }, 2);
  } catch (error) {
    console.error(`[collect] status sync skipped: ${error?.message || String(error)}`);
  }
}

async function regenerateSectionSummaries() {
  const feedPath = join(root, "app/generated-feed.json");
  const summariesPath = join(root, "app/generated-section-summaries.json");
  const feed = JSON.parse(await readFile(feedPath, "utf8"));
  const availableDates = feed.map((item) => item.digestDate).filter(Boolean).sort();
  const targetDate = feed.some((item) => item.digestDate === runDigestDate)
    ? runDigestDate
    : availableDates.at(-1);
  const items = feed
    .filter((item) => item.digestDate === targetDate && sectionLabels[item.section])
    .map((item) => ({
      title: item.title,
      summary: item.summary,
      keywords: item.tags || [],
      body: { ...item, section: item.section },
    }));
  if (items.length === 0) throw new Error(`No public items found for ${targetDate || runDigestDate}`);

  const result = await buildSectionSummaries(items);
  let existing = [];
  try {
    const parsed = JSON.parse(await readFile(summariesPath, "utf8"));
    if (Array.isArray(parsed)) existing = parsed;
  } catch {
    existing = [];
  }
  const failedSections = new Set(result.failures.map((failure) => failure.source.replace(/^summary:/, "")));
  const merged = new Map(existing.map((summary) => [summary.section, summary]));
  for (const summary of result.summaries) {
    if (!failedSections.has(summary.section)) merged.set(summary.section, summary);
  }
  await writeFile(summariesPath, `${JSON.stringify([...merged.values()], null, 2)}\n`);
  console.log(JSON.stringify({
    ok: result.failures.length === 0,
    targetDate,
    generated: result.summaries.length - result.failures.length,
    failures: result.failures,
  }, null, 2));
  if (result.failures.length > 0) process.exitCode = 1;
}

async function main() {
  if (summaryOnly) {
    await regenerateSectionSummaries();
    return;
  }
  const requestedSource = process.argv.find((argument) => argument.startsWith("--source="))?.split("=")[1];
  const allCollectors = [
    ["follow-builders", collectFollowBuilders],
    ["technical-x", collectTechnicalX],
    ["papers", collectPapers],
    ["github", collectGithub],
    ["youtube", collectYoutube],
  ];
  const collectors = requestedSource
    ? allCollectors.filter(([source]) => source === requestedSource)
    : allCollectors;
  if (collectors.length === 0) throw new Error(`Unknown collector: ${requestedSource}`);
  const outputPath = join(root, `outputs/last-collection${requestedSource ? `-${requestedSource}` : ""}.json`);
  const report = {
    id: `collection-${now.toISOString()}`,
    generatedAt: now.toISOString(),
    windowStart: cutoff.toISOString(),
    mode: isDryRun ? "preview" : "production",
    status: "running",
    itemCount: 0,
    validItemCount: 0,
    publishedCount: 0,
    stages: [
      stage("collect", "采集"),
      stage("summarize", "处理总结"),
      stage("quality", "质量检查"),
      stage("publish", "发布"),
    ],
    sources: [],
    sectionSummaries: [],
    errors: [],
  };

  report.stages[0] = { ...report.stages[0], status: "running", detail: `正在处理 ${collectors.length} 个信息源` };
  await saveReport(report, outputPath);
  await syncRunSummary(report);

  const errors = report.errors;
  const items = [];
  for (const [source, collect] of collectors) {
    const startedAt = new Date().toISOString();
    console.error(`[collect] ${source} started`);
    try {
      const collected = await collect();
      items.push(...collected);
      report.sources.push({
        id: source,
        label: sourceLabels[source] || source,
        status: "completed",
        itemCount: collected.length,
        startedAt,
        finishedAt: new Date().toISOString(),
      });
      console.error(`[collect] ${source} finished`);
    } catch (error) {
      const message = error?.message || String(error);
      errors.push({ source, message });
      report.sources.push({
        id: source,
        label: sourceLabels[source] || source,
        status: "failed",
        itemCount: 0,
        error: message,
        startedAt,
        finishedAt: new Date().toISOString(),
      });
      console.error(`[collect] ${source} failed: ${error?.message || String(error)}`);
    }
    report.itemCount = items.length;
    await saveReport(report, outputPath);
  }

  report.stages[0] = {
    ...report.stages[0],
    status: errors.length === collectors.length ? "failed" : "completed",
    detail: `完成 ${collectors.length - errors.length}/${collectors.length} 个来源，共 ${items.length} 条内容`,
  };
  report.stages[1] = { ...report.stages[1], status: "running", detail: "正在生成各板块的阅读提示" };
  await saveReport(report, outputPath);
  await syncRunSummary(report);

  const summaryResult = await buildSectionSummaries(items);
  report.sectionSummaries = summaryResult.summaries;
  errors.push(...summaryResult.failures);
  const noUpdates = items.length === 0 && errors.length === 0;
  report.stages[1] = {
    ...report.stages[1],
    status: summaryResult.failures.length > 0 ? "failed" : items.length > 0 || noUpdates ? "completed" : "failed",
    detail: summaryResult.failures.length > 0
      ? `${report.sectionSummaries.length - summaryResult.failures.length} 个成功，${summaryResult.failures.length} 个失败并使用原始摘要兜底`
      : items.length > 0 ? `已生成 ${report.sectionSummaries.length} 个板块总结` : noUpdates ? "本次没有新内容" : "没有可总结的内容",
  };
  report.stages[2] = { ...report.stages[2], status: "running", detail: "正在检查必要字段" };
  await saveReport(report, outputPath);
  await syncRunSummary(report);

  const checked = checkItems(items);
  errors.push(...checked.rejected);
  report.validItemCount = checked.accepted.length;
  report.stages[2] = {
    ...report.stages[2],
    status: checked.accepted.length > 0 || items.length === 0 ? "completed" : "failed",
    detail: `通过 ${checked.accepted.length} 条，未通过 ${checked.rejected.length} 条`,
  };

  if (!isDryRun && checked.accepted.length > 0) {
    report.stages[3] = { ...report.stages[3], status: "running", detail: `正在发布 ${checked.accepted.length} 条内容` };
    await saveReport(report, outputPath);
    await syncRunSummary(report);
    try {
      report.stages[3] = { ...report.stages[3], status: "completed", detail: `已写入 ${checked.accepted.length} 条公开内容` };
      report.publishedCount = checked.accepted.length;
      await publishStaticFiles(checked.accepted, report.sectionSummaries, report);
    } catch (error) {
      const message = error?.message || String(error);
      errors.push({ source: "publish", message });
      report.publishedCount = 0;
      report.stages[3] = { ...report.stages[3], status: "failed", detail: message };
    }
  } else if (isDryRun) {
    report.stages[3] = { ...report.stages[3], status: "completed", detail: "预览模式，未发布" };
  } else if (noUpdates) {
    report.stages[3] = { ...report.stages[3], status: "completed", detail: "本次没有新内容，无需发布" };
  } else {
    report.stages[3] = { ...report.stages[3], status: "failed", detail: "没有通过检查的内容" };
  }

  report.status = report.publishedCount > 0 || isDryRun || noUpdates
    ? errors.length > 0 ? "completed_with_errors" : "completed"
    : "failed";
  report.finishedAt = new Date().toISOString();
  report.items = checked.accepted;
  await saveReport(report, outputPath);
  if (!isDryRun) {
    const publicRunSummary = { ...report };
    delete publicRunSummary.items;
    delete publicRunSummary.upload;
    await writeFile(
      join(root, "app/generated-run-summary.json"),
      `${JSON.stringify(publicRunSummary, null, 2)}\n`,
    );
  }
  await syncRunSummary(report);

  console.log(JSON.stringify({
    ok: report.status === "completed",
    itemCount: checked.accepted.length,
    errors,
    outputPath,
  }, null, 2));
  if (report.sources.length > 0 && report.sources.every((source) => source.status === "failed")) process.exitCode = 1;
}

await main();
