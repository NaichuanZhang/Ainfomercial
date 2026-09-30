import { getAdminClient } from "@/lib/server/insforge-admin";

export const dynamic = "force-dynamic";

/** Liveness + config check: proves the deployment can reach InsForge and has its keys. */
export async function GET() {
  const env = {
    insforge: Boolean(process.env.NEXT_PUBLIC_INSFORGE_URL && process.env.INSFORGE_API_KEY),
    reactor: Boolean(process.env.REACTOR_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
  };
  try {
    const { data, error } = await getAdminClient()
      .database.from("channel_state")
      .select("status")
      .eq("id", "main")
      .single();
    if (error) throw new Error(error.message);
    return Response.json({ ok: true, env, channel: data?.status ?? null });
  } catch (err) {
    return Response.json(
      { ok: false, env, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
