"use client";

import Link from "next/link";

import { AppShell } from "@/components/shell/app-shell";
import { useStation } from "@/hooks/use-station";

const VIDEO =
  "https://5whyuw3k.us-east.insforge.app/api/storage/buckets/product-images/objects/demo%2Fvideo%2Fainfomercial-demo-10mb.mp4";
const REPO = "https://github.com/NaichuanZhang/Ainfomercial";

const CHAPTERS = [
  { at: 0, label: "What it is and what it showcases" },
  { at: 22, label: "Step 1 · Advertiser console: photo, AI draft, bid" },
  { at: 60, label: "Step 2 · The live channel: one continuous Orbis take" },
  { at: 86, label: "Viewer asks, the host answers on air" },
  { at: 95, label: "Open bidding and a steered product handoff" },
  { at: 141, label: "Step 3 · Insights (mocked data)" },
];

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** The submission demo video, hosted next to the product it shows. */
export function DemoPage() {
  const { channel, airing, queue } = useStation();
  const seek = (at: number) => {
    const video = document.getElementById("demo-video") as HTMLVideoElement | null;
    if (!video) return;
    video.currentTime = at;
    void video.play().catch(() => undefined);
  };

  return (
    <AppShell live={channel?.status === "live"} airing={airing} queue={queue}>
      <main className="page demo-page">
        <header className="demo-head">
          <p className="demo-kicker">Demo video · 2:45</p>
          <h1>A.Infomercial in under three minutes</h1>
          <p className="demo-sub">
            A live home-shopping channel generated in real time by Reactor Orbis: open bidding for airtime, a host who
            answers the chat on air, and one continuous take steered only by prompts.
          </p>
        </header>
        <div className="demo-player">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- narration and host lines are captioned in the video itself */}
          <video id="demo-video" src={VIDEO} controls playsInline preload="metadata" poster="/demo-poster.jpg" />
        </div>
        <div className="demo-grid">
          <section className="demo-card" aria-label="Chapters">
            <h2>Chapters</h2>
            <ol>
              {CHAPTERS.map((c) => (
                <li key={c.at}>
                  <button type="button" onClick={() => seek(c.at)}>
                    <span className="demo-time">{clock(c.at)}</span>
                    {c.label}
                  </button>
                </li>
              ))}
            </ol>
          </section>
          <section className="demo-card" aria-label="Try it">
            <h2>Try it yourself</h2>
            <p>
              <Link className="btn primary" href="/live">
                Watch live
              </Link>{" "}
              <Link className="btn" href="/console">
                Buy airtime
              </Link>
            </p>
            <p>
              <a href={VIDEO} download="ainfomercial-demo.mp4">
                Download the video (MP4, 9 MB)
              </a>{" "}
              · <a href={REPO}>Source on GitHub</a>
            </p>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
