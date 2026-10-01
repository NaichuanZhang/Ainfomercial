"use client";

import { useReactor, useReactorMessage } from "@reactor-team/js-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type OrbisMessage, unwrapOrbisMessage } from "@/lib/orbis";
import {
  HANDOFF_BEAT_INDEX,
  HANDOFF_LEAD_MS,
  HANDOFF_QUIET_MS,
  pickUpPrompt,
  putDownPrompt,
  RESET_SETTLE_MS,
} from "@/lib/handoff";
import {
  BEAT_SECONDS,
  type Campaign,
  type ChannelState,
  HOST_SILENT_DIRECTION,
  LEASE_RENEW_MS,
} from "@/lib/station-types";

type Waiter = { match: (m: OrbisMessage) => boolean; resolve: (m: OrbisMessage) => void };

export type DirectorApi = {
  /** Interrupt the scripted beats with a one-off shot (host answers use this). */
  cue: (prompt: string) => void;
  log: string[];
  error: string;
};

/** Every scene prompt keeps the host silent (see HOST_SILENT_DIRECTION). */
const silent = (prompt: string) =>
  prompt.includes("lips gently closed") ? prompt : `${prompt.replace(/\s+$/, "")} ${HOST_SILENT_DIRECTION}`;

const sleep = (ms: number, signal: { cancelled: boolean }) =>
  new Promise<void>((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (signal.cancelled || Date.now() - started >= ms) resolve();
      else setTimeout(tick, Math.min(250, ms));
    };
    tick();
  });

export async function directorCall(
  clientId: string,
  action: string,
  extra: Record<string, unknown> = {},
) {
  const response = await fetch("/api/station/director", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, action, ...extra }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    isDirector?: boolean;
    channel?: ChannelState;
    campaign?: Campaign | null;
    nextCampaignId?: string | null;
    nextProductName?: string | null;
  };
  if (!response.ok) {
    const error = new Error(body.error ?? `director ${action} failed (${response.status})`);
    (error as Error & { lostLease?: boolean }).lostLease = response.status === 409;
    throw error;
  }
  return body;
}

/**
 * The airing loop. Runs in exactly one browser tab (the lease holder) and drives the shared
 * Orbis session: stage the product image, start, walk the scripted beats, move to the next
 * highest bid when the segment ends. Everyone else just watches the same session.
 */
