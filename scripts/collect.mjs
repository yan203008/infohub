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
const moonshotKey = process.env.MOONSHOT_API_KEY?.trim();
const moonshotBaseUrl = (process.env.MOONSHOT_BASE_URL || "https://api.moonshot.cn/v1").replace(/\/$/, "");
const moonshotModel = process.env.MOONSHOT_MODEL || "kimi-k3";

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
    .replace(/\s+/g, " ")
    .trim();
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
  const response = await fetchWithRetry(`${moonshotBaseUrl}/chat/completions`, {
    method: "POST",
    timeoutMs,
    headers: {
      authorization: `Bearer ${moonshotKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: moonshotModel,
      temperature: 1,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(input) },
      ],
    }),
  }, 1);
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Kimi returned an empty response");
  const jsonText = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(jsonText);
  } catch {
    return JSON.parse(jsonrepair(jsonText));
  }
}

function baseBody(section, publishedAt, extra = {}) {
  return {
    section,
    digestDate: shanghaiDate(new Date(publishedAt)),
    publishedDate: new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      month: "numeric",
      day: "numeric",
    }).format(new Date(publishedAt)),
    time: shanghaiDate(new Date(publishedAt)) === shanghaiDate() ? "今天采集" : "昨日采集",
    readTime: "3 分钟",
    accent: section === "x" ? "green" : section === "papers" ? "violet" : section === "github" ? "blue" : "orange",
    inRecentWindow: true,
    ...extra,
  };
}

async function collectFollowBuilders() {
  const feed = await fetchJson(config.followBuilders.url);
  const tweets = (feed.x || [])
    .flatMap((builder) => (builder.tweets || []).map((tweet) => ({
      ...tweet,
      builder: builder.name,
      bio: builder.bio,
    })))
    .filter((tweet) => recent(tweet.createdAt))
    .sort((a, b) => (b.likes || 0) - (a.likes || 0))
    .slice(0, 4);
  if (tweets.length === 0) return [];

  const processed = await kimiJson(
    "你是中文科技编辑。忠实处理 X 推文，不得编造。返回 JSON：{items:[{id,title,summary,translation,detail,keywords}]}。translation 是完整中文翻译；detail 补充原推文语境和含义，但必须明确区分原文与解释。keywords 为 3-6 个中文关键词。",
    tweets.map((tweet) => ({
      id: tweet.id,
      author: tweet.builder,
      bio: tweet.bio,
      text: tweet.text,
      url: tweet.url,
    })),
  );

  return (processed.items || []).flatMap((item) => {
    const tweet = tweets.find((entry) => String(entry.id) === String(item.id));
    if (!tweet) return [];
    const keywords = Array.isArray(item.keywords) ? item.keywords : ["X", "AI"];
    return [{
      externalId: String(tweet.id),
      source: {
        id: config.followBuilders.id,
        type: "builder",
        name: `${tweet.builder} · Follow Builders`,
        url: "https://github.com/zarazhangrui/follow-builders",
      },
      title: item.title,
      sourceUrl: tweet.url,
      summary: item.summary,
      publishedAt: tweet.createdAt,
      keywords,
      body: baseBody("x", tweet.createdAt, {
        paragraphs: [item.translation, item.detail].filter(Boolean),
      }),
    }];
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
      return href && href.split("/").length === 2 ? [href] : [];
    })
    .slice(0, 3);
}

async function collectGithub() {
  const html = await (await fetchWithRetry(config.github.url)).text();
  const repositories = trendingRepositories(html);
  if (repositories.length === 0) throw new Error("GitHub Trending returned no repositories");
  const details = await Promise.all(repositories.map(async (repository) => {
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
      forks: metadata.forks_count,
      license: metadata.license?.spdx_id,
      updatedAt: metadata.pushed_at,
      readme: readme.slice(0, 6_000),
    };
  }));

  const processed = await kimiJson(
    "你是开源项目编辑。根据仓库元数据与 README，返回 JSON：{items:[{repository,titleZh,summaryZh,paragraphs,keywords}]}。paragraphs 用 2-4 段说明项目用途、核心能力、适用人群和注意事项；不得编造 README 没有的功能。",
    details,
  );

  return (processed.items || []).flatMap((item) => {
    const repo = details.find((entry) => entry.repository === item.repository);
    if (!repo) return [];
    const publishedAt = now.toISOString();
    const keywords = Array.isArray(item.keywords) ? item.keywords : ["GitHub", "开源"];
    return [{
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
          { label: "许可证", value: repo.license || "未标注" },
          { label: "最近更新", value: shanghaiDate(new Date(repo.updatedAt)) },
        ],
        externalLinks: [
          { label: "阅读项目 README", url: `https://github.com/${repo.repository}#readme` },
          ...(repo.homepage ? [{ label: "打开项目网站", url: repo.homepage }] : []),
          { label: "查看 Releases", url: `https://github.com/${repo.repository}/releases` },
        ],
      }),
    }];
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

async function transcriptFor(videoId) {
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
  const youtubeSources = await configuredYoutubeSources();
  const videos = (await Promise.all(youtubeSources.map(async (channel) => {
    return (await youtubeFeed(channel.channelId))
      .filter((video) => recent(video.publishedAt))
      .map((video) => ({ ...video, channel }));
  }))).flat();

  const items = [];
  for (const video of videos) {
    const transcript = await transcriptFor(video.videoId);
    const processed = await kimiJson(
      "你是 YouTube 长内容编辑。完整覆盖文字稿，不删减论点、论据、案例、步骤、条件、例外和重要细节；删除无信息量口头禅与完全重复。先给可应用的 Takeaways，再按时间顺序整理成阅读友好的中文文章。返回 JSON：{title,summary,keywords,takeaways,sections:[{title,timeRange,paragraphs}]}。takeaways 5-10 条；每个 section 必须有起止时间戳；不得编造文字稿外信息。",
      { title: video.title, transcript },
      { maxTokens: 20_000, timeoutMs: 10 * 60 * 1000 },
    );
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
  }
  return items;
}

async function main() {
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
  const errors = [];
  const items = [];
  for (const [source, collect] of collectors) {
    console.error(`[collect] ${source} started`);
    try {
      items.push(...await collect());
      console.error(`[collect] ${source} finished`);
    } catch (error) {
      errors.push({ source, message: error?.message || String(error) });
      console.error(`[collect] ${source} failed: ${error?.message || String(error)}`);
    }
  }

  const report = {
    generatedAt: now.toISOString(),
    windowStart: cutoff.toISOString(),
    itemCount: items.length,
    items,
    errors,
  };
  const outputPath = join(root, `outputs/last-collection${requestedSource ? `-${requestedSource}` : ""}.json`);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);

  if (!isDryRun && items.length > 0) {
    const baseUrl = process.env.INFOHUB_BASE_URL?.replace(/\/$/, "");
    const ingestSecret = process.env.INGEST_SECRET?.trim();
    if (!baseUrl || !ingestSecret) {
      throw new Error("INFOHUB_BASE_URL and INGEST_SECRET are required for upload");
    }
    const response = await fetchWithRetry(`${baseUrl}/api/ingest`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ingestSecret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ items }),
    });
    report.upload = await response.json();
  }

  console.log(JSON.stringify({
    ok: errors.length === 0,
    itemCount: items.length,
    errors,
    outputPath,
  }, null, 2));
  if (errors.length === collectors.length) process.exitCode = 1;
}

await main();
