import { cookies, headers } from "next/headers";
import {
  ADMIN_COOKIE_NAME,
  createAdminSession,
  verifyAdminPassword,
} from "../../../admin-auth";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof payload?.password === "string" ? payload.password : "";
  if (!password || !(await verifyAdminPassword(password))) {
    return Response.json({ error: "管理员密码不正确" }, { status: 401 });
  }

  const session = await createAdminSession();
  const requestHeaders = await headers();
  const protocol = requestHeaders.get("x-forwarded-proto") || "http";
  (await cookies()).set(ADMIN_COOKIE_NAME, session.value, {
    httpOnly: true,
    sameSite: "strict",
    secure: protocol === "https",
    path: "/",
    maxAge: session.maxAge,
  });
  return Response.json({ ok: true });
}

export async function DELETE() {
  (await cookies()).set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return Response.json({ ok: true });
}
