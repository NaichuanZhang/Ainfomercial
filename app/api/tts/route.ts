import { createHash } from "node:crypto";

import { getAdminClient } from "@/lib/server/insforge-admin";
import { clientIp, rateLimited } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Voice-mode host audio: OpenRouter text-to-speech, wrapped as WAV and cached in storage by
 * text hash (bucket product-images, prefix tts/), so every tab that speaks the same line and
 * every replay costs one generation.
 */
const TTS_URL = "https://openrouter.ai/api/v1/audio/speech";
const TTS_MODEL = process.env.OPENROUTER_TTS_MODEL ?? "google/gemini-3.8-flash-tts";
const TTS_VOICE = process.env.OPENROUTER_TTS_VOICE ?? "Puck";
/** OpenRouter's `pcm` format: 24 kHz, mono, signed 16-bit little-endian. */
const SAMPLE_RATE = 24_000;
const CHANNELS = 1;
const BITS = 16;
const MAX_CHARS = 1200;
const BUCKET = "product-images";

const inflight = new Map<string, Promise<Buffer>>();

const clean = (value: unknown) =>
  typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_CHARS) : "";

function wavFromPcm(pcm: Buffer) {
  const header = Buffer.alloc(44);
  const byteRate = (SAMPLE_RATE * CHANNELS * BITS) / 8;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE((CHANNELS * BITS) / 8, 32);
  header.writeUInt16LE(BITS, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function synthesize(text: string) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(TTS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "A.Infomercial host" },
      body: JSON.stringify({ model: TTS_MODEL, input: text, voice: TTS_VOICE, response_format: "pcm" }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`OpenRouter TTS ${response.status}: ${(await response.text()).slice(0, 200)}`);
    const pcm = Buffer.from(await response.arrayBuffer());
    if (pcm.length < 2_000) throw new Error("OpenRouter TTS returned no audio");
    return wavFromPcm(pcm);
  } finally {
    clearTimeout(timer);
  }
}

async function cached(key: string) {
  const base = process.env.NEXT_PUBLIC_INSFORGE_URL;
  if (!base) return null;
  const response = await fetch(`${base}/api/storage/buckets/${BUCKET}/objects/${encodeURIComponent(key)}`, {
    redirect: "follow",
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  return bytes.length > 44 ? bytes : null;
}

function speech(key: string, text: string) {
  let pending = inflight.get(key);
  if (!pending) {
    pending = (async () => {
      const hit = await cached(key);
      if (hit) return hit;
      const wav = await synthesize(text);
      // Best effort: a failed cache write only costs the next caller a generation.
      await getAdminClient()
        .storage.from(BUCKET)
        .upload(key, new Blob([new Uint8Array(wav)], { type: "audio/wav" }))
        .catch(() => undefined);
      return wav;
    })().finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  return pending;
}

/** POST { text } -> audio/wav. */
export async function POST(request: Request) {
  if (rateLimited(`tts:${clientIp(request)}`, 40, 60_000)) {
    return Response.json({ error: "Too many speech requests" }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as { text?: unknown };
  const text = clean(body.text);
  if (!text) return Response.json({ error: "text required" }, { status: 400 });
  const hash = createHash("sha256").update(`${TTS_MODEL}\n${TTS_VOICE}\n${text}`).digest("hex").slice(0, 32);
  const key = `tts/${hash}.wav`;
  try {
    const wav = await speech(key, text);
    return new Response(new Uint8Array(wav), {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(wav.length),
        "Cache-Control": "private, max-age=3600",
        "X-Tts-Key": key,
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
