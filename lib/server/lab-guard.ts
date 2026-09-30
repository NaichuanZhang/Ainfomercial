/**
 * The /lab playground routes mint unrestricted Reactor tokens and proxy paid model calls.
 * They are dev-only: on a deployed site they answer 403 unless LAB_ENABLED=1 is set.
 */
export function labDisabledResponse(): Response | null {
  const deployed = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  if (deployed && process.env.LAB_ENABLED !== "1") {
    return Response.json({ error: "The lab playground is disabled on this deployment." }, { status: 403 });
  }
  return null;
}
