import { getAdminClient } from "@/lib/server/insforge-admin";
import {
  type Campaign,
  CAMPAIGN_PUBLIC_COLUMNS,
  type ChannelState,
  LEASE_TTL_SECONDS,
  SEGMENT_SECONDS,
} from "@/lib/station-types";

export type ChannelRow = ChannelState & { director_id: string | null; lease_until: string | null };

/** Daily cap on on-air seconds, so a stuck director cannot drain the credit balance. */
export const DAILY_AIRTIME_CAP_SECONDS = Number(process.env.DAILY_AIRTIME_CAP_SECONDS ?? 3 * 3600);

function db() {
  return getAdminClient().database;
}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${what}: no data`);
  return result.data;
}

export async function getChannel(): Promise<ChannelRow> {
  return unwrap(await db().from("channel_state").select("*").eq("id", "main").single(), "read channel");
}

export async function claimLease(clientId: string): Promise<{ channel: ChannelRow; isDirector: boolean }> {
  const channel = unwrap<ChannelRow>(
    await db().rpc("claim_director", { p_client: clientId, p_ttl_seconds: LEASE_TTL_SECONDS }),
    "claim lease",
  );
  return { channel, isDirector: channel.director_id === clientId };
}

export function holdsLease(channel: ChannelRow, clientId: string) {
  return (
    channel.director_id === clientId &&
    channel.lease_until !== null &&
    new Date(channel.lease_until).getTime() > Date.now()
  );
}

export function airtimeRemaining(channel: ChannelRow) {
  const today = new Date().toISOString().slice(0, 10);
  const used = channel.airtime_day === today ? channel.airtime_seconds_day : 0;
  return Math.max(0, DAILY_AIRTIME_CAP_SECONDS - used);
}

export type ChannelPatch = Partial<
  Pick<
    ChannelRow,
    | "status"
    | "session_id"
    | "airing_campaign_id"
    | "segment_started_at"
    | "segment_ends_at"
    | "beat_index"
    | "current_prompt"
    | "director_id"
    | "lease_until"
  >
>;

export async function updateChannel(patch: ChannelPatch) {
  return unwrap<ChannelRow[]>(
    await db().from("channel_state").update(patch).eq("id", "main").select("*"),
    "update channel",
  )[0];
}

async function getCampaign(id: string): Promise<Campaign | null> {
  const result = await db().from("campaigns").select(CAMPAIGN_PUBLIC_COLUMNS).eq("id", id).limit(1);
  if (result.error) throw new Error(`read campaign: ${result.error.message}`);
  return (result.data?.[0] as Campaign | undefined) ?? null;
}

/**
 * Open bidding: the highest bid_per_min among queued campaigns with budget left airs next;
 * ties go to the earliest submission. With an empty queue the channel re-airs the most
 * recent campaign so it never goes dark.
 */
export async function pickNextCampaign(currentId: string | null): Promise<Campaign | null> {
  const queued = await db()
    .from("campaigns")
    .select(CAMPAIGN_PUBLIC_COLUMNS)
    .in("status", ["queued", "airing"])
    .order("bid_per_min", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(20);
  if (queued.error) throw new Error(`read queue: ${queued.error.message}`);
  const candidates = ((queued.data ?? []) as Campaign[]).filter((c) => Number(c.spent) < Number(c.budget));
  // Prefer someone other than the product that just aired, when anyone else is waiting.
  const others = candidates.filter((c) => c.id !== currentId);
  if (others.length) return others[0];
  if (candidates.length) return candidates[0];

  const fallback = await db()
    .from("campaigns")
    .select(CAMPAIGN_PUBLIC_COLUMNS)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (fallback.error) throw new Error(`read fallback: ${fallback.error.message}`);
  return ((fallback.data ?? []) as Campaign[])[0] ?? null;
}

/** Close out the airing segment: bill bid x minutes, count airtime, requeue or retire. */
export async function finishSegment(channel: ChannelRow) {
  if (!channel.airing_campaign_id || !channel.segment_started_at) return;
  const seconds = Math.max(
    0,
    Math.min(SEGMENT_SECONDS * 2, Math.round((Date.now() - new Date(channel.segment_started_at).getTime()) / 1000)),
  );
  const campaign = await getCampaign(channel.airing_campaign_id);
  if (campaign) {
    const spent = Number(campaign.spent) + (Number(campaign.bid_per_min) * seconds) / 60;
    const exhausted = spent >= Number(campaign.budget);
    await db()
      .from("campaigns")
      .update({
        spent: Math.min(spent, Number(campaign.budget)).toFixed(2),
        airtime_seconds: campaign.airtime_seconds + seconds,
        status: exhausted ? "aired" : "queued",
      })
      .eq("id", campaign.id);
  }
  const today = new Date().toISOString().slice(0, 10);
  const usedToday = channel.airtime_day === today ? channel.airtime_seconds_day : 0;
  await db()
    .from("channel_state")
    .update({ airtime_day: today, airtime_seconds_day: usedToday + seconds })
    .eq("id", "main");
}

export async function startSegment(campaign: Campaign) {
  const now = Date.now();
  await db().from("campaigns").update({ status: "airing" }).eq("id", campaign.id);
  return updateChannel({
    status: "bumper",
    airing_campaign_id: campaign.id,
    segment_started_at: new Date(now).toISOString(),
    segment_ends_at: new Date(now + SEGMENT_SECONDS * 1000).toISOString(),
    beat_index: 0,
    current_prompt: campaign.beats[0] ?? null,
  });
}
