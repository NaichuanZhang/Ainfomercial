import { generateHostScript, splitHostLines } from "@/lib/server/host-script";
import { getAdminClient } from "@/lib/server/insforge-admin";
import { clientIp, rateLimited } from "@/lib/server/rate-limit";
import { type Campaign, CAMPAIGN_PUBLIC_COLUMNS } from "@/lib/station-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const isId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

async function loadCampaign(id: string): Promise<Campaign | null> {
  const result = await getAdminClient().database.from("campaigns").select(CAMPAIGN_PUBLIC_COLUMNS).eq("id", id).limit(1);
  if (result.error) throw new Error(result.error.message);
  return (result.data?.[0] as Campaign | undefined) ?? null;
}

/** The stored host script (null until generated). */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isId(id)) return Response.json({ error: "Bad id" }, { status: 400 });
  try {
    const campaign = await loadCampaign(id);
    if (!campaign) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(
      { script: campaign.host_script ?? null, lines: campaign.host_lines ?? [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}

/**
 * Generate (or, unless `force`, reuse) the host's on-air script for a campaign and store it as
 * campaigns.host_script. Called after a campaign is submitted and by the director tab when a
 * product with no script comes on air.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isId(id)) return Response.json({ error: "Bad id" }, { status: 400 });
  if (rateLimited(`script:${clientIp(request)}`, 10, 60_000)) {
    return Response.json({ error: "Too many script requests; slow down." }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as { force?: unknown };

  try {
    const campaign = await loadCampaign(id);
    if (!campaign) return Response.json({ error: "Not found" }, { status: 404 });
    if (campaign.host_script && body.force !== true) {
      const lines = campaign.host_lines?.length
        ? campaign.host_lines
        : splitHostLines(campaign.host_script, Math.min(5, Math.max(1, campaign.beats.length || 5)));
      if (!campaign.host_lines?.length) {
        const backfill = await getAdminClient().database.from("campaigns").update({ host_lines: lines }).eq("id", id).select("id");
        if (backfill.error) return Response.json({ error: backfill.error.message }, { status: 502 });
      }
      return Response.json(
        { script: campaign.host_script, lines, cached: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const result = await generateHostScript(campaign);
    const updated = await getAdminClient()
      .database.from("campaigns")
      .update({ host_script: result.script, host_lines: result.lines })
      .eq("id", id)
      .select("id");
    if (updated.error) return Response.json({ error: updated.error.message }, { status: 502 });
    return Response.json({ ...result, cached: false }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json(
      { error: `Script generation failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 502 },
    );
  }
}
