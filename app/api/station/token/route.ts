import { publicChannel } from "@/lib/server/public-channel";
import { clientIp, isClientId, rateLimited } from "@/lib/server/rate-limit";
import { createChannelSession, isSessionAlive, mintAttachToken } from "@/lib/server/reactor";
import { airtimeRemaining, claimLease, updateChannel } from "@/lib/server/station";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

/**
 * One server-created Reactor session per channel. Every tab attaches to it with a bound
 * token; the lease holder (director) additionally drives the airing loop. The director's
 * tune-in is what (re)opens the studio when there is no live session.
 */
export async function POST(request: Request) {
  if (rateLimited(`token:${clientIp(request)}`, 20, 60_000)) {
    return Response.json({ error: "Too many requests" }, { status: 429, headers: NO_STORE });
  }
  const body = (await request.json().catch(() => ({}))) as { clientId?: unknown };
  if (!isClientId(body.clientId)) {
    return Response.json({ error: "clientId required" }, { status: 400, headers: NO_STORE });
  }

  try {
    let { channel, isDirector } = await claimLease(body.clientId);

    if (channel.session_id && !(await isSessionAlive(channel.session_id))) {
      channel = await updateChannel({ session_id: null, status: "offline" });
    }

    if (!channel.session_id) {
      if (!isDirector) {
        return Response.json({ role: "waiting", channel: publicChannel(channel) }, { status: 409, headers: NO_STORE });
      }
      if (airtimeRemaining(channel) <= 0) {
        return Response.json(
          { error: "The channel has used today's airtime allowance. Back tomorrow!", role: "off-air" },
          { status: 429, headers: NO_STORE },
        );
      }
      const sessionId = await createChannelSession();
      channel = await updateChannel({ session_id: sessionId, status: "bumper" });
    }

    const sessionId = channel.session_id as string;
    const token = await mintAttachToken(sessionId);
    return Response.json(
      { role: isDirector ? "director" : "viewer", sessionId, ...token, channel: publicChannel(channel) },
      { headers: NO_STORE },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502, headers: NO_STORE },
    );
  }
}
