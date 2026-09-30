"use client";

import { ReactorView } from "@reactor-team/js-sdk";

type OrbisPlayerProps = {
  connected: boolean;
  muted: boolean;
  objectFit: "contain" | "cover";
  runStarted: boolean;
  status: string;
  model: string;
};

export function OrbisPlayer({
  connected,
  muted,
  objectFit,
  runStarted,
  status,
  model,
}: OrbisPlayerProps) {
  return (
    <div className="player">
      {runStarted ? (
        <ReactorView
          track="main_video"
          audioTrack="main_audio"
          muted={muted}
          videoObjectFit={objectFit}
        />
      ) : (
        <div className="player-placeholder">
          {connected ? "Configure and start a run" : `Connect to ${model}`}
        </div>
      )}
      <span className={`status status-${status}`}>{status}</span>
    </div>
  );
}
