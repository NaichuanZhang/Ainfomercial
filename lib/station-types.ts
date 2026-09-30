/** Shared row shapes for the station tables (see migrations/). */

export type CampaignFact = { label: string; value: string };

export type CampaignStatus = "queued" | "airing" | "aired" | "paused";

export type Campaign = {
  id: string;
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
  /** What the AI host says when the product comes on air (<= 1200 chars, speakable text). */
  host_script: string | null;
  /** The script split into scene-beat-aligned spoken lines. */
  host_lines: string[];
  bid_per_min: number;
  budget: number;
  spent: number;
  airtime_seconds: number;
  status: CampaignStatus;
  created_at: string;
  updated_at: string;
};

export type ChannelStatus = "offline" | "bumper" | "live";

export type ChannelState = {
  id: "main";
  status: ChannelStatus;
  session_id: string | null;
  lease_until?: string | null;
  airing_campaign_id: string | null;
  segment_started_at: string | null;
  segment_ends_at: string | null;
  beat_index: number;
  current_prompt: string | null;
  airtime_day: string;
  airtime_seconds_day: number;
  updated_at: string;
};

export type ChatKind = "viewer" | "host" | "system";

export type ChatMessage = {
  id: number;
  author: string;
  body: string;
  kind: ChatKind;
  campaign_id: string | null;
  reply_to: number | null;
  visual_prompt: string | null;
  fact_label: string | null;
  created_at: string;
};

export const CAMPAIGN_PUBLIC_COLUMNS =
  "id,brand,product_name,tagline,image_url,staged_image_url,price,compare_at_price,look,taste,facts,beats,audio_prompt,host_script,host_lines,bid_per_min,budget,spent,airtime_seconds,status,created_at,updated_at";

export const CHANNEL_PUBLIC_COLUMNS =
  "id,status,session_id,airing_campaign_id,segment_started_at,segment_ends_at,beat_index,current_prompt,airtime_day,airtime_seconds_day,updated_at";

/** Seconds each product stays on air per segment. */
export const SEGMENT_SECONDS = 75;
/** Seconds between scripted scene beats (>= 2 chunks, so morphs land). */
export const BEAT_SECONDS = 9;
/** Director lease length; the director renews every LEASE_RENEW_MS. */
export const LEASE_TTL_SECONDS = 15;
export const LEASE_RENEW_MS = 5_000;

export const ORBIS_MODEL = "reactor/visko-orbis-stable";

/** The on-air host persona. */
export const HOST_NAME = "Max Marquee";
/** How Orbis should draw him: the host is part of the live picture, identity-locked by the start frame. */
export const HOST_LOOK =
  "the smiling host in his fifties with swept-back dark hair, a teal suit, white shirt and gold tie";
/** Storage key (bucket product-images) of the host portrait composited into every start frame. */
export const HOST_IMAGE_KEY = "demo/host.png";
/** Longest host script the campaigns.host_script column accepts. */
export const HOST_SCRIPT_MAX_CHARS = 1200;
