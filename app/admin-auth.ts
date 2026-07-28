import { env } from "cloudflare:workers";
import { getChatGPTUser } from "./chatgpt-auth";

export async function getAdminUser() {
  const user = await getChatGPTUser();
  if (!user) return null;

  const configuredEmail = (
    env as unknown as { ADMIN_EMAIL?: string }
  ).ADMIN_EMAIL?.trim().toLowerCase();

  if (configuredEmail && user.email.toLowerCase() !== configuredEmail) {
    return null;
  }

  return user;
}
