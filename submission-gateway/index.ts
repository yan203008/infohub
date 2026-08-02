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

async function triggerWorkflow(env: Env, url: string, timing: "immediate" | "morning", requestId: string) {
  return fetch(`https://api.github.com/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}/actions/workflows/process-curated.yml/dispatches`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "user-agent": "InfoHub-Submission-Gateway/1.0",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({ ref: "main", inputs: { url, timing, request_id: requestId } }),
  });
}

type StoredPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
  lastSentDate?: string;
};

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
  const response = await fetch(`https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/main/app/generated-feed.json`, {
    headers: { "user-agent": "InfoHub-Push/1.0" },
  });
  if (!response.ok) return;
  const feed = await response.json() as Array<{ digestDate?: string; section?: string; id?: string; inRecentWindow?: boolean }>;
  const count = feed.filter((item) => item.digestDate === today && item.section !== "reading" && !item.id?.startsWith("manual-") && item.inRecentWindow !== false).length;
  if (count === 0) return;

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
          body: `今天共整理 ${count} 条内容，点击查看最新一期。`,
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
    if (pathname === "/submit" && request.method === "POST") {
      if (!await validSession(request, env.SESSION_SECRET)) return json({ error: "管理员登录已失效" }, 401, origin);
      const payload = await request.json().catch(() => ({})) as { url?: unknown; timing?: unknown; requestId?: unknown };
      const url = typeof payload.url === "string" ? payload.url.trim() : "";
      const timing = payload.timing === "morning" ? "morning" : "immediate";
      const requestId = typeof payload.requestId === "string" ? payload.requestId.trim() : "";
      try {
        const parsed = new URL(url);
        if (!/^https?:$/.test(parsed.protocol)) throw new Error("invalid");
      } catch {
        return json({ error: "请输入有效的公开链接" }, 400, origin);
      }
      if (!/^[a-zA-Z0-9-]{8,80}$/.test(requestId)) return json({ error: "提交编号无效" }, 400, origin);
      const response = await triggerWorkflow(env, url, timing, requestId);
      if (!response.ok) return json({ error: "暂时无法启动处理任务，请稍后重试" }, 502, origin);
      return json({ ok: true, requestId, timing }, 202, origin);
    }
    return json({ error: "Not found" }, 404, origin);
  },
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await sendDailyDigestNotification(env);
  },
};

export default gateway;
