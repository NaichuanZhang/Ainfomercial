import { publicChannel } from "@/lib/server/public-channel";
import { isClientId } from "@/lib/server/rate-limit";
import {
  claimLease,
  finishSegment,
  getChannel,
  holdsLease,
  pickNextCampaign,
  startSegment,
  updateChannel,
} from "@/lib/server/station";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DirectorRequest = {
  clientId?: unknown;
  action?: unknown;
  beatIndex?: unknown;
  prompt?: unknown;
  continuous?: unknown;
};

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0" } });

/** Every channel mutation the director tab makes; each one re-checks the lease. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as DirectorRequest;
  if (!isClientId(body.clientId)) return json({ error: "clientId required" }, 400);
  const clientId = body.clientId;

  try {
    if (body.action === "heartbeat") {
      const { channel, isDirector } = await claimLease(clientId);
      return json({ isDirector, channel: publicChannel(channel) });
    }

    const channel = await getChannel();
    if (!holdsLease(channel, clientId)) return json({ error: "Not the director", isDirector: false }, 409);

    switch (body.action) {
      case "next_segment": {
        await finishSegment(channel);
        const campaign = await pickNextCampaign(channel.airing_campaign_id);
        if (!campaign) {
          const next = await updateChannel({ status: "bumper", airing_campaign_id: null });
          return json({ campaign: null, channel: publicChannel(next) });
        }
        const next = await startSegment(campaign, body.continuous === true);
        return json({ campaign, channel: publicChannel(next) });
      }
      case "peek_next": {
        // Read-only look at who airs after the current product, so the director can have the host
        // put it down before the segment ends. Nothing is billed or re-queued here.
        const upcoming = await pickNextCampaign(channel.airing_campaign_id);
        return json({
          nextCampaignId: upcoming?.id ?? null,
          nextProductName: upcoming?.product_name ?? null,
          channel: publicChannel(channel),
        });
      }
      case "live": {
        const next = await updateChannel({ status: "live" });
        return json({ channel: publicChannel(next) });
      }
      case "beat": {
        const beatIndex = Number(body.beatIndex);
        const prompt = typeof body.prompt === "string" ? body.prompt.slice(0, 400) : null;
        if (!Number.isInteger(beatIndex) || beatIndex < 0) return json({ error: "beatIndex required" }, 400);
        const next = await updateChannel({ beat_index: beatIndex, current_prompt: prompt });
        return json({ channel: publicChannel(next) });
      }
      case "release": {
        await finishSegment(channel);
        const next = await updateChannel({ director_id: null, lease_until: null });
        return json({ channel: publicChannel(next) });
      }
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 502);
  }
}
