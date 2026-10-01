"use client";

import { useEffect, useRef, useState } from "react";

import { BroadcastOverlay } from "@/components/live/broadcast-overlay";
import { ChatPanel } from "@/components/live/chat-panel";
import type { HostApi } from "@/components/live/host-strip";
import { QueueRail } from "@/components/live/queue-rail";
import { StationPlayer } from "@/components/live/station-player";
import { StreamInfo } from "@/components/live/stream-info";
import { TabRecorder } from "@/components/live/tab-recorder";
import { AppShell } from "@/components/shell/app-shell";
import type { DirectorApi } from "@/hooks/use-director";
import { useStation } from "@/hooks/use-station";

export function LiveChannel() {
  const station = useStation({ countViewers: true });
  const [director, setDirector] = useState<DirectorApi | null>(null);
  const [host, setHost] = useState<HostApi | null>(null);
  // Each fresh host answer: the director tab re-stages the shared Orbis picture, while every
  // tuned tab interrupts its current beat line and plays the cached TTS answer.
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
    const fresh = Date.now() - Date.parse(latest.created_at) < 20_000;
    if (director && latest.visual_prompt && fresh) {
      director.cue(latest.visual_prompt);
    }
    if (host && fresh) host.say(latest.body);
  }, [director, host, station.chat]);

  const lastHost = [...station.chat].reverse().find((m) => m.kind === "host" && m.fact_label);
  const highlight =
    lastHost && Date.now() - Date.parse(lastHost.created_at) < 12_000 ? lastHost.fact_label : null;

  const live = station.channel?.status === "live";
  return (
    <AppShell live={live} airing={station.airing} queue={station.queue} className="shell-channel">
      <div className="channel-page">
        <TabRecorder />
        <div className="channel-main">
          <StationPlayer channel={station.channel} airing={station.airing} onDirector={setDirector} onHost={setHost}>
            <BroadcastOverlay
              channel={station.channel}
              airing={station.airing}
              highlightFact={highlight}
              upNext={station.queue[0] ?? null}
            />
          </StationPlayer>
          <StreamInfo channel={station.channel} airing={station.airing} viewers={station.viewers} />
          <div className="channel-content">
            <QueueRail live={live} airing={station.airing} queue={station.queue} />
            {director && (
              <details className="panel control-room">
                <summary>Control room (this tab is directing the broadcast)</summary>
                {director.error && <p className="chat-error">{director.error}</p>}
                {host?.error && <p className="chat-error">{host.error}</p>}
                <ol>
                  {director.log.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ol>
                {host && host.log.length > 0 && (
                  <ol>
                    {host.log.map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ol>
                )}
              </details>
            )}
            {station.error && <p className="chat-error">{station.error}</p>}
          </div>
        </div>
        <ChatPanel messages={station.chat} viewers={station.viewers} airing={station.airing} live={live} />
      </div>
    </AppShell>
  );
}
