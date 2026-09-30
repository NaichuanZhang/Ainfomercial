"use client";

import { useState } from "react";

import { BroadcastOverlay } from "@/components/live/broadcast-overlay";
import { ChatPanel } from "@/components/live/chat-panel";
import { QueueRail } from "@/components/live/queue-rail";
import { StationPlayer } from "@/components/live/station-player";
import { TopBar } from "@/components/top-bar";
import type { DirectorApi } from "@/hooks/use-director";
import { useStation } from "@/hooks/use-station";

export function LiveChannel() {
  const station = useStation();
  const [director, setDirector] = useState<DirectorApi | null>(null);
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
