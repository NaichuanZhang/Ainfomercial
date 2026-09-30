import { parseCampaign } from "@/lib/server/campaign-input";
import { getAdminClient } from "@/lib/server/insforge-admin";
import { clientIp, rateLimited } from "@/lib/server/rate-limit";
import { CAMPAIGN_PUBLIC_COLUMNS } from "@/lib/station-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Submit a campaign into the open-bid queue. */
export async function POST(request: Request) {
  if (rateLimited(`campaign:${clientIp(request)}`, 10, 10 * 60_000)) {
    return Response.json({ error: "Too many campaigns from this network; try again later." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });
  const { campaign, error } = parseCampaign(body);
  if (!campaign) return Response.json({ error }, { status: 400 });

  const inserted = await getAdminClient()
    .database.from("campaigns")
    .insert([{ ...campaign, status: "queued" }])
    .select(CAMPAIGN_PUBLIC_COLUMNS);
  if (inserted.error) return Response.json({ error: inserted.error.message }, { status: 502 });
  const row = inserted.data?.[0] as { id: string } | undefined;

  // Host script generation is best-effort and must not delay the advertiser.
  if (row?.id) {
    void fetch(new URL(`/api/campaigns/${row.id}/script`, request.url), { method: "POST" }).catch(() => undefined);
  }
  return Response.json({ campaign: row });
}
