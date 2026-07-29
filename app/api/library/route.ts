import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { userContentStates } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

type ContentState = "saved" | "completed";

function isContentState(value: unknown): value is ContentState {
  return value === "saved" || value === "completed";
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await getDb()
    .select({ contentId: userContentStates.contentId, state: userContentStates.state })
    .from(userContentStates)
    .where(eq(userContentStates.userEmail, user.email));

  return Response.json({
    saved: rows.filter((row) => row.state === "saved").map((row) => row.contentId),
    completed: rows.filter((row) => row.state === "completed").map((row) => row.contentId),
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { contentId?: unknown; state?: unknown };
  if (
    typeof body.contentId !== "string" ||
    body.contentId.length === 0 ||
    body.contentId.length > 180 ||
    (body.state !== null && !isContentState(body.state))
  ) {
    return Response.json({ error: "Invalid content state" }, { status: 400 });
  }

  const db = getDb();
  const id = `${user.email}:${body.contentId}`;
  if (body.state === null) {
    await db
      .delete(userContentStates)
      .where(
        and(
          eq(userContentStates.userEmail, user.email),
          eq(userContentStates.contentId, body.contentId),
        ),
      );
    return Response.json({ ok: true });
  }

  await db
    .insert(userContentStates)
    .values({
      id,
      userEmail: user.email,
      contentId: body.contentId,
      state: body.state,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userContentStates.id,
      set: { state: body.state, updatedAt: new Date() },
    });

  return Response.json({ ok: true });
}
