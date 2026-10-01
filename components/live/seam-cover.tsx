"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { SEAM_FADE_MS, SEAM_MAX_MS, SEAM_SETTLE_MS } from "@/lib/handoff";
import type { ChannelState, ChannelStatus } from "@/lib/station-types";

/** What the broadcast overlay needs to know while the player covers a product change. */
export type SeamState = {
  /** The full-screen bumper is being covered: keep the picture (held or running) in view. */
  covering: boolean;
  /** A product change is in progress: show the slim "Up next" lower third. */
  upNext: boolean;
};

export const SEAM_IDLE: SeamState = { covering: false, upNext: false };

export const SeamContext = createContext<SeamState>(SEAM_IDLE);

export const useSeam = () => useContext(SeamContext);

type Phase =
  | { kind: "idle" }
  /** The channel is in `bumper`; `frozen` means the last live frame is painted over the video. */
  | { kind: "hold"; frozen: boolean; upNext: boolean }
  /** The channel is `live` again; the held frame fades out once the new run paints a frame. */
  | { kind: "fade"; upNext: boolean };

const IDLE: Phase = { kind: "idle" };

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

const hasPicture = (video: HTMLVideoElement | null): video is HTMLVideoElement =>
  !!video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;

/** Paint the video's current frame onto the canvas; false when there is nothing to hold. */
function freezeFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement | null) {
  if (!canvas) return false;
  try {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return false;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return true;
  } catch {
    return false;
  }
}

/**
 * Seam cover for a product change. Orbis needs `reset` + `start` to take the next product's start
 * frame, which stalls the stream for a few seconds. When the channel leaves `live` for the next
 * product, this holds the last live frame (the host with empty hands) over the player and tells
 * the overlay to draw a slim "Up next" lower third instead of the full-screen bumper, then
 * crossfades back once the channel is `live` and the new run's frames are arriving. A cold start
 * (nothing to hold) and off air keep the full-screen bumper.
 */
export function SeamCover({
  channel,
  active,
  getVideo,
  onChange,
}: {
  channel: ChannelState | null;
  /** Only a tuned-in tab with a picture covers anything. */
  active: boolean;
  /** The live <video> element, looked up when needed (it is rendered by the Reactor SDK). */
  getVideo: () => HTMLVideoElement | null;
  onChange?: (seam: SeamState) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>(IDLE);
  const phaseRef = useRef<Phase>(IDLE);
  const previous = useRef<{ status: ChannelStatus | null; airingId: string | null } | null>(null);
  const getVideoRef = useRef(getVideo);
  getVideoRef.current = getVideo;

  const go = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const status = channel?.status ?? null;
  const airingId = channel?.airing_campaign_id ?? null;

  // Channel transitions drive the phase.
  useEffect(() => {
    const before = previous.current;
    previous.current = { status, airingId };
    if (!active) {
      go(IDLE);
      return;
    }
    if (!before) return;
    const current = phaseRef.current;
    // Leaving live for the next segment: hold the picture while the new run warms up.
    if (before.status === "live" && status === "bumper" && airingId) {
      const video = getVideoRef.current();
      if (!hasPicture(video)) {
        go(IDLE);
        return;
      }
      if (airingId === before.airingId) {
        // The same product re-airs without a reset: the picture keeps running, just no bumper.
        go({ kind: "hold", frozen: false, upNext: false });
        return;
      }
      go(freezeFrame(video, canvasRef.current) ? { kind: "hold", frozen: true, upNext: true } : IDLE);
      return;
    }
    if (current.kind === "hold") {
      if (status === "live") go(current.frozen ? { kind: "fade", upNext: current.upNext } : IDLE);
      else if (status !== "bumper") go(IDLE);
    }
  }, [active, airingId, go, status]);

  // A held frame that never gets its live picture back gives way to the honest bumper.
  useEffect(() => {
    if (phase.kind !== "hold") return;
    const timer = setTimeout(() => go(IDLE), SEAM_MAX_MS);
    return () => clearTimeout(timer);
  }, [go, phase]);

  // Crossfade once the new run has painted a frame (or after a short settle without rVFC).
  const [fadeReady, setFadeReady] = useState(false);
  useEffect(() => {
    if (phase.kind !== "fade") {
      setFadeReady(false);
      return;
    }
    let done = false;
    let handle: number | null = null;
    const video = getVideoRef.current() as VideoWithFrameCallback | null;
    const ready = () => {
      if (done) return;
      done = true;
      setFadeReady(true);
    };
    if (video?.requestVideoFrameCallback) handle = video.requestVideoFrameCallback(ready);
    // Fallback (no rVFC, or a video that never presents): fade after a settle delay anyway.
    const timer = setTimeout(ready, video?.requestVideoFrameCallback ? SEAM_SETTLE_MS * 3 : SEAM_SETTLE_MS);
    return () => {
      done = true;
      clearTimeout(timer);
      if (handle !== null) video?.cancelVideoFrameCallback?.(handle);
    };
  }, [phase]);

  useEffect(() => {
    if (!fadeReady) return;
    const timer = setTimeout(() => go(IDLE), SEAM_FADE_MS);
    return () => clearTimeout(timer);
  }, [fadeReady, go]);

  const covering = phase.kind !== "idle";
  const upNext = phase.kind !== "idle" && phase.upNext;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    onChangeRef.current?.({ covering, upNext });
  }, [covering, upNext]);

  const visible = (phase.kind === "hold" && phase.frozen) || phase.kind === "fade";
  const className = `seam-freeze${visible ? " holding" : ""}${phase.kind === "fade" && fadeReady ? " fading" : ""}`;
  return <canvas ref={canvasRef} className={className} aria-hidden="true" data-seam={phase.kind} />;
}
