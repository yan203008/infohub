import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { userPreferences } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";

const PREFERENCE_KEY = "home_sections";
const SECTION_IDS = ["x", "papers", "github", "youtube", "podcasts"] as const;

type SectionPreference = {
  id: (typeof SECTION_IDS)[number];
  visible: boolean;
};

function isValidPreferences(value: unknown): value is SectionPreference[] {
  if (!Array.isArray(value) || value.length !== SECTION_IDS.length) return false;
  const ids = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") return false;
    const candidate = item as { id?: unknown; visible?: unknown };
    if (!SECTION_IDS.includes(candidate.id as SectionPreference["id"])) return false;
    if (typeof candidate.visible !== "boolean" || ids.has(candidate.id as string)) return false;
    ids.add(candidate.id as string);
  }
  return ids.size === SECTION_IDS.length;
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await getDb()
    .select({ value: userPreferences.value })
    .from(userPreferences)
    .where(
      and(
        eq(userPreferences.userEmail, user.email),
        eq(userPreferences.key, PREFERENCE_KEY),
      ),
    )
    .limit(1);

  if (!rows[0]) return Response.json({ preferences: null });

  try {
    const preferences = JSON.parse(rows[0].value) as unknown;
    return Response.json({ preferences: isValidPreferences(preferences) ? preferences : null });
  } catch {
    return Response.json({ preferences: null });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { preferences?: unknown };
  if (!isValidPreferences(body.preferences)) {
    return Response.json({ error: "Invalid preferences" }, { status: 400 });
  }

  const now = new Date();
  const id = `${user.email}:${PREFERENCE_KEY}`;
  await getDb()
    .insert(userPreferences)
    .values({
      id,
      userEmail: user.email,
      key: PREFERENCE_KEY,
      value: JSON.stringify(body.preferences),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userPreferences.id,
      set: { value: JSON.stringify(body.preferences), updatedAt: now },
    });

  return Response.json({ ok: true });
}
