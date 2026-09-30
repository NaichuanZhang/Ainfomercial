import { getAdminClient } from "@/lib/server/insforge-admin";

export const runtime = "nodejs";

/**
 * Same-origin proxy for a campaign's Orbis start frame, so the director tab can fetch it as a
 * Blob for uploadFile() without depending on storage CDN CORS.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Bad id", { status: 400 });

  const db = getAdminClient().database;
  const result = await db.from("campaigns").select("staged_image_url,image_url").eq("id", id).limit(1);
  const row = result.data?.[0] as { staged_image_url: string | null; image_url: string | null } | undefined;
  const source = row?.staged_image_url || row?.image_url;
  if (!source) return new Response("No image", { status: 404 });
  if (!source.startsWith(process.env.NEXT_PUBLIC_INSFORGE_URL ?? "\u0000")) {
    return new Response("Image is not hosted on this project", { status: 400 });
  }

  const upstream = await fetch(source, { redirect: "follow", cache: "no-store" });
  if (!upstream.ok || !upstream.body) return new Response("Upstream failed", { status: 502 });
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": "public, max-age=300",
    },
  });
}
