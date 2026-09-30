"use client";

import { useEffect, useRef, useState } from "react";

import { BroadcastOverlay } from "@/components/live/broadcast-overlay";
import { ChatPanel } from "@/components/live/chat-panel";
import { QueueRail } from "@/components/live/queue-rail";
import { StationPlayer } from "@/components/live/station-player";
import { TopBar } from "@/components/top-bar";
import type { DirectorApi } from "@/hooks/use-director";
import { useStation } from "@/hooks/use-station";

export function LiveChannel() {
  const station = useStation({ countViewers: true });
  const [director, setDirector] = useState<DirectorApi | null>(null);
  // The director tab re-stages the shared video for each fresh host answer.
  const cued = useRef<number | null>(null);
  useEffect(() => {
    const latest = [...station.chat].reverse().find((m) => m.kind === "host");
    if (!latest) return;
    if (cued.current === null) {
      cued.current = latest.id; // history on load is not news
      return;
    }
    if (latest.id <= cued.current) return;
    cued.current = latest.id;
    if (director && latest.visual_prompt && Date.now() - Date.parse(latest.created_at) < 20_000) {
      director.cue(latest.visual_prompt);
    }
  }, [director, station.chat]);

  const lastHost = [...station.chat].reverse().find((m) => m.kind === "host" && m.fact_label);
  const highlight =
    lastHost && Date.now() - Date.parse(lastHost.created_at) < 12_000 ? lastHost.fact_label : null;

  return (
    <div className="live-shell">
      <TopBar live={station.channel?.status === "live"} />
      <div className="live-grid">
        <div className="live-main">
          <StationPlayer channel={station.channel} onDirector={setDirector}>
            <BroadcastOverlay channel={station.channel} airing={station.airing} highlightFact={highlight} />
          </StationPlayer>
          <QueueRail airing={station.airing} queue={station.queue} />
          {director && (
            <details className="card control-room">
              <summary>Control room (this tab is directing the broadcast)</summary>
              {director.error && <p className="chat-error">{director.error}</p>}
              <ol>
                {director.log.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ol>
            </details>
          )}
          {station.error && <p className="chat-error">{station.error}</p>}
        </div>
        <ChatPanel messages={station.chat} viewers={station.viewers} />
      </div>
    </div>
  );
}
