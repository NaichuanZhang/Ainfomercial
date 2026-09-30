"use client";

import { useReactor, useReactorMessage } from "@reactor-team/js-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type OrbisMessage, unwrapOrbisMessage } from "@/lib/orbis";
import {
  BEAT_SECONDS,
  type Campaign,
  CHANNEL_AUDIO_PROMPT,
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
      // Instrumental only: the host's voice is TTS layered on top, never Orbis audio.
      await send("set_audio_prompt", { prompt: CHANNEL_AUDIO_PROMPT });
      const conditionsReady = waitFor((m) => m.type === "conditions_ready", "conditions", 20_000);
      await send("set_prompt", { prompt: silent(campaign.beats[0] ?? `${campaign.product_name} on a studio counter`) });
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
            airingId = campaign.id;
          } else {
            note(`${campaign.product_name} stays on air`);
          }
          await directorCall(clientId, "live");
          note(`on air: ${campaign.product_name}`);

          const endsAt = Date.parse(channel.segment_ends_at);
          let beat = 0;
          let lastPrompt = Date.now();
          while (!signal.cancelled && Date.now() < endsAt - 1_000) {
            await sleep(500, signal);
            const cue = cueQueue.current.shift();
            const beatDue = Date.now() - lastPrompt >= BEAT_SECONDS * 1000;
            if (!cue && !beatDue) continue;
            if (Date.now() > endsAt - 4_000) break;
            let prompt: string;
            if (cue) {
              prompt = cue;
            } else {
              if (campaign.beats.length < 2) continue;
              beat = (beat + 1) % campaign.beats.length;
              prompt = campaign.beats[beat];
            }
            await send("set_prompt", { prompt: silent(prompt) });
            lastPrompt = Date.now();
            await directorCall(clientId, "beat", { beatIndex: beat, prompt });
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
