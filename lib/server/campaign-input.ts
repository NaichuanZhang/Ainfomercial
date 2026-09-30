import type { CampaignFact } from "@/lib/station-types";

/** Server-side validation for advertiser input: every limit mirrors a CHECK in migrations/. */

const text = (value: unknown, max: number) =>
  typeof value === "string"
    ? value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : "";

const optional = (value: unknown, max: number) => text(value, max) || null;

const clampNumber = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed * 100) / 100));
};

export function cleanFacts(value: unknown): CampaignFact[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const fact = item as { label?: unknown; value?: unknown };
      return { label: text(fact?.label, 40), value: text(fact?.value, 80) };
    })
    .filter((fact) => fact.label && fact.value)
    .slice(0, 12);
}

export function cleanBeats(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((beat) => text(beat, 400)).filter(Boolean).slice(0, 8);
}

export type CampaignInput = {
  brand: string;
  product_name: string;
  tagline: string | null;
  image_url: string | null;
  image_key: string | null;
  staged_image_url: string | null;
  staged_image_key: string | null;
  price: string | null;
  compare_at_price: string | null;
  look: string | null;
  taste: string | null;
  facts: CampaignFact[];
  beats: string[];
  audio_prompt: string | null;
  bid_per_min: number;
  budget: number;
};

const storagePrefix = () =>
  `${process.env.NEXT_PUBLIC_INSFORGE_URL ?? ""}/api/storage/buckets/product-images/objects/`;

/** Only accept image URLs that point at this project's product-images bucket. */
function ownImage(url: unknown, key: unknown) {
  const u = text(url, 600);
  const k = text(key, 300);
  if (!u || !k || !u.startsWith(storagePrefix())) return { url: null, key: null };
  return { url: u, key: k };
}

export function parseCampaign(body: Record<string, unknown>): { campaign?: CampaignInput; error?: string } {
  const brand = text(body.brand, 60);
  const productName = text(body.product_name, 80);
  if (!brand) return { error: "Brand is required" };
  if (!productName) return { error: "Product name is required" };
  const image = ownImage(body.image_url, body.image_key);
  const staged = ownImage(body.staged_image_url, body.staged_image_key);
  if (!image.url && !staged.url) return { error: "Upload a product image first" };
  const beats = cleanBeats(body.beats);
  if (!beats.length) return { error: "Add at least one scene beat" };
  return {
    campaign: {
      brand,
      product_name: productName,
      tagline: optional(body.tagline, 140),
      image_url: image.url ?? staged.url,
      image_key: image.key ?? staged.key,
      staged_image_url: staged.url,
      staged_image_key: staged.key,
      price: optional(body.price, 24),
      compare_at_price: optional(body.compare_at_price, 24),
      look: optional(body.look, 400),
      taste: optional(body.taste, 400),
      facts: cleanFacts(body.facts),
      beats,
      audio_prompt: optional(body.audio_prompt, 300),
      bid_per_min: clampNumber(body.bid_per_min, 1, 1000, 10),
      budget: clampNumber(body.budget, 10, 100_000, 500),
    },
  };
}

export { clampNumber, text as cleanText };
