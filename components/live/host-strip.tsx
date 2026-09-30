"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type Campaign, type ChannelState, HOST_NAME } from "@/lib/station-types";

export type HostApi = {
  /** Play a chat answer now, interrupting the current beat line. */
  say: (text: string) => void;
  /** Call synchronously from the Tune in click to satisfy browser audio policy. */
  unlock: () => void;
  log: string[];
  error: string;
};

type SpokenLine = { text: string; progress: number; speaking: boolean; status?: string };

const IDLE: SpokenLine = { text: "", progress: 0, speaking: false };

// A real PCM WAV header plus a few silent samples. Reusing the same Audio element after this
// user-gesture play unlocks the later, pre-generated host lines.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRkwAAABXQVZFZm10IBAAAAABAAEAwF0AAMBdAAACABAAZGF0YSgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

/** Page-local decoded URLs; the server independently caches the WAV bytes in storage by hash. */
const speechCache = new Map<string, Promise<string>>();

async function speechUrl(text: string) {
  let pending = speechCache.get(text);
  if (!pending) {
    pending = (async () => {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Host voice failed (${response.status})`);
      }
      return URL.createObjectURL(await response.blob());
    })();
    speechCache.set(text, pending);
    pending.catch(() => speechCache.delete(text));
  }
  return pending;
}

function captionWindow(text: string, progress: number, windowWords = 18) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return { spoken: "", ahead: "" };
  const spokenCount = Math.min(words.length, Math.max(0, Math.floor(progress * words.length)));
  const start = Math.max(0, Math.min(spokenCount - Math.floor(windowWords / 2), words.length - windowWords));
  const end = Math.min(words.length, start + windowWords);
  return {
    spoken: `${start > 0 ? "…" : ""}${words.slice(start, spokenCount).join(" ")}`,
    ahead: `${words.slice(Math.max(start, spokenCount), end).join(" ")}${end < words.length ? " …" : ""}`,
  };
}

/**
 * Audio-only on-air host. Orbis renders the presenter in the main picture; this compact strip
 * identifies Max, animates while cached Gemini TTS plays, and captions the current beat line.
 * Every tuned tab follows channel_state.beat_index. `say` interrupts a beat for live Q&A.
 */
export function HostStrip({
  active,
  muted,
  channel,
  airing,
  onHost,
}: {
  active: boolean;
  muted: boolean;
  channel: ChannelState | null;
  airing: Campaign | null;
  onHost?: (api: HostApi | null) => void;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef(active);
  const generation = useRef(0);
  const lastBeat = useRef<string | null>(null);
  const [line, setLine] = useState<SpokenLine>(IDLE);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [generatedLines, setGeneratedLines] = useState<Record<string, string[]>>({});
  const requestedScripts = useRef(new Set<string>());
  activeRef.current = active;
  const hostLines = airing?.host_lines?.length
    ? airing.host_lines
    : airing
      ? (generatedLines[airing.id] ?? [])
      : [];

  const note = useCallback((entry: string) => {
    setLog((lines) => [`${new Date().toLocaleTimeString()} host: ${entry}`, ...lines].slice(0, 30));
  }, []);

  useEffect(() => {
    const element = new Audio();
    element.preload = "auto";
    audio.current = element;
    const update = () => {
      setLine((current) => {
        if (!current.text) return current;
        const progress = element.duration ? Math.min(1, element.currentTime / element.duration) : current.progress;
        return { ...current, progress, speaking: !element.paused && !element.ended };
      });
    };
    const complete = () => setLine((current) => ({ ...current, progress: 1, speaking: false }));
    element.addEventListener("timeupdate", update);
    element.addEventListener("play", update);
    element.addEventListener("pause", update);
    element.addEventListener("ended", complete);
    return () => {
      element.pause();
      element.removeEventListener("timeupdate", update);
      element.removeEventListener("play", update);
      element.removeEventListener("pause", update);
      element.removeEventListener("ended", complete);
      audio.current = null;
    };
  }, []);

  useEffect(() => {
    if (audio.current) audio.current.muted = muted;
  }, [muted]);

  const unlock = useCallback(() => {
    const element = audio.current;
    if (!element) return;
    element.src = SILENT_WAV;
    element.muted = false;
    element.volume = 0;
    void element.play().then(() => {
      element.pause();
      element.currentTime = 0;
      element.volume = 1;
      element.muted = muted;
    });
  }, [muted]);

  const play = useCallback(
    async (text: string, what: string) => {
      const clean = text.trim();
      const element = audio.current;
      if (!clean || !element || !activeRef.current) return;
      const mine = ++generation.current;
      element.pause();
      setError("");
      setLine({ text: clean, progress: 0, speaking: false, status: "Getting the next line ready…" });
      try {
        const url = await speechUrl(clean);
        if (mine !== generation.current || !activeRef.current) return;
        element.src = url;
        element.muted = muted;
        setLine({ text: clean, progress: 0, speaking: true });
        await element.play();
        note(`${what}: ${clean.split(/\s+/).length} words`);
      } catch (caught) {
        if (mine !== generation.current) return;
        const message = caught instanceof Error ? caught.message : String(caught);
        setError(message);
        setLine({ text: clean, progress: 0, speaking: false, status: "Host voice unavailable" });
        note(`error: ${message}`);
      }
    },
    [muted, note],
  );

  // Legacy seeded campaigns may predate host_script. Generate the script and aligned lines once
  // when they enter this tab, then pre-generate all five WAVs before Tune in.
  useEffect(() => {
    if (!airing || airing.host_lines?.length || requestedScripts.current.has(airing.id)) return;
    requestedScripts.current.add(airing.id);
    void fetch(`/api/campaigns/${airing.id}/script`, { method: "POST" })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as { lines?: string[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? `Host script failed (${response.status})`);
        const lines = Array.isArray(body.lines) ? body.lines.filter((text) => typeof text === "string" && text.trim()) : [];
        if (lines.length) setGeneratedLines((current) => ({ ...current, [airing.id]: lines }));
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : String(caught));
        requestedScripts.current.delete(airing.id);
      });
  }, [airing]);

  useEffect(() => {
    if (!hostLines.length) return;
    void Promise.allSettled(hostLines.map((text) => speechUrl(text)));
  }, [hostLines]);

  // Every tab follows the shared Orbis beat. A segment key makes beat zero play once per segment.
  useEffect(() => {
    if (!active || channel?.status !== "live" || !channel.segment_started_at || !hostLines.length || !airing) return;
    if (airing.id !== channel.airing_campaign_id) return;
    const key = `${airing.id}:${channel.segment_started_at}:${channel.beat_index}`;
    if (lastBeat.current === key) return;
    lastBeat.current = key;
    const text = hostLines[channel.beat_index % hostLines.length];
    if (text) void play(text, `beat ${channel.beat_index + 1}`);
  }, [active, airing, channel, hostLines, play]);

  useEffect(() => {
    if (active) return;
    generation.current += 1;
    audio.current?.pause();
    lastBeat.current = null;
    setLine(IDLE);
  }, [active]);

  const say = useCallback((text: string) => void play(text, "answer"), [play]);
  const api = useMemo<HostApi>(() => ({ say, unlock, log, error }), [error, log, say, unlock]);
  const onHostRef = useRef(onHost);
  onHostRef.current = onHost;
  useEffect(() => {
    onHostRef.current?.(api);
  }, [api]);
  useEffect(() => () => onHostRef.current?.(null), []);

  const caption = captionWindow(line.text, line.progress);
  return (
    <aside className={`host-strip${line.speaking ? " speaking" : ""}`} aria-label="AI host voice">
      <div className="host-strip-identity">
        <strong>{HOST_NAME}</strong>
        <span aria-hidden>·</span>
        <span>AI host</span>
      </div>
      <span className="voice-bars" aria-label={line.speaking ? "Speaking" : "Standing by"}>
        <i />
        <i />
        <i />
      </span>
      <p className="host-caption" aria-live="off">
        {line.text ? (
          <>
            <span className="cap-said">{caption.spoken}</span>{" "}
            <span className="cap-ahead">{caption.ahead}</span>
          </>
        ) : (
          <span className="cap-status">{active ? "Standing by for the next beat" : "Tune in to hear Max"}</span>
        )}
      </p>
    </aside>
  );
}
