import { env } from "cloudflare:workers";
import { getManualSubmissions, processManualSubmission } from "../../../../lib/manual-submissions";

function authorized(request: Request) {
  const secret = (env as unknown as { INGEST_SECRET?: string }).INGEST_SECRET?.trim();
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const scheduled = (await getManualSubmissions())
    .filter((submission) => submission.timing === "morning" && submission.status === "pending")
    .slice(0, 20);
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const submission of scheduled) {
    try {
      await processManualSubmission(submission.id);
      results.push({ id: submission.id, ok: true });
    } catch (error) {
      results.push({ id: submission.id, ok: false, error: error instanceof Error ? error.message : "处理失败" });
    }
  }
  return Response.json({ ok: results.every((result) => result.ok), processed: results.length, results });
}
