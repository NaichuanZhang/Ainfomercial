"use client";

import { ReactorProvider, ReactorView, useReactor } from "@reactor-team/js-sdk";
import { createLoungeMusic, type LoungeMusic } from "@/lib/client/lounge-music";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type HostApi, HostStrip } from "@/components/live/host-strip";
import { SEAM_IDLE, SeamContext, SeamCover, type SeamState } from "@/components/live/seam-cover";
import { Icon } from "@/components/shell/icons";
import { directorCall, type DirectorApi, useDirector } from "@/hooks/use-director";
import { ORBIS_TRACKS } from "@/lib/orbis";
import { type Campaign, type ChannelState, ORBIS_MODEL } from "@/lib/station-types";

type Ticket = { role: "director" | "viewer"; jwt: string; sessionId: string | null };

function useClientId() {
  const [id, setId] = useState("");
  useEffect(() => {
    const key = "ainfomercial-client-id";
    let value = sessionStorage.getItem(key);
    if (!value) {
      value = `tab-${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
      sessionStorage.setItem(key, value);
    }
    setId(value);
  }, []);
  return id;
}

async function fetchTicket(clientId: string) {
  const response = await fetch("/api/station/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId }),
  });
  const body = (await response.json().catch(() => ({}))) as Partial<Ticket> & {
    error?: string;
    role?: string;
  };
  if (response.status === 409) return { waiting: true as const };
  if (!response.ok || !body.jwt || (body.role !== "director" && body.role !== "viewer")) {
    throw new Error(body.error ?? `Could not tune in (${response.status})`);
  }
  return { ticket: { role: body.role, jwt: body.jwt, sessionId: body.sessionId ?? null } as Ticket };
}

/**
 * The video half of the channel. "Tune in" is an explicit click: it is the autoplay gesture
 * for audio, and it is the only thing that spends Orbis credits.
 */
export function StationPlayer({
  channel,
  airing,
  onDirector,
  onHost,
  children,
}: {
  channel: ChannelState | null;
  airing?: Campaign | null;
  onDirector?: (api: DirectorApi | null) => void;
  onHost?: (api: HostApi | null) => void;
  children?: React.ReactNode;
}) {
  const clientId = useClientId();
  const [tuned, setTuned] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [role, setRole] = useState<"director" | "viewer" | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  // Orbis audio is off (it turned the silent host into garbled speech); every tab plays its own lounge loop.
  const musicRef = useRef<LoungeMusic | null>(null);
  useEffect(() => musicRef.current?.setMuted(muted), [muted]);
  useEffect(() => () => musicRef.current?.stop(), []);
  const [seam, setSeam] = useState<SeamState>(SEAM_IDLE);
  // A tab left open across a deploy keeps running the old airing logic; say so.
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const mine = process.env.NEXT_PUBLIC_BUILD_ID;
    if (!mine) return;
    const check = () =>
      fetch("/api/version", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((v: { build?: string | null } | null) => setStale(!!v?.build && v.build !== mine))
        .catch(() => undefined);
    void check();
    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, []);
  const frameRef = useRef<HTMLDivElement>(null);
  // The <video> is rendered by the Reactor SDK inside the frame; the seam cover looks it up live.
  const getVideo = useCallback(() => frameRef.current?.querySelector("video") ?? null, []);
  const hostRef = useRef<HostApi | null>(null);
  const onHostRef = useRef(onHost);
  onHostRef.current = onHost;
  const receiveHost = useCallback((api: HostApi | null) => {
    hostRef.current = api;
    onHostRef.current?.(api);
  }, []);

  const tune = useCallback(async () => {
    if (!clientId) return;
    setError("");
    try {
      const result = await fetchTicket(clientId);
      if ("waiting" in result) {
        setWaiting(true);
        return;
      }
      setWaiting(false);
      setTicket(result.ticket);
      setRole(result.ticket.role);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [clientId]);

  // Waiting for the director to open the studio: retry on news or every 4 s.
  useEffect(() => {
    if (!tuned || !waiting) return;
    const timer = setInterval(() => void tune(), 4_000);
    return () => clearInterval(timer);
  }, [tune, tuned, waiting]);
  useEffect(() => {
    if (tuned && waiting && channel?.session_id) void tune();
  }, [channel?.session_id, tune, tuned, waiting]);

  // A viewer whose session was replaced re-tunes onto the new one.
  useEffect(() => {
    if (
      tuned &&
      ticket?.role === "viewer" &&
      role === "viewer" &&
      channel?.session_id &&
      ticket.sessionId &&
      channel.session_id !== ticket.sessionId
    ) {
      void tune();
    }
  }, [channel?.session_id, role, ticket, tune, tuned]);

  // Viewers stand by to take over if the director tab goes away.
  useEffect(() => {
    if (!tuned || role !== "viewer" || !clientId) return;
    const timer = setInterval(() => {
      directorCall(clientId, "heartbeat")
        .then((result) => {
          if (result.isDirector) setRole("director");
        })
        .catch(() => undefined);
    }, 10_000);
    return () => clearInterval(timer);
  }, [clientId, role, tuned]);

  const connectOptions = useMemo(
    () => ({
      autoConnect: false,
      autoResumeTracks: true,
      maxAttempts: 10,
      ...(ticket?.sessionId ? { sessionId: ticket.sessionId } : {}),
    }),
    [ticket?.sessionId],
  );
  const jwtRef = useRef<string | null>(null);
  jwtRef.current = ticket?.jwt ?? null;
  const getJwt = useCallback(async () => {
    if (jwtRef.current) return jwtRef.current;
    throw new Error("No channel ticket yet");
  }, []);

  return (
    <div className="player-frame" ref={frameRef}>
      {ticket ? (
        <ReactorProvider
          key={`${ticket.sessionId ?? "new"}:${ticket.jwt.slice(-12)}`}
          apiUrl="https://api.reactor.inc"
          modelName={ORBIS_MODEL}
          modelTracks={[...ORBIS_TRACKS]}
          connectOptions={connectOptions}
          jwtToken={getJwt}
        >
          <StationStage
            clientId={clientId}
            isDirector={role === "director"}
            muted={muted}
            onLostLease={() => setRole("viewer")}
            onDirector={onDirector}
            onDead={() => void tune()}
          />
        </ReactorProvider>
      ) : (
        <div className="player-idle" />
      )}

      {/* Product change: hold the last live frame while the next Orbis run warms up. */}
      <SeamCover channel={channel} active={tuned && !!ticket} getVideo={getVideo} onChange={setSeam} />

      <SeamContext.Provider value={seam}>{children}</SeamContext.Provider>

      <HostStrip
        active={tuned && !!ticket}
        muted={voiceMuted}
        channel={channel}
        airing={airing ?? null}
        onHost={receiveHost}
        onSpeakingChange={(speaking) => musicRef.current?.setDucked(speaking)}
      />

      {!tuned && (
        <div className="tune-in">
          <div className="tune-in-card">
            <span className="tune-in-live" aria-hidden="true">
              <span className={channel?.status === "live" ? "dot live" : "dot"} />
              {channel?.status === "live" ? "Live now" : channel?.status === "bumper" ? "Coming up next" : "Standing by"}
            </span>
            <button
              type="button"
              className="btn primary big tune-in-btn"
              onClick={() => {
                hostRef.current?.unlock();
                if (!musicRef.current) {
                  musicRef.current = createLoungeMusic();
                  musicRef.current?.setMuted(muted);
                }
                musicRef.current?.start();
                setTuned(true);
                void tune();
              }}
              disabled={!clientId}
            >
              <Icon.Play />
              Tune in
            </button>
            <p>Live AI-generated video with sound. Nothing is pre-recorded.</p>
          </div>
        </div>
      )}
      {stale && (
        <div className="player-note">
          A new version of the channel is live.{" "}
          <button type="button" className="btn primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )}
      {tuned && waiting && <div className="player-note">Warming up the studio…</div>}
      {error && <div className="player-note error">{error}</div>}

      {tuned && ticket && (
        <div className="player-controls">
          <button type="button" className="player-btn" onClick={() => setMuted((m) => !m)}>
            <Icon.Speaker muted={muted} />
            <span>{muted ? "Unmute music" : "Mute music"}</span>
          </button>
          <button type="button" className="player-btn" onClick={() => setVoiceMuted((m) => !m)}>
            <Icon.Mic muted={voiceMuted} />
            <span>{voiceMuted ? "Unmute host" : "Mute host"}</span>
          </button>
          <span className="player-controls-spacer" />
          <span className="player-role" title="This tab drives the shared broadcast">
            {role === "director" ? <Icon.Video size={16} /> : <Icon.Person size={16} />}
            {role === "director" ? "Control room" : "Viewer"}
          </span>
        </div>
      )}
    </div>
  );
}

function StationStage({
  clientId,
  isDirector,
  muted,
  onLostLease,
  onDirector,
  onDead,
}: {
  clientId: string;
  isDirector: boolean;
  muted: boolean;
  onLostLease: () => void;
  onDirector?: (api: DirectorApi | null) => void;
  onDead: () => void;
}) {
  const { status, connect } = useReactor((state) => ({ status: state.status, connect: state.connect }));
  const attempted = useRef(false);
  const everReady = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    void connect().catch(() => undefined);
  }, [connect]);

  useEffect(() => {
    if (status === "ready") everReady.current = true;
    // A session that ends under us (max duration, reaper) gets a fresh ticket.
    if (status === "disconnected" && everReady.current) {
      everReady.current = false;
      const timer = setTimeout(onDead, 1_500);
      return () => clearTimeout(timer);
    }
  }, [onDead, status]);

  const director = useDirector({ clientId, enabled: isDirector, onLostLease });
  const directorRef = useRef(onDirector);
  directorRef.current = onDirector;
  useEffect(() => {
    directorRef.current?.(isDirector ? director : null);
  }, [director, isDirector]);

  return (
    <>
      <ReactorView
        className="player-video"
        track="main_video"
        audioTrack="main_audio"
        muted={muted}
        videoObjectFit="cover"
      />
      {status !== "ready" && <div className="player-note">Connecting to the studio… ({status})</div>}
    </>
  );
}
