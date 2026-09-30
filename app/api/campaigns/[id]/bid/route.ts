import { clampNumber } from "@/lib/server/campaign-input";
import { getAdminClient } from "@/lib/server/insforge-admin";
import { clientIp, rateLimited } from "@/lib/server/rate-limit";
import { CAMPAIGN_PUBLIC_COLUMNS } from "@/lib/station-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Open bidding: anyone can raise (or lower) a campaign's bid; the queue re-sorts live. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Bad id" }, { status: 400 });
  if (rateLimited(`bid:${clientIp(request)}`, 30, 60_000)) {
    return Response.json({ error: "Too many bids; slow down." }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as { bid_per_min?: unknown; budget?: unknown };
  const patch: Record<string, number> = { bid_per_min: clampNumber(body.bid_per_min, 1, 1000, Number.NaN) };
  if (!Number.isFinite(patch.bid_per_min)) return Response.json({ error: "bid_per_min required" }, { status: 400 });
  if (body.budget !== undefined) patch.budget = clampNumber(body.budget, 10, 100_000, 500);

  const updated = await getAdminClient()
    .database.from("campaigns")
    .update(patch)
    .eq("id", id)
    .select(CAMPAIGN_PUBLIC_COLUMNS);
  if (updated.error) return Response.json({ error: updated.error.message }, { status: 502 });
  if (!updated.data?.length) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ campaign: updated.data[0] });
}
