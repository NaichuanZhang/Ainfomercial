import { deleteReactorSession } from "@/lib/server/reactor";
import { finishSegment, getChannel, updateChannel } from "@/lib/server/station";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Seconds without a director heartbeat before the channel session is shut down. */
const IDLE_SECONDS = 60;

/**
 * Called every minute by an InsForge schedule (header x-reaper-secret). Ends the Orbis session
 * when nobody has directed it for a minute, which is what stops credit spend once the last
 * viewer leaves.
 */
export async function POST(request: Request) {
  const secret = process.env.REAPER_SECRET;
  if (!secret || request.headers.get("x-reaper-secret") !== secret) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const channel = await getChannel();
  if (!channel.session_id) return Response.json({ reaped: false, reason: "no session" });

  const leaseEnd = channel.lease_until ? Date.parse(channel.lease_until) : 0;
  const idleFor = (Date.now() - leaseEnd) / 1000;
  if (idleFor < IDLE_SECONDS) return Response.json({ reaped: false, idleFor: Math.round(idleFor) });

  await finishSegment(channel);
  const deleted = await deleteReactorSession(channel.session_id);
  await updateChannel({ session_id: null, status: "offline", director_id: null, lease_until: null });
  await getChannel(); // re-read so the publish trigger has fired before we answer
  return Response.json({ reaped: true, deleted, idleFor: Math.round(idleFor) });
}
