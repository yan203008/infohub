import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "../../../db";
import { contents, sources } from "../../../db/schema";

function startOfYesterdayShanghai() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const todayUtc = new Date(`${values.year}-${values.month}-${values.day}T00:00:00+08:00`);
  return new Date(todayUtc.valueOf() - 24 * 60 * 60 * 1000);
}

export async function GET() {
  const rows = await getDb()
    .select({
      id: contents.id,
      title: contents.title,
      sourceUrl: contents.sourceUrl,
      summary: contents.summary,
      body: contents.body,
      keywords: contents.keywords,
      publishedAt: contents.publishedAt,
      sourceType: sources.type,
      sourceName: sources.name,
    })
    .from(contents)
    .innerJoin(sources, eq(contents.sourceId, sources.id))
    .where(
      and(
        eq(contents.status, "ready"),
        gte(contents.publishedAt, startOfYesterdayShanghai()),
      ),
    )
    .orderBy(desc(contents.publishedAt))
    .limit(100);

  const items = rows.flatMap((row) => {
    try {
      const body = JSON.parse(row.body) as Record<string, unknown>;
      return [{
        ...body,
        id: row.id,
        title: row.title,
        sourceUrl: row.sourceUrl,
        summary: row.summary,
        tags: row.keywords,
        source: row.sourceType,
        sourceLabel: row.sourceName,
        publishedAt: row.publishedAt?.toISOString() ?? null,
      }];
    } catch {
      return [];
    }
  });

  return Response.json({ items });
}
