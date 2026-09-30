"use client";

import Link from "next/link";
import { useState } from "react";

import { BidBoard } from "@/components/console/bid-board";
import { CampaignForm } from "@/components/console/campaign-form";
import { AppShell } from "@/components/shell/app-shell";
import { Icon } from "@/components/shell/icons";
import { useStation } from "@/hooks/use-station";

export function ConsoleApp() {
  const station = useStation();
  const [mine, setMine] = useState<string | null>(null);

  return (
    <AppShell live={station.channel?.status === "live"} airing={station.airing} queue={station.queue}>
      <main className="page console">
        <header className="console-head">
          <div className="console-head-text">
            <p className="eyebrow">Advertiser console</p>
            <h1>Buy airtime on A.Infomercial</h1>
            <p className="muted">
              Upload a product, let the AI producer draft the spot, and bid. The highest bid airs next,
              live, with an AI host answering the chat from your facts.
            </p>
          </div>
          <nav className="console-nav" aria-label="Console">
            <Link className="btn" href="/console/insights">
              Insights
            </Link>
            <Link className="btn primary" href="/live">
              <Icon.Play />
              Watch live
            </Link>
          </nav>
        </header>
        <div className="console-grid">
          <CampaignForm queue={station.queue} airing={station.airing} onSubmitted={(c) => setMine(c.id)} />
          <BidBoard airing={station.airing} queue={station.queue} highlightId={mine} />
        </div>
      </main>
    </AppShell>
  );
}
