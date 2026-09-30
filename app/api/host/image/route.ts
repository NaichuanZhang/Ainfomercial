import { HOST_IMAGE_KEY } from "@/lib/station-types";

export const runtime = "nodejs";

/**
 * Same-origin copy of the host portrait (bucket product-images, seeded by scripts/seed-host.mjs),
 * so the parent workflow can composite the same fictional presenter into each Orbis start frame.
 */
export async function GET() {
  const base = process.env.NEXT_PUBLIC_INSFORGE_URL;
  if (!base) return new Response("Storage is not configured", { status: 500 });
  const source = `${base}/api/storage/buckets/product-images/objects/${encodeURIComponent(HOST_IMAGE_KEY)}`;
  const upstream = await fetch(source, { redirect: "follow", cache: "no-store" });
  if (!upstream.ok || !upstream.body) return new Response("Host portrait is not seeded", { status: 404 });
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
