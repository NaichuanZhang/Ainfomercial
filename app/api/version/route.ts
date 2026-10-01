/** The deployed build's id, so open tabs (especially the director) can notice they are stale. */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { build: process.env.NEXT_PUBLIC_BUILD_ID ?? null },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
