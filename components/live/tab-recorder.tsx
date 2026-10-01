"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Demo-recording helper, only rendered with `?rec=1` in the URL. Records THIS tab (picture and
 * the tab's own sound: Max's voice and the lounge music) with Chrome's tab capture, so no screen
 * recorder or virtual audio device is needed, and downloads the file when recording stops.
 * Start with the button; stop with Shift+R or Chrome's "Stop sharing". The button hides itself
 * while recording so it never appears in the footage.
 */
export function TabRecorder() {
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<"idle" | "recording" | "saving">("idle");
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    setEnabled(new URLSearchParams(window.location.search).get("rec") === "1");
  }, []);

  const stop = useCallback(() => {
    const active = recorder.current;
    if (active && active.state !== "inactive") active.stop();
  }, []);

  const start = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: { suppressLocalAudioPlayback: false } as MediaTrackConstraints,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
        systemAudio: "exclude",
      } as DisplayMediaStreamOptions);
      const mimeType =
        ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm"].find((type) =>
          MediaRecorder.isTypeSupported(type),
        ) ?? "";
      const media = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 16_000_000, audioBitsPerSecond: 192_000 });
      chunks.current = [];
      media.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      media.onstop = () => {
        setState("saving");
        stream.getTracks().forEach((track) => track.stop());
        const type = media.mimeType || "video/webm";
        const blob = new Blob(chunks.current, { type });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `ainfomercial-live-${new Date().toISOString().replace(/[:.]/g, "-")}.${type.includes("mp4") ? "mp4" : "webm"}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
        setState("idle");
      };
      stream.getVideoTracks()[0]?.addEventListener("ended", () => stop());
      recorder.current = media;
      media.start(1_000);
      setState("recording");
      if (!stream.getAudioTracks().length) setError("No tab audio: tick 'Also share tab audio' next time.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [stop]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.shiftKey && event.key.toLowerCase() === "r" && recorder.current?.state === "recording") stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, stop]);

  if (!enabled || state === "recording") return null;
  return (
    <div className="tab-recorder" role="region" aria-label="Demo recorder">
      <button type="button" className="btn primary" onClick={() => void start()} disabled={state === "saving"}>
        {state === "saving" ? "Saving…" : "● Record this tab"}
      </button>
      <span>Stop with Shift+R</span>
      {error && <span className="tab-recorder-error">{error}</span>}
    </div>
  );
}
