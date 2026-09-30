import { createAdminClient } from "@insforge/sdk";

/** Server-only admin client (full access). Never import from a client component. */
export function getAdminClient() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("NEXT_PUBLIC_INSFORGE_URL / INSFORGE_API_KEY are not set");
  }
  cached ??= createAdminClient({ baseUrl, apiKey });
  return cached;
}

let cached: ReturnType<typeof createAdminClient> | undefined;
