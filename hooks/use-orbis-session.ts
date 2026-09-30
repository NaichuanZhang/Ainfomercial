"use client";

import { useReactor, useReactorMessage } from "@reactor-team/js-sdk";
import { useEffect, useRef, useState } from "react";

import {
  DOCUMENTED_RESOLUTIONS,
  type OrbisMessage,
  type OrbisRunInfo,
  type OrbisState,
  unwrapOrbisMessage,
} from "@/lib/orbis";

export type CommandLogEntry = {
  at: string;
  command: string;
  args: unknown;
  reply: unknown;
};

const EVENT_LOG_LIMIT = 12;
const COMMAND_LOG_LIMIT = 20;

export function useOrbisSession(
  clearJwt: () => void,
  getCurrentJwt: () => string | null,
) {
  const {
    status,
    sessionId,
    connect,
    disconnect,
    sendCommand,
    uploadFile,
    requestClip,
    downloadClipAsFile,
  } = useReactor((state) => ({
    status: state.status,
    sessionId: state.sessionId,
    connect: state.connect,
    disconnect: state.disconnect,
    sendCommand: state.sendCommand,
    uploadFile: state.uploadFile,
    requestClip: state.requestClip,
    downloadClipAsFile: state.downloadClipAsFile,
  }));

  // --- set_prompt -----------------------------------------------------------
  const [prompt, setPrompt] = useState("");
  /** `set_prompt.passthrough` — send text verbatim, skip server prompt prep. */
  const [passthrough, setPassthrough] = useState(false);

  // --- set_audio_prompt / set_audio_enabled ---------------------------------
  const [audioPrompt, setAudioPrompt] = useState("");
  const [audioEnabled, setAudioEnabled] = useState(true);

  // --- set_image / set_seed / set_resolution --------------------------------
  const [image, setImage] = useState<File | null>(null);
  /** Kept as text so the field can be blank (= leave the model default, 42). */
  const [seed, setSeed] = useState("");
  const [resolution, setResolution] = useState("");
  const [availableResolutions, setAvailableResolutions] = useState<string[]>(
    DOCUMENTED_RESOLUTIONS,
  );

  // --- playback ----------------------------------------------------------------
  const [muted, setMuted] = useState(true);
  const [objectFit, setObjectFit] = useState<"contain" | "cover">("contain");
  const [clipSeconds, setClipSeconds] = useState(10);
  const [clipStatus, setClipStatus] = useState("");

  // --- lifecycle --------------------------------------------------------------
  const [busy, setBusy] = useState(false);
  const [nanoBusy, setNanoBusy] = useState(false);
  const [runStarted, setRunStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [imageStatus, setImageStatus] = useState("");
  const [error, setError] = useState("");

  // --- observability ----------------------------------------------------------
  const [events, setEvents] = useState<string[]>([]);
  const [orbisState, setOrbisState] = useState<OrbisState | null>(null);
  const [runInfo, setRunInfo] = useState<OrbisRunInfo | null>(null);
  const [lastChunk, setLastChunk] = useState<{
    chunk_index?: number;
    frames_emitted?: number;
    audio_samples?: number | null;
  } | null>(null);
  const [commandLog, setCommandLog] = useState<CommandLogEntry[]>([]);

  const previousStatus = useRef(status);
  const disconnecting = useRef(false);
  const conditionsReadyResolver = useRef<(() => void) | null>(null);
  const imageReadyResolver = useRef<(() => void) | null>(null);
  const expectsImageForRun = useRef(false);

  const connected = status === "ready";
  const controlsBusy = busy || nanoBusy;

  useEffect(() => {
    if (
      status === "disconnected" &&
      previousStatus.current !== "disconnected"
    ) {
      setRunStarted(false);
      setPaused(false);
      setImageStatus("");
      setOrbisState(null);
      setRunInfo(null);
      setLastChunk(null);
      setClipStatus("");
    }
    previousStatus.current = status;
  }, [status]);

  useEffect(() => {
    const handlePageHide = (event: PageTransitionEvent) => {
      // A page entering the back-forward cache is suspended, not closed.
      if (event.persisted || !sessionId) return;

      const jwt = getCurrentJwt();
      if (!jwt) return;

      // keepalive asks the browser to finish uploading this small request even
      // after the document starts unloading. The server then terminates only
      // the session owned by this session-scoped JWT.
      void fetch("/api/session-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, jwt }),
        keepalive: true,
      }).catch(() => {
        // The page is leaving, so there is nowhere useful to surface failure.
      });
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [getCurrentJwt, sessionId]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !sessionId) {
      return;
    }

    const jwt = getCurrentJwt();
    if (!jwt) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const register = async (attempt: number) => {
      try {
        const response = await fetch("/api/session-registry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, jwt }),
        });
        if (!response.ok) {
          const result = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(
            result?.error ?? `registry returned ${response.status}`,
          );
        }
      } catch (caught) {
        if (cancelled) return;
        if (attempt < 5) {
          retryTimer = setTimeout(
            () => void register(attempt + 1),
            attempt * 1_000,
          );
          return;
        }
        setError(
          `Could not register Reactor session for development cleanup: ${
            caught instanceof Error ? caught.message : String(caught)
          }`,
        );
      }
    };

    void register(1);
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [getCurrentJwt, sessionId]);

  const pushEvent = (name: string) =>
    setEvents((current) => [name, ...current].slice(0, EVENT_LOG_LIMIT));

  const logCommand = (command: string, args: unknown, reply: unknown) =>
    setCommandLog((current) =>
      [
        { at: new Date().toISOString(), command, args, reply },
        ...current,
      ].slice(0, COMMAND_LOG_LIMIT),
    );

  /**
   * Every model command goes through here so the console log sees it and a
   * `command_error` reply becomes a thrown error instead of a silent no-op
   * (`sendCommand()` never rejects — see the schema's Messages note).
   */
  const send = async (command: string, args: Record<string, unknown> = {}) => {
    const rawReply = await sendCommand(command, args);
    logCommand(command, args, rawReply ?? null);
    if (!rawReply) return null;
    const reply = unwrapOrbisMessage(rawReply);
    if (reply.type === "command_error") {
      throw new Error(`${command}: ${reply.reason || "rejected"}`);
    }
    return reply;
  };

  const runAction = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const updateRunState = (message: OrbisMessage) => {
    if (message.type === "state") {
      if (typeof message.started === "boolean") setRunStarted(message.started);
      if (typeof message.paused === "boolean") setPaused(message.paused);
      if (message.has_image === false && !message.started) setImageStatus("");
    } else if (message.type === "generation_started") {
      setRunStarted(true);
      setPaused(false);
      if (message.image_conditioned === true) {
        setImageStatus("Orbis started from this image");
      } else if (
        message.image_conditioned === false &&
        expectsImageForRun.current
      ) {
        setImageStatus("Orbis started without image conditioning");
        setError("Orbis started without the uploaded image.");
      }
    } else if (message.type === "generation_paused") {
      setPaused(true);
    } else if (message.type === "generation_resumed") {
      setPaused(false);
    } else if (
      message.type === "generation_complete" ||
      message.type === "generation_reset"
    ) {
      setRunStarted(false);
      setPaused(false);
    }
  };

  useReactorMessage((raw: unknown) => {
    const message = unwrapOrbisMessage(raw);

    if (message.type === "conditions_ready") {
      conditionsReadyResolver.current?.();
      conditionsReadyResolver.current = null;
    }

    if (message.type === "state") {
      const {
        type: _type,
        started,
        running,
        paused: statePaused,
        has_image,
        has_prompt,
        current_chunk,
        available_resolutions,
        resolution: stateResolution,
        seed: stateSeed,
        audio_prompt,
        audio_enabled,
      } = message;
      void _type;
      setOrbisState({
        started,
        running,
        paused: statePaused,
        has_image,
        has_prompt,
        current_chunk,
        available_resolutions,
        resolution: stateResolution,
        seed: stateSeed,
        audio_prompt,
        audio_enabled,
      });

      if (has_image === true) {
        imageReadyResolver.current?.();
        imageReadyResolver.current = null;
      }

      if (available_resolutions) {
        const reported = available_resolutions.map(String);
        if (reported.length) {
          setAvailableResolutions(reported);
          setResolution((current) =>
            !current || reported.includes(current) ? current : "",
          );
        }
      }
    }

    if (message.type === "generation_started") {
      setRunInfo({
        fps: message.fps,
        width: message.width,
        height: message.height,
        max_chunks: message.max_chunks,
        resolution: message.resolution,
        audio_enabled: message.audio_enabled,
        frames_per_chunk: message.frames_per_chunk,
        image_conditioned: message.image_conditioned,
      });
      setLastChunk(null);
    }

    if (message.type === "chunk_complete") {
      setLastChunk({
        chunk_index: message.chunk_index,
        frames_emitted: message.frames_emitted,
        audio_samples: message.audio_samples,
      });
    }

    if (!disconnecting.current) updateRunState(message);

    if (message.type === "command_error") {
      setError(
        `${message.command || "command"}: ${message.reason || "rejected"}`,
      );
      if (message.command === "start") setRunStarted(false);
    }

    // chunk_complete + its state echo fire every ~1.8 s; keep them out of the
    // event strip so lifecycle events stay readable. The chunk counter below
    // shows that progress instead.
    if (message.type && message.type !== "chunk_complete") {
      pushEvent(message.type);
    }
  });

  const waitForSignal = (
    resolver: { current: (() => void) | null },
    signalName: string,
  ) => {
    let timeout: ReturnType<typeof setTimeout>;
    const promise = new Promise<void>((resolve, reject) => {
      timeout = setTimeout(() => {
        resolver.current = null;
        reject(new Error(`Timed out waiting for Orbis ${signalName}.`));
      }, 15_000);
      resolver.current = () => {
        clearTimeout(timeout);
        resolve();
      };
    });
    return {
      promise,
      cancel: () => {
        clearTimeout(timeout);
        resolver.current = null;
      },
    };
  };

  const parseSeed = () => {
    if (!seed.trim()) return null;
    const value = Number(seed);
    if (!Number.isInteger(value) || value < 0) {
      throw new Error("Seed must be a non-negative integer.");
    }
    return value;
  };

  // Shared by the regular form and the Nano Banana one-click example.
  // Order follows the schema's I2V guidance: upload -> set_image -> (session
  // settings) -> set_prompt -> start.
  const startGeneration = async (
    startImage: File | null,
    runPrompt: string,
  ) => {
    if (!runPrompt.trim()) throw new Error("Enter a prompt before starting.");
    const seedValue = parseSeed();
    expectsImageForRun.current = Boolean(startImage);

    if (startImage) {
      const uploaded = await uploadFile(startImage, { name: startImage.name });
      const imageReady = waitForSignal(imageReadyResolver, "state.has_image");
      let reply: OrbisMessage | null;
      try {
        reply = await send("set_image", { image: uploaded });
      } catch (caught) {
        imageReady.cancel();
        throw caught;
      }
      if (!reply) {
        imageReady.cancel();
        throw new Error("Orbis did not accept the uploaded start image.");
      }
      if (reply.type !== "image_accepted") {
        imageReady.cancel();
        throw new Error(
          `Expected image_accepted from Orbis, received ${reply.type || "an unknown reply"}.`,
        );
      }

      await imageReady.promise;

      const dimensions =
        reply.width && reply.height ? ` (${reply.width}×${reply.height})` : "";
      setImageStatus(`Orbis accepted image${dimensions}`);
    }

    // Session-scoped settings, all read when `start` fires.
    if (resolution) await send("set_resolution", { resolution });
    if (seedValue !== null) await send("set_seed", { seed: seedValue });
    await send("set_audio_enabled", { audio_enabled: audioEnabled });
    if (audioPrompt.trim()) {
      await send("set_audio_prompt", { prompt: audioPrompt.trim() });
    }

    const conditionsReady = waitForSignal(
      conditionsReadyResolver,
      "conditions_ready",
    );
    let promptReply: OrbisMessage | null;
    try {
      promptReply = await send("set_prompt", {
        prompt: runPrompt.trim(),
        passthrough,
      });
    } catch (caught) {
      conditionsReady.cancel();
      throw caught;
    }
    if (!promptReply) {
      conditionsReady.cancel();
      throw new Error("Orbis did not accept the prompt.");
    }

    await conditionsReady.promise;
    await send("start");
    setRunStarted(true);
    setPaused(false);
  };

  const selectImage = (nextImage: File | null) => {
    setImage(nextImage);
    setImageStatus("");
  };

  const startRun = () => runAction(() => startGeneration(image, prompt));

  const startFromNanoOutput = async (
    editedImage: File,
    groundedPrompt: string,
  ) => {
    setImage(editedImage);
    setPrompt(groundedPrompt);
    await runAction(() => startGeneration(editedImage, groundedPrompt));
  };

  /** Hot-swap the scene prompt; the picture morphs at the next chunk boundary. */
  const steer = () =>
    runAction(async () => {
      if (!prompt.trim()) throw new Error("Enter a prompt before steering.");
      await send("set_prompt", { prompt: prompt.trim(), passthrough });
    });

  /** Live-capable: the sound changes from the next chunk on. */
  const applyAudioPrompt = () =>
    runAction(() => send("set_audio_prompt", { prompt: audioPrompt.trim() }));

  /** Empty string switches audio back to picture-driven sound (the default). */
  const clearAudioPrompt = () =>
    runAction(async () => {
      setAudioPrompt("");
      await send("set_audio_prompt", { prompt: "" });
    });

  /** Arms the next run; a running generation keeps the seed it started with. */
  const applySeed = () =>
    runAction(async () => {
      const seedValue = parseSeed();
      if (seedValue === null) throw new Error("Enter a seed to apply.");
      await send("set_seed", { seed: seedValue });
    });

  const applyAudioEnabled = (enabled: boolean) =>
    runAction(async () => {
      setAudioEnabled(enabled);
      await send("set_audio_enabled", { audio_enabled: enabled });
    });

  const applyResolution = () =>
    runAction(async () => {
      if (!resolution) throw new Error("Pick a resolution to apply.");
      await send("set_resolution", { resolution });
    });

  /**
   * Raw console: any command name with a JSON argument object. The correlated
   * reply is returned as-is so the schema can be explored end to end.
   */
  const sendRawCommand = async (command: string, argsJson: string) => {
    const name = command.trim();
    if (!name) throw new Error("Enter a command name.");
    let args: Record<string, unknown> = {};
    if (argsJson.trim()) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(argsJson);
      } catch {
        throw new Error("Arguments must be a JSON object.");
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Arguments must be a JSON object.");
      }
      args = parsed as Record<string, unknown>;
    }
    setBusy(true);
    setError("");
    try {
      const rawReply = await sendCommand(name, args);
      logCommand(name, args, rawReply ?? null);
      return rawReply ?? null;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return null;
    } finally {
      setBusy(false);
    }
  };

  /** Recordings API: clip the last N seconds and download it as MP4. */
  const saveClip = () =>
    runAction(async () => {
      const seconds = Math.max(1, Math.min(300, Math.trunc(clipSeconds)));
      setClipStatus(`Requesting last ${seconds}s…`);
      const clip = await requestClip(seconds);
      const jwt = getCurrentJwt() ?? undefined;
      const filename = `orbis-${clip.sessionId.slice(0, 8)}-${Math.round(
        clip.startMarker,
      )}s.mp4`;
      const blob = await downloadClipAsFile(clip, filename, {
        jwt,
        onProgress: ({ fetched }) =>
          setClipStatus(`Downloading clip… ${fetched} chunk(s)`),
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setClipStatus(
        `Saved ${filename} (${(blob.size / 1_048_576).toFixed(1)} MB)`,
      );
    });

  const disconnectSession = async () => {
    disconnecting.current = true;
    setRunStarted(false);
    setPaused(false);

    // Remove ReactorView before closing the WebRTC tracks it is playing.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    try {
      const disconnected = await runAction(() => disconnect());
      if (disconnected) {
        if (process.env.NODE_ENV === "development" && sessionId) {
          try {
            await fetch("/api/session-registry", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId }),
            });
          } catch {
            // A stale registry entry is harmless: the next sweep gets a 404
            // from Reactor and removes it.
          }
        }
        clearJwt();
      }
    } finally {
      disconnecting.current = false;
    }
  };

  return {
    // connection
    status,
    sessionId,
    connected,
    controlsBusy,
    runStarted,
    paused,
    error,
    connectSession: () => runAction(() => connect()),
    disconnectSession,

    // set_prompt
    prompt,
    setPrompt,
    passthrough,
    setPassthrough,
    startRun,
    steer,

    // set_audio_prompt / set_audio_enabled
    audioPrompt,
    setAudioPrompt,
    applyAudioPrompt,
    clearAudioPrompt,
    audioEnabled,
    applyAudioEnabled,

    // set_image
    image,
    imageStatus,
    selectImage,
    startFromNanoOutput,
    setNanoBusy,

    // set_seed
    seed,
    setSeed,
    applySeed,

    // set_resolution
    resolution,
    setResolution,
    applyResolution,
    availableResolutions,

    // lifecycle
    pause: () => runAction(() => send("pause")),
    resume: () => runAction(() => send("resume")),
    reset: () => runAction(() => send("reset")),

    // playback + recordings
    muted,
    toggleMuted: () => setMuted((current) => !current),
    objectFit,
    toggleObjectFit: () =>
      setObjectFit((current) => (current === "contain" ? "cover" : "contain")),
    clipSeconds,
    setClipSeconds,
    clipStatus,
    saveClip,

    // observability
    events,
    orbisState,
    runInfo,
    lastChunk,
    commandLog,
    sendRawCommand,
  };
}

export type OrbisSession = ReturnType<typeof useOrbisSession>;