export function useDirector({
  clientId,
  enabled,
  onLostLease,
}: {
  clientId: string;
  enabled: boolean;
  onLostLease: () => void;
}): DirectorApi {
  const { status, sendCommand, uploadFile } = useReactor((state) => ({
    status: state.status,
    sendCommand: state.sendCommand,
    uploadFile: state.uploadFile,
  }));
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState("");
  const waiters = useRef(new Set<Waiter>());
  const runStarted = useRef(false);
  const cueQueue = useRef<string[]>([]);
  const onLostLeaseRef = useRef(onLostLease);
  onLostLeaseRef.current = onLostLease;

  const note = useCallback((line: string) => {
    setLog((current) => [`${new Date().toLocaleTimeString()} ${line}`, ...current].slice(0, 30));
  }, []);

  useReactorMessage((raw: unknown) => {
    const message = unwrapOrbisMessage(raw);
    if (message.type === "state" && typeof message.started === "boolean") {
      runStarted.current = message.started;
    }
    if (message.type === "generation_started") runStarted.current = true;
    if (message.type === "generation_reset" || message.type === "generation_complete") {
      runStarted.current = false;
    }
    for (const waiter of [...waiters.current]) {
      if (waiter.match(message)) {
        waiters.current.delete(waiter);
        waiter.resolve(message);
      }
    }
  });

  const waitFor = useCallback(
    (match: (m: OrbisMessage) => boolean, what: string, timeoutMs = 15_000) =>
      new Promise<OrbisMessage>((resolve, reject) => {
        const waiter: Waiter = {
          match,
          resolve: (m) => {
            clearTimeout(timer);
            resolve(m);
          },
        };
        const timer = setTimeout(() => {
          waiters.current.delete(waiter);
          reject(new Error(`Timed out waiting for ${what}`));
        }, timeoutMs);
        waiters.current.add(waiter);
      }),
    [],
  );

  const send = useCallback(
    async (command: string, args: Record<string, unknown> = {}) => {
      const raw = await sendCommand(command, args);
      const reply = raw ? unwrapOrbisMessage(raw) : null;
      if (reply?.type === "command_error") throw new Error(`${command}: ${reply.reason || "rejected"}`);
      return reply;
    },
    [sendCommand],
  );

  // Lease heartbeat. Losing it hands the loop to another tab.
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      directorCall(clientId, "heartbeat")
        .then((result) => {
          if (!result.isDirector) onLostLeaseRef.current();
        })
        .catch(() => undefined);
    }, LEASE_RENEW_MS);
    const release = () => {
      navigator.sendBeacon?.(
        "/api/station/director",
        new Blob([JSON.stringify({ clientId, action: "release" })], { type: "application/json" }),
      );
    };
    window.addEventListener("pagehide", release);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", release);
    };
  }, [clientId, enabled]);

  // The airing loop.
  useEffect(() => {
    if (!enabled || status !== "ready") return;
    const signal = { cancelled: false };
    let airingId: string | null = null;

    const stage = async (campaign: Campaign) => {
      if (runStarted.current) {
        // Every viewer tab freezes on the frame showing when channel_state flips to `bumper`.
        // Keep the old run alive until that realtime event has landed, so the held frame is the
        // empty-handed host and not a stalled stream.
        await sleep(RESET_SETTLE_MS, signal);
        if (signal.cancelled) return;
        note("reset for the next product");
        await send("reset").catch(() => null);
        await waitFor(
          (m) => m.type === "generation_reset" || (m.type === "state" && m.started === false),
          "reset",
          10_000,
        ).catch(() => null);
      }
      note(`staging ${campaign.product_name}`);
      const response = await fetch(`/api/campaigns/${campaign.id}/image`);
      if (!response.ok) throw new Error(`start image ${response.status}`);
      const blob = await response.blob();
      const file = new File([blob], `${campaign.id}.png`, { type: blob.type || "image/png" });
      const uploaded = await uploadFile(file, { name: file.name });
      const imageReady = waitFor((m) => m.type === "state" && m.has_image === true, "image", 20_000);
      await send("set_image", { image: uploaded });
      await imageReady;
      // No Orbis audio at all: with a host in frame it generated garbled speech over the TTS voice.
      // Viewers' tabs play their own background music (lib/client/lounge-music.ts) instead.
      await send("set_audio_enabled", { audio_enabled: false }).catch(() => null);
      const conditionsReady = waitFor((m) => m.type === "conditions_ready", "conditions", 20_000);
      // The start frame has the product resting on the pedestal: the run opens with the host
      // picking it up, and the scripted beats follow from beats[0].
      await send("set_prompt", { prompt: silent(pickUpPrompt(campaign.product_name)) });
      note(`handoff: pick up ${campaign.product_name}`);
      await conditionsReady.catch(() => null);
      const started = waitFor((m) => m.type === "generation_started", "generation start", 30_000);
      await send("start");
      await started;
      // The first picture lands by chunk 2 (~3.7 s after start).
      await waitFor((m) => m.type === "chunk_complete" && (m.chunk_index ?? 0) >= 2, "first frames", 15_000).catch(
        () => null,
      );
    };

    const loop = async () => {
      // Product the host set down at the end of the previous segment, if any.
      let putDownId: string | null = null;
      while (!signal.cancelled) {
        try {
          const { campaign, channel } = await directorCall(clientId, "next_segment");
          if (!campaign || !channel?.segment_ends_at) {
            note("queue empty, waiting");
            await sleep(10_000, signal);
            continue;
          }
          if (campaign.id !== airingId || !runStarted.current) {
            await stage(campaign);
            if (signal.cancelled) return;
            airingId = campaign.id;
          } else {
            note(`${campaign.product_name} stays on air`);
            if (putDownId === campaign.id) {
              // The queue changed after the put-down: have the host pick the same product back up.
              await send("set_prompt", { prompt: silent(pickUpPrompt(campaign.product_name)) });
              note(`handoff: pick up ${campaign.product_name}`);
            }
          }
          putDownId = null;
          await directorCall(clientId, "live");
          note(`on air: ${campaign.product_name}`);

          const endsAt = Date.parse(channel.segment_ends_at);
          const handoffAt = endsAt - HANDOFF_LEAD_MS;
          // The pick-up shot is on screen, so the first scripted beat is beats[0].
          let beat = -1;
          let lastPrompt = Date.now();
          // Who airs next, looked up once (read-only) shortly before the put-down is due.
          let upNext: { id: string | null; name: string | null } | null = null;
          while (!signal.cancelled && Date.now() < endsAt - 1_000) {
            await sleep(500, signal);
            const now = Date.now();

            if (!upNext && now >= handoffAt - HANDOFF_QUIET_MS) {
              upNext = await directorCall(clientId, "peek_next")
                .then((peek) => ({ id: peek.nextCampaignId ?? null, name: peek.nextProductName ?? null }))
                .catch((caught: Error & { lostLease?: boolean }) => {
                  if (caught.lostLease) throw caught;
                  // A failed look-ahead only costs the put-down; the segment plays out normally.
                  note(`peek failed: ${caught.message}`);
                  return { id: null, name: null };
                });
              if (upNext.id && upNext.id !== campaign.id) note(`up next: ${upNext.name ?? upNext.id}`);
            }
            const switching = !!upNext?.id && upNext.id !== campaign.id;
            if (switching) {
              // The put-down wins: a late Q&A shot would fight the morph, so it is dropped (the
              // spoken answer still plays on every tab).
              cueQueue.current = [];
              if (now >= handoffAt && putDownId !== campaign.id) {
                await send("set_prompt", { prompt: silent(putDownPrompt(campaign.product_name)) });
                putDownId = campaign.id;
                note(`handoff: put down ${campaign.product_name}`);
                // Marks the handoff in channel_state: every tab's host strip speaks the handoff line.
                await directorCall(clientId, "beat", {
                  beatIndex: HANDOFF_BEAT_INDEX,
                  prompt: putDownPrompt(campaign.product_name),
                });
              }
              // Quiet before the put-down, then hold the empty-handed shot until the segment ends.
              continue;
            }

            const cue = cueQueue.current.shift();
            const beatDue = now - lastPrompt >= BEAT_SECONDS * 1000;
            if (!cue && !beatDue) continue;
            if (now > endsAt - 4_000) break;
            let prompt: string;
            if (cue) {
              prompt = cue;
            } else {
              // A single scripted beat is sent once; longer scripts cycle.
              if (!campaign.beats.length || (campaign.beats.length < 2 && beat >= 0)) continue;
              beat = (beat + 1) % campaign.beats.length;
              prompt = campaign.beats[beat];
            }
            await send("set_prompt", { prompt: silent(prompt) });
            lastPrompt = Date.now();
            await directorCall(clientId, "beat", { beatIndex: Math.max(beat, 0), prompt });
          }
        } catch (caught) {
          const failure = caught as Error & { lostLease?: boolean };
          if (failure.lostLease) {
            onLostLeaseRef.current();
            return;
          }
          setError(failure.message);
          note(`error: ${failure.message}`);
          await sleep(5_000, signal);
        }
      }
    };

    void loop();
    return () => {
      signal.cancelled = true;
    };
  }, [clientId, enabled, note, send, status, uploadFile, waitFor]);

  const cue = useCallback((prompt: string) => {
    cueQueue.current = [prompt];
  }, []);

  return useMemo(() => ({ cue, log, error }), [cue, error, log]);
}
