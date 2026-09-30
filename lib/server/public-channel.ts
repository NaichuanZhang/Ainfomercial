import type { ChannelRow } from "@/lib/server/station";
import type { ChannelState } from "@/lib/station-types";

/** Strip the lease holder identity before sending channel state to a browser. */
export function publicChannel(channel: ChannelRow): ChannelState {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { director_id, lease_until, ...rest } = channel;
  return rest;
}
