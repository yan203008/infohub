import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { appSettings, sources } from "../../../../db/schema";
import { getAdminUser } from "../../../admin-auth";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const user = await getAdminUser();
  if (!user) return unauthorized();

  const db = getDb();
  const [sourceRows, settingRows] = await Promise.all([
    db.select().from(sources).orderBy(asc(sources.createdAt)),
    db.select().from(appSettings),
  ]);

  return Response.json({
    sources: sourceRows,
    settings: Object.fromEntries(
      settingRows.map((setting) => [setting.key, setting.value]),
    ),
  });
}

export async function POST(request: Request) {
  const user = await getAdminUser();
  if (!user) return unauthorized();

  const payload = (await request.json()) as
    | {
        action: "addSource";
        type: "youtube" | "podcast" | "daily" | "builder" | "wechat";
        name: string;
        url: string;
      }
    | { action: "deleteSource"; id: string }
    | { action: "toggleSource"; id: string; enabled: boolean }
    | { action: "saveSettings"; values: Record<string, string> };

  const db = getDb();
  const now = new Date();

  if (payload.action === "addSource") {
    const name = payload.name.trim();
    const url = payload.url.trim();
    if (!name || !url) {
      return Response.json({ error: "名称和链接不能为空" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    await db.insert(sources).values({
      id,
      type: payload.type,
      name,
      url,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
    return Response.json({ ok: true, id });
  }

  if (payload.action === "deleteSource") {
    await db.delete(sources).where(eq(sources.id, payload.id));
    return Response.json({ ok: true });
  }

  if (payload.action === "toggleSource") {
    await db
      .update(sources)
      .set({ enabled: payload.enabled, updatedAt: now })
      .where(eq(sources.id, payload.id));
    return Response.json({ ok: true });
  }

  if (payload.action === "saveSettings") {
    for (const [key, value] of Object.entries(payload.values)) {
      await db
        .insert(appSettings)
        .values({ key, value, updatedAt: now })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value, updatedAt: now },
        });
    }
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unsupported action" }, { status: 400 });
}
