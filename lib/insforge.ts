import { createClient } from "@insforge/sdk";

/** Browser/anon client: public reads + realtime subscriptions only. */
export function getBrowserClient() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
  if (!baseUrl || !anonKey) {
    throw new Error("NEXT_PUBLIC_INSFORGE_URL / NEXT_PUBLIC_INSFORGE_ANON_KEY are not set");
  }
  cached ??= createClient({ baseUrl, anonKey });
  return cached;
}

let cached: ReturnType<typeof createClient> | undefined;

export const STATION_CHANNEL = "station:main";
