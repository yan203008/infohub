interface Env {
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  ALLOWED_ORIGINS: string;
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

const gateway = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = allowedOrigin(request, env);
    if (request.method === "OPTIONS") {
      return origin ? new Response(null, { status: 204, headers: corsHeaders(origin) }) : new Response(null, { status: 403 });
    }
    if (!origin) return json({ error: "不允许的访问来源" }, 403, "null");
    const pathname = new URL(request.url).pathname;
    if (pathname === "/health" && request.method === "GET") return json({ ok: true }, 200, origin);
    if (pathname === "/login" && request.method === "POST") {
      const payload = await request.json().catch(() => ({})) as { password?: unknown };
      const password = typeof payload.password === "string" ? payload.password : "";
      if (!password || !await secureEqual(password, env.ADMIN_PASSWORD)) {
        return json({ error: "管理员密码不正确" }, 401, origin);
      }
      return json({ ok: true, token: await createSession(env.SESSION_SECRET) }, 200, origin);
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
};

export default gateway;
