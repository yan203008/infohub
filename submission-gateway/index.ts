import webpush from "web-push";

interface Env {
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  ALLOWED_ORIGINS: string;
  VAPID_PRIVATE_KEY: string;
  PUSH_SUBSCRIPTIONS: KVNamespace;
}

const encoder = new TextEncoder();

function allowedOrigin(request: Request, env: Env) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = env.ALLOWED_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : "";
}

function corsHeaders(origin: string) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function json(body: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders(origin) },
  });
}

function base64Url(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

async function secureEqual(left: string, right: string) {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

async function createSession(secret: string) {
  const payload = base64Url(JSON.stringify({ exp: Date.now() + 24 * 60 * 60 * 1000 }));
  return `${payload}.${await hmac(payload, secret)}`;
}

async function validSession(request: Request, secret: string) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !await secureEqual(signature, await hmac(payload, secret))) return false;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const parsed = JSON.parse(atob(normalized)) as { exp?: number };
    return typeof parsed.exp === "number" && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

type StoredPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
  lastSentDate?: string;
};

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

type GitHubFile = { content?: string; sha?: string };

function decodeBase64Utf8(value: string) {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(value: string) {
  const bytes = encoder.encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function githubHeaders(env: Env) {
  return {
    authorization: `Bearer ${env.GITHUB_TOKEN}`,
    accept: "application/vnd.github+json",
    "content-type": "application/json",
    "user-agent": "InfoHub-Curated-Editor/1.0",
    "x-github-api-version": "2022-11-28",
  };
}

async function readCuratedFile(env: Env) {
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}/contents/public/generated-curated.json?ref=main`;
  const response = await fetch(endpoint, { headers: githubHeaders(env) });
  if (response.status === 404) return { items: [] as Record<string, unknown>[], sha: undefined };
  if (!response.ok) throw new Error(`GitHub 读取失败（${response.status}）`);
  const file = await response.json() as GitHubFile;
  const items = file.content ? JSON.parse(decodeBase64Utf8(file.content)) as Record<string, unknown>[] : [];
  return { items: Array.isArray(items) ? items : [], sha: file.sha };
}

async function writeCuratedFile(env: Env, items: Record<string, unknown>[], sha?: string) {
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}/contents/public/generated-curated.json`;
  const response = await fetch(endpoint, {
    method: "PUT",
    headers: githubHeaders(env),
    body: JSON.stringify({
      message: "content: update curated article",
      content: encodeBase64Utf8(`${JSON.stringify(items, null, 2)}\n`),
      branch: "main",
      ...(sha ? { sha } : {}),
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub 发布失败（${response.status}）：${detail.slice(0, 180)}`);
  }
}

function validateCuratedDraft(value: unknown): CuratedDraft {
  if (!value || typeof value !== "object") throw new Error("内容格式无效");
  const draft = value as Partial<CuratedDraft>;
  const title = typeof draft.title === "string" ? draft.title.trim() : "";
  const cardSummary = typeof draft.cardSummary === "string" ? draft.cardSummary.trim() : "";
  const displayDate = typeof draft.displayDate === "string" ? draft.displayDate.trim() : "";
  const body = typeof draft.body === "string" ? draft.body.trim() : "";
  const type = draft.type === "podcast" || draft.type === "video" ? draft.type : "article";
  if (!title || !cardSummary || !body || !/^\d{4}-\d{2}-\d{2}$/.test(displayDate)) throw new Error("请完整填写标题、卡片摘要、展示日期和正文");
  const sourceUrl = typeof draft.sourceUrl === "string" ? draft.sourceUrl.trim() : "";
  if (sourceUrl) {
    try {
      const parsed = new URL(sourceUrl);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error("invalid");
    } catch {
      throw new Error("来源链接格式不正确");
    }
  }
  return {
    id: typeof draft.id === "string" && /^[a-zA-Z0-9-]{8,80}$/.test(draft.id) ? draft.id : crypto.randomUUID(),
    title: title.slice(0, 180),
    cardSummary: cardSummary.slice(0, 500),
    displayDate,
    type,
    takeaways: Array.isArray(draft.takeaways) ? draft.takeaways.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 20) : [],
    takeawayRaw: typeof draft.takeawayRaw === "string" ? draft.takeawayRaw.trim().slice(0, 50_000) : undefined,
    takeawayFormat: draft.takeawayFormat === "markdown" ? "markdown" : "simple",
    topics: Array.isArray(draft.topics) ? [...new Set(draft.topics.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 2) : [],
    body: body.slice(0, 200_000),
    sourceUrl: sourceUrl || undefined,
    status: "draft",
    updatedAt: new Date().toISOString(),
  };
}

async function readDraftIndex(env: Env) {
  return await env.PUSH_SUBSCRIPTIONS.get<string[]>("curated:index", "json") ?? [];
}

async function storeDraft(env: Env, draft: CuratedDraft) {
  const ids = await readDraftIndex(env);
  if (!ids.includes(draft.id)) await env.PUSH_SUBSCRIPTIONS.put("curated:index", JSON.stringify([draft.id, ...ids]));
  await env.PUSH_SUBSCRIPTIONS.put(`curated:draft:${draft.id}`, JSON.stringify(draft));
}

async function listDrafts(env: Env) {
  const ids = await readDraftIndex(env);
  const [storedDrafts, publicFile] = await Promise.all([
    Promise.all(ids.map((id) => env.PUSH_SUBSCRIPTIONS.get<CuratedDraft>(`curated:draft:${id}`, "json"))),
    readCuratedFile(env),
  ]);
  const merged = new Map<string, CuratedDraft>();
  publicFile.items.map(publicItemToDraft).filter((item): item is CuratedDraft => Boolean(item)).forEach((item) => merged.set(item.id, item));
  storedDrafts.filter((item): item is CuratedDraft => Boolean(item)).forEach((item) => merged.set(item.id, item));
  return [...merged.values()]
    .map((draft) => ({ ...draft, topics: Array.isArray(draft.topics) ? draft.topics : [], takeawayFormat: draft.takeawayFormat === "markdown" ? "markdown" as const : "simple" as const }))
    .map((draft) => draft.status === "scheduled" && draft.displayDate <= beijingDate() ? { ...draft, status: "live" as const } : draft)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function draftToPublicItem(draft: CuratedDraft) {
  const source = draft.type === "video" ? "youtube" : draft.type;
  const label = draft.type === "podcast" ? "播客" : draft.type === "video" ? "视频" : "文章";
  const paragraphs = draft.body.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const intro: string[] = [];
  const sections: { title: string; timeRange: string; paragraphs: string[] }[] = [];
  for (const block of paragraphs) {
    const heading = block.length <= 30 && !/[。！？.!?]$/.test(block) && !block.includes("\n");
    if (heading) sections.push({ title: block, timeRange: "", paragraphs: [] });
    else if (sections.length > 0) sections.at(-1)!.paragraphs.push(block);
    else intro.push(block);
  }
  return {
    id: `curated-${draft.id}`,
    source,
    sourceLabel: `编辑精选 · ${label}`,
    title: draft.title,
    summary: draft.cardSummary,
    time: "编辑精选",
    readTime: `${Math.max(1, Math.ceil(draft.body.length / 700))} 分钟`,
    accent: draft.type === "podcast" ? "orange" : draft.type === "video" ? "violet" : "blue",
    tags: [label, ...draft.topics],
    topics: draft.topics,
    digestDate: draft.displayDate,
    publishedDate: "编辑精选",
    sourceUrl: draft.sourceUrl ?? "",
    paragraphs: sections.length > 0 ? intro : paragraphs,
    ...(sections.length > 0 ? { sections: sections.filter((section) => section.paragraphs.length > 0) } : {}),
    takeaways: draft.takeaways,
    takeawayRaw: draft.takeawayRaw,
    takeawayFormat: draft.takeawayFormat,
    section: "reading",
    inRecentWindow: true,
    publishedAt: draft.updatedAt,
  };
}

function publicItemToDraft(item: Record<string, unknown>): CuratedDraft | null {
  const publicId = typeof item.id === "string" ? item.id : "";
  const title = typeof item.title === "string" ? item.title : "";
  const cardSummary = typeof item.summary === "string" ? item.summary : "";
  const displayDate = typeof item.digestDate === "string" ? item.digestDate : "";
  if (!publicId.startsWith("curated-") || !title || !displayDate) return null;
  const source = typeof item.source === "string" ? item.source : "article";
  const paragraphs = Array.isArray(item.paragraphs) ? item.paragraphs.filter((value): value is string => typeof value === "string") : [];
  const sections = Array.isArray(item.sections) ? item.sections as Array<{ title?: unknown; paragraphs?: unknown }> : [];
  const sectionBody = sections.flatMap((section) => [
    typeof section.title === "string" ? section.title : "",
    ...(Array.isArray(section.paragraphs) ? section.paragraphs.filter((value): value is string => typeof value === "string") : []),
  ]).filter(Boolean);
  return {
    id: publicId.slice("curated-".length),
    title,
    cardSummary,
    displayDate,
    type: source === "podcast" ? "podcast" : source === "youtube" ? "video" : "article",
    takeaways: Array.isArray(item.takeaways) ? item.takeaways.filter((value): value is string => typeof value === "string") : [],
    takeawayRaw: typeof item.takeawayRaw === "string" ? item.takeawayRaw : undefined,
    takeawayFormat: item.takeawayFormat === "markdown" ? "markdown" : "simple",
    topics: Array.isArray(item.topics) ? item.topics.filter((value): value is string => typeof value === "string").slice(0, 2) : [],
    body: [...paragraphs, ...sectionBody].join("\n\n"),
    sourceUrl: typeof item.sourceUrl === "string" && item.sourceUrl ? item.sourceUrl : undefined,
    status: displayDate > beijingDate() ? "scheduled" : "live",
    updatedAt: typeof item.publishedAt === "string" ? item.publishedAt : `${displayDate}T00:00:00.000Z`,
  };
}

const vapidPublicKey = "BHYk16-OvwseevB8UYWz7tyH9Q1rxVOSoLWCTQ43zKkJq7t7a4Ls8FCU8ecqY-w_8qTRDqig2QWpGN7z2OXRKUA";
const infoHubUrl = "https://yan203008.github.io/infohub/";

function validPushSubscription(value: unknown): value is StoredPushSubscription {
  if (!value || typeof value !== "object") return false;
  const subscription = value as Partial<StoredPushSubscription>;
  return typeof subscription.endpoint === "string"
    && subscription.endpoint.startsWith("https://")
    && typeof subscription.keys?.p256dh === "string"
    && typeof subscription.keys?.auth === "string";
}

async function subscriptionKey(endpoint: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(endpoint));
  return `subscription:${base64Url(new Uint8Array(digest))}`;
}

async function sendPush(env: Env, subscription: StoredPushSubscription, payload: { title: string; body: string; date?: string }) {
  webpush.setVapidDetails(infoHubUrl, vapidPublicKey, env.VAPID_PRIVATE_KEY);
  return webpush.sendNotification(subscription, JSON.stringify({ ...payload, url: infoHubUrl }));
}

function beijingDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

async function sendDailyDigestNotification(env: Env) {
  const today = beijingDate();
  if (await env.PUSH_SUBSCRIPTIONS.get("system:last-sent-date") === today) return;
  const [dailyResponse, curatedResponse] = await Promise.all([
    fetch(`https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/main/app/generated-feed.json`, { headers: { "user-agent": "InfoHub-Push/1.0" } }),
    fetch(`https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/main/public/generated-curated.json`, { headers: { "user-agent": "InfoHub-Push/1.0" } }),
  ]);
  if (!dailyResponse.ok) return;
  const feed = await dailyResponse.json() as Array<{ digestDate?: string; section?: string; id?: string; inRecentWindow?: boolean }>;
  const curated = curatedResponse.ok ? await curatedResponse.json() as Array<{ digestDate?: string }> : [];
  const dailyCount = feed.filter((item) => item.digestDate === today && (item.section === "x" || item.section === "papers" || item.section === "github") && item.inRecentWindow !== false).length;
  const curatedCount = curated.filter((item) => item.digestDate === today).length;
  if (dailyCount + curatedCount === 0) return;

  let cursor: string | undefined;
  let hasTransientFailure = false;
  do {
    const page = await env.PUSH_SUBSCRIPTIONS.list({ prefix: "subscription:", cursor, limit: 100 });
    await Promise.all(page.keys.map(async ({ name }) => {
      const subscription = await env.PUSH_SUBSCRIPTIONS.get<StoredPushSubscription>(name, "json");
      if (!subscription || subscription.lastSentDate === today) return;
      try {
        await sendPush(env, subscription, {
          title: "InfoHub 日报已更新",
          body: `今日更新：日报 ${dailyCount} 条${curatedCount ? `，精选 ${curatedCount} 篇` : ""}。`,
          date: today,
        });
        await env.PUSH_SUBSCRIPTIONS.put(name, JSON.stringify({ ...subscription, lastSentDate: today }));
      } catch (error) {
        const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
        if (statusCode === 404 || statusCode === 410) await env.PUSH_SUBSCRIPTIONS.delete(name);
        else hasTransientFailure = true;
      }
    }));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  if (!hasTransientFailure) await env.PUSH_SUBSCRIPTIONS.put("system:last-sent-date", today);
}

const gateway = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/health" && request.method === "GET") {
      return json({ ok: true }, 200, "*");
    }
    const origin = allowedOrigin(request, env);
    if (request.method === "OPTIONS") {
      return origin ? new Response(null, { status: 204, headers: corsHeaders(origin) }) : new Response(null, { status: 403 });
    }
    if (!origin) return json({ error: "不允许的访问来源" }, 403, "null");
    if (pathname === "/login" && request.method === "POST") {
      const payload = await request.json().catch(() => ({})) as { password?: unknown };
      const password = typeof payload.password === "string" ? payload.password : "";
      if (!password || !await secureEqual(password, env.ADMIN_PASSWORD)) {
        return json({ error: "管理员密码不正确" }, 401, origin);
      }
      return json({ ok: true, token: await createSession(env.SESSION_SECRET) }, 200, origin);
    }
    if (pathname === "/push/subscribe" && request.method === "POST") {
      const subscription = await request.json().catch(() => null);
      if (!validPushSubscription(subscription)) return json({ error: "通知订阅信息无效" }, 400, origin);
      await env.PUSH_SUBSCRIPTIONS.put(await subscriptionKey(subscription.endpoint), JSON.stringify(subscription));
      try {
        await sendPush(env, subscription, {
          title: "InfoHub 通知已开启",
          body: "每天新一期准备好后，我们会在这里提醒你。",
        });
      } catch {
        return json({ ok: true, warning: "订阅已保存，但测试通知发送失败" }, 202, origin);
      }
      return json({ ok: true }, 201, origin);
    }
    if (pathname === "/push/unsubscribe" && request.method === "POST") {
      const payload = await request.json().catch(() => ({})) as { endpoint?: unknown };
      if (typeof payload.endpoint !== "string") return json({ error: "通知订阅信息无效" }, 400, origin);
      await env.PUSH_SUBSCRIPTIONS.delete(await subscriptionKey(payload.endpoint));
      return json({ ok: true }, 200, origin);
    }
    if (pathname.startsWith("/curated/") && !await validSession(request, env.SESSION_SECRET)) {
      return json({ error: "管理员登录已失效" }, 401, origin);
    }
    if (pathname === "/curated/list" && request.method === "GET") {
      return json({ drafts: await listDrafts(env) }, 200, origin);
    }
    if (pathname === "/curated/save" && request.method === "POST") {
      try {
        const draft = validateCuratedDraft(await request.json());
        await storeDraft(env, draft);
        return json({ ok: true, draft }, 200, origin);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "保存失败" }, 400, origin);
      }
    }
    if (pathname === "/curated/publish" && request.method === "POST") {
      let draft: CuratedDraft | null = null;
      try {
        draft = { ...validateCuratedDraft(await request.json()), status: "publishing" };
        await storeDraft(env, draft);
        const file = await readCuratedFile(env);
        const publicItem = draftToPublicItem(draft);
        const items = [publicItem, ...file.items.filter((item) => item.id !== publicItem.id)];
        await writeCuratedFile(env, items, file.sha);
        draft = { ...draft, status: draft.displayDate > beijingDate() ? "scheduled" : "live", error: undefined, updatedAt: new Date().toISOString() };
        await storeDraft(env, draft);
        return json({ ok: true, draft }, 200, origin);
      } catch (error) {
        const message = error instanceof Error ? error.message : "发布失败";
        if (draft) await storeDraft(env, { ...draft, status: "failed", error: message, updatedAt: new Date().toISOString() });
        return json({ error: message }, 502, origin);
      }
    }
    if (pathname === "/curated/unpublish" && request.method === "POST") {
      const payload = await request.json().catch(() => ({})) as { id?: unknown };
      const id = typeof payload.id === "string" ? payload.id : "";
      if (!id) return json({ error: "内容编号无效" }, 400, origin);
      try {
        const file = await readCuratedFile(env);
        await writeCuratedFile(env, file.items.filter((item) => item.id !== `curated-${id}`), file.sha);
        const stored = await env.PUSH_SUBSCRIPTIONS.get<CuratedDraft>(`curated:draft:${id}`, "json");
        if (stored) await storeDraft(env, { ...stored, status: "withdrawn", updatedAt: new Date().toISOString() });
        return json({ ok: true }, 200, origin);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "撤回失败" }, 502, origin);
      }
    }
    if (pathname === "/curated/delete" && request.method === "POST") {
      const payload = await request.json().catch(() => ({})) as { id?: unknown };
      const id = typeof payload.id === "string" ? payload.id : "";
      if (!id) return json({ error: "内容编号无效" }, 400, origin);
      const stored = await env.PUSH_SUBSCRIPTIONS.get<CuratedDraft>(`curated:draft:${id}`, "json");
      if (!stored) return json({ error: "没有找到这篇草稿" }, 404, origin);
      if (stored.status === "live" || stored.status === "scheduled" || stored.status === "publishing") {
        return json({ error: "正在展示的文章请先隐藏，再删除记录" }, 409, origin);
      }
      const ids = await readDraftIndex(env);
      await Promise.all([
        env.PUSH_SUBSCRIPTIONS.delete(`curated:draft:${id}`),
        env.PUSH_SUBSCRIPTIONS.put("curated:index", JSON.stringify(ids.filter((value) => value !== id))),
      ]);
      return json({ ok: true }, 200, origin);
    }
    return json({ error: "Not found" }, 404, origin);
  },
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await sendDailyDigestNotification(env);
  },
};

export default gateway;
