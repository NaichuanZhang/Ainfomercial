"use client";

import { ReactorProvider } from "@reactor-team/js-sdk";
import { useCallback, useMemo, useRef, useState } from "react";

import { NanoBananaExample } from "@/components/nano-banana-example";
import { OrbisControls } from "@/components/orbis-controls";
import { OrbisPlayer } from "@/components/orbis-player";
import { SessionConfigPanel } from "@/components/session-config";
import { useOrbisSession } from "@/hooks/use-orbis-session";
import {
  DEFAULT_SESSION_CONFIG,
  ORBIS_TRACKS,
  requestReactorJwt,
  type SessionConfig,
  type TokenResponse,
} from "@/lib/orbis";

export function OrbisDemo() {
  const [config, setConfig] = useState<SessionConfig>(DEFAULT_SESSION_CONFIG);
  const [token, setToken] = useState<TokenResponse | null>(null);

  // The SDK calls the resolver lazily; read the latest config through a ref so
  // the resolver identity stays stable and the provider is not rebuilt per edit.
  const configRef = useRef(config);
  configRef.current = config;

  const jwtPromise = useRef<Promise<string> | null>(null);
  const currentJwt = useRef<string | null>(null);

  const clearJwt = useCallback(() => {
    jwtPromise.current = null;
    currentJwt.current = null;
    setToken(null);
  }, []);

  const getJwt = useCallback(async () => {
    const pending = (jwtPromise.current ??= (async () => {
      const current = configRef.current;
      const minted = await requestReactorJwt({
        model: current.model,
        maxSessionDurationSeconds: current.maxSessionDurationSeconds,
        tokenTtlSeconds: current.tokenTtlSeconds,
        maxSessions: current.maxSessions,
        bindSessionIds: current.joinSessionId ? [current.joinSessionId] : [],
      });
      setToken(minted);
      return minted.jwt;
    })());
    try {
      const jwt = await pending;
      currentJwt.current = jwt;
      return jwt;
    } catch (error) {
      // Do not permanently cache a failed token request.
      if (jwtPromise.current === pending) jwtPromise.current = null;
      throw error;
    }
  }, []);
  const getCurrentJwt = useCallback(() => currentJwt.current, []);

  const updateConfig = useCallback(
    (next: SessionConfig) => {
      setConfig(next);
      // A cached token is scoped to the previous model / constraints.
      clearJwt();
    },
    [clearJwt],
  );

  const connectOptions = useMemo(
    () => ({
      autoConnect: false,
      autoResumeTracks: config.autoResumeTracks,
      maxAttempts: config.maxAttempts,
      ...(config.joinSessionId ? { sessionId: config.joinSessionId } : {}),
    }),
    [config.autoResumeTracks, config.maxAttempts, config.joinSessionId],
  );

  return (
    <section className="demo-shell">
      <ReactorProvider
        apiUrl="https://api.reactor.inc"
        modelName={config.model}
        modelTracks={[...ORBIS_TRACKS]}
        connectOptions={connectOptions}
        jwtToken={getJwt}
      >
        <OrbisSession
          clearJwt={clearJwt}
          getCurrentJwt={getCurrentJwt}
          config={config}
          onConfigChange={updateConfig}
          token={token}
        />
      </ReactorProvider>
    </section>
  );
}

function OrbisSession({
  clearJwt,
  getCurrentJwt,
  config,
  onConfigChange,
  token,
}: {
  clearJwt: () => void;
  getCurrentJwt: () => string | null;
  config: SessionConfig;
  onConfigChange: (next: SessionConfig) => void;
  token: TokenResponse | null;
}) {
  const session = useOrbisSession(clearJwt, getCurrentJwt);
  const locked = session.status !== "disconnected" || session.controlsBusy;

  return (
    <>
      <SessionConfigPanel
        config={config}
        onChange={onConfigChange}
        locked={locked}
        token={token}
        sessionId={session.sessionId}
      />

      <div className="session-grid">
        <OrbisPlayer
          connected={session.connected}
          muted={session.muted}
          objectFit={session.objectFit}
          runStarted={session.runStarted}
          status={session.status}
          model={config.model}
        />
        <OrbisControls session={session} />
      </div>

      <NanoBananaExample
        disabled={
          !session.connected || session.runStarted || session.controlsBusy
        }
        onActivityChange={session.setNanoBusy}
        onReady={session.startFromNanoOutput}
      />
    </>
  );
}
