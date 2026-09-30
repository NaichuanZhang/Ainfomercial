import { after } from "next/server";

import { runHostAnswers } from "@/lib/server/host-runner";
import { getAdminClient } from "@/lib/server/insforge-admin";
import { moderateChat, moderateHandle } from "@/lib/server/moderation";
import { clientIp, rateLimited } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";

/** Viewers post through the server: length caps, moderation, per-IP rate limit, no client DB writes. */
export async function POST(request: Request) {
  if (rateLimited(`chat:${clientIp(request)}`, 6, 30_000)) {
    return Response.json({ error: "Slow down a little: max 6 messages per 30 seconds." }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as { author?: unknown; body?: unknown };
  const author = moderateHandle(clean(body.author, 32));
  const moderated = moderateChat(clean(body.body, 280));
  if (moderated.rejected) return Response.json({ error: moderated.rejected }, { status: 400 });
  const text = moderated.text;

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
  // The host answers after the response is sent, so posting stays instant.
  after(() => runHostAnswers().catch((error) => console.warn("host answer failed", error)));
  return Response.json({ message: inserted.data?.[0] ?? null });
}
