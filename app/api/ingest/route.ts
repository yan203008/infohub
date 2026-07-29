import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { contents, sources } from "../../../db/schema";

type IngestSource = {
  id: string;
  type: "youtube" | "podcast" | "daily" | "builder" | "wechat";
  name: string;
  url: string;
};

type IngestItem = {
  externalId: string;
  source: IngestSource;
  title: string;
  sourceUrl: string;
  summary: string;
  publishedAt: string;
  keywords: string[];
  body: Record<string, unknown>;
};

function isAuthorized(request: Request) {
  const secret = (env as unknown as { INGEST_SECRET?: string }).INGEST_SECRET;
  return Boolean(
    secret && request.headers.get("authorization") === `Bearer ${secret}`,
  );
}

function validItem(value: unknown): value is IngestItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<IngestItem>;
  return Boolean(
    typeof item.externalId === "string" &&
      item.externalId.length > 0 &&
      item.externalId.length <= 180 &&
      item.source &&
      typeof item.source.id === "string" &&
      typeof item.source.name === "string" &&
      typeof item.source.url === "string" &&
      typeof item.title === "string" &&
      typeof item.sourceUrl === "string" &&
      typeof item.summary === "string" &&
      typeof item.publishedAt === "string" &&
      Array.isArray(item.keywords) &&
      item.body &&
      typeof item.body === "object",
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await getDb().select().from(sources);
  return Response.json({ sources: rows.filter((source) => source.enabled) });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as { items?: unknown };
  if (!Array.isArray(payload.items) || !payload.items.every(validItem)) {
    return Response.json({ error: "Invalid ingest payload" }, { status: 400 });
  }

  const db = getDb();
  const now = new Date();
  let accepted = 0;

  for (const item of payload.items) {
    const publishedAt = new Date(item.publishedAt);
    if (Number.isNaN(publishedAt.valueOf())) continue;

    await db
      .insert(sources)
      .values({
        id: item.source.id,
        type: item.source.type,
        name: item.source.name,
        url: item.source.url,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: sources.id,
        set: {
          type: item.source.type,
          name: item.source.name,
          url: item.source.url,
          enabled: true,
          updatedAt: now,
        },
      });

    await db
      .insert(contents)
      .values({
        id: `${item.source.id}:${item.externalId}`,
        sourceId: item.source.id,
        externalId: item.externalId,
        title: item.title,
        sourceUrl: item.sourceUrl,
        summary: item.summary,
        body: JSON.stringify(item.body),
        keywords: item.keywords.slice(0, 12),
        status: "ready",
        publishedAt,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [contents.sourceId, contents.externalId],
        set: {
          title: item.title,
          sourceUrl: item.sourceUrl,
          summary: item.summary,
          body: JSON.stringify(item.body),
          keywords: item.keywords.slice(0, 12),
          status: "ready",
          publishedAt,
          updatedAt: now,
        },
      });
    accepted += 1;
  }

  return Response.json({ ok: true, accepted });
}
