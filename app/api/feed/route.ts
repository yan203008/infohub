import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { appSettings, contents, sources } from "../../../db/schema";
import generatedFeed from "../../generated-feed.json";
import generatedSectionSummaries from "../../generated-section-summaries.json";

export async function GET() {
  try {
    const db = getDb();
    const [rows, summaryRows] = await Promise.all([
    db
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
    .where(eq(contents.status, "ready"))
    .orderBy(desc(contents.publishedAt))
    .limit(500),
    db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, "latestSectionSummaries"))
      .limit(1),
  ]);

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

  let sectionSummaries: unknown[] = [];
  try {
    const parsed = JSON.parse(summaryRows[0]?.value || "[]") as unknown;
    if (Array.isArray(parsed)) sectionSummaries = parsed;
  } catch {
    sectionSummaries = [];
  }

    const merged = new Map<string, unknown>();
    for (const item of generatedFeed) merged.set(item.id, item);
    for (const item of items) merged.set(item.id, item);
    return Response.json({
      items: [...merged.values()],
      sectionSummaries: sectionSummaries.length > 0 ? sectionSummaries : generatedSectionSummaries,
    });
  } catch {
    return Response.json({
      items: generatedFeed,
      sectionSummaries: generatedSectionSummaries,
      mode: "local-preview",
    });
  }
}
