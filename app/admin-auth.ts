import { env } from "cloudflare:workers";
import { cookies, headers } from "next/headers";

export const ADMIN_COOKIE_NAME = "infohub-admin-session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

function adminPassword() {
  return ((env as unknown as { ADMIN_PASSWORD?: string }).ADMIN_PASSWORD || "").trim();
}

function toBase64Url(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

async function sameSecret(left: string, right: string) {
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(left)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < Math.min(leftBytes.length, rightBytes.length); index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

async function isLocalPreview() {
  const requestHeaders = await headers();
  const host = (requestHeaders.get("host") || "").split(":")[0];
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

export async function verifyAdminPassword(candidate: string) {
  const configured = adminPassword();
  if (!configured) return false;
  return sameSecret(candidate, configured);
}

export async function createAdminSession() {
  const configured = adminPassword();
  if (!configured) throw new Error("ADMIN_PASSWORD is not configured");
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = String(expiresAt);
  return {
    value: `${payload}.${await sign(payload, configured)}`,
    maxAge: SESSION_SECONDS,
  };
}

async function hasValidAdminSession() {
  const configured = adminPassword();
  if (!configured) return isLocalPreview();
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;
  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;
  return sameSecret(signature, await sign(expiresAt, configured));
}

export async function getAdminUser() {
  if (!(await hasValidAdminSession())) return null;
  return { displayName: "管理员" };
}

export async function adminLoginRequired() {
  return Boolean(adminPassword()) && !(await hasValidAdminSession());
}
