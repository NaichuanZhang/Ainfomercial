import { getAdminClient } from "@/lib/server/insforge-admin";
import { clientIp, rateLimited } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";

/** Viewers post through the server: length caps, per-IP rate limit, no client DB writes. */
export async function POST(request: Request) {
  if (rateLimited(`chat:${clientIp(request)}`, 6, 30_000)) {
    return Response.json({ error: "Slow down a little: max 6 messages per 30 seconds." }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as { author?: unknown; body?: unknown };
  const author = clean(body.author, 32) || "viewer";
  const text = clean(body.body, 280);
  if (!text) return Response.json({ error: "Message is empty" }, { status: 400 });

  const db = getAdminClient().database;
  const channel = await db.from("channel_state").select("airing_campaign_id").eq("id", "main").single();
  const inserted = await db
    .from("chat_messages")
    .insert([
      {
        author,
        body: text,
        kind: "viewer",
        campaign_id: (channel.data as { airing_campaign_id: string | null } | null)?.airing_campaign_id ?? null,
      },
    ])
    .select("*");
  if (inserted.error) return Response.json({ error: inserted.error.message }, { status: 502 });
  return Response.json({ message: inserted.data?.[0] ?? null });
}
