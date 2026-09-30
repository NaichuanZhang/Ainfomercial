"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/components/shell/icons";
import type { Campaign, ChannelState } from "@/lib/station-types";

const pad = (n: number) => String(n).padStart(2, "0");
const fmtUptime = (seconds: number) =>
  `${Math.floor(seconds / 3600)}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;

/** Seconds the channel has been live, counted from the first live segment this tab saw. */
function useUptime(channel: ChannelState | null) {
  const [liveSince, setLiveSince] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const live = channel?.status === "live";
  const segmentStart = channel?.segment_started_at ?? null;
  useEffect(() => {
    if (!live) {
      setLiveSince(null);
      return;
    }
    setLiveSince((current) => {
      if (current !== null) return current;
      const started = segmentStart ? Date.parse(segmentStart) : NaN;
      return Number.isFinite(started) ? started : Date.now();
    });
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [live, segmentStart]);
  return live && liveSince !== null ? Math.max(0, Math.round((now - liveSince) / 1000)) : null;
}

/** The channel info bar under the player: avatar, name, title, category, tags, actions, viewers, uptime. */
export function StreamInfo({
  channel,
  airing,
  viewers,
}: {
  channel: ChannelState | null;
  airing: Campaign | null;
  viewers: number;
}) {
  const live = channel?.status === "live";
  const uptime = useUptime(channel);
  const [following, setFollowing] = useState(false);

  const pitch = airing ? (airing.tagline ?? `by ${airing.brand}`) : "";
  const title = airing
    ? live
      ? `${airing.product_name} LIVE: ${pitch} | open bidding`
      : `Up next: ${airing.product_name}, ${pitch} | open bidding`
    : channel?.status === "bumper"
      ? "Coming up next: the highest bid takes the air | open bidding"
      : "Off air: the next bid opens the show | open bidding";

  return (
    <section className="stream-info" aria-label="Channel info">
      <div className="stream-avatar-col">
        <span className={`avatar avatar-70 ${live ? "ring-live" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/host/image" alt="" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
          <span className="avatar-letter" aria-hidden="true">
            A
          </span>
        </span>
        {live && <span className="live-badge">Live</span>}
      </div>

      <div className="stream-meta">
        <h1 className="stream-channel">
          A.Infomercial
          <span className="verified" title="Verified channel">
            <Icon.Verified size={16} />
          </span>
        </h1>
        <p className="stream-title" title={title}>
          {title}
        </p>
        <div className="stream-tags">
          <Link className="stream-category" href="/">
            Home Shopping
          </Link>
          <span className="tag">AI-generated</span>
          <span className="tag">Live Q&amp;A</span>
          <span className="tag">Open bidding</span>
          {airing && <span className="tag">{airing.brand}</span>}
        </div>
      </div>

      <div className="stream-actions">
        <div className="stream-buttons">
          <button
            type="button"
            className={following ? "btn secondary" : "btn primary"}
            aria-pressed={following}
            onClick={() => setFollowing((f) => !f)}
          >
            <Icon.Heart filled={following} />
            {following ? "Following" : "Follow"}
          </button>
          <span className="btn-split">
            <Link className="btn primary" href="/console">
              <Icon.Star />
              Buy airtime
            </Link>
            <Link className="btn primary btn-split-caret" href="/console" aria-label="Bidding options">
              <Icon.ChevronDown />
            </Link>
          </span>
        </div>
        <div className="stream-stats">
          <span className={`stream-viewers${live ? "" : " off"}`} title="Watching now">
            <Icon.Person />
            {viewers.toLocaleString()}
          </span>
          <span className="stream-uptime" title="Live for">
            {uptime !== null ? fmtUptime(uptime) : "Offline"}
          </span>
          <button type="button" className="icon-btn" aria-label="Share">
            <Icon.Share />
          </button>
          <button type="button" className="icon-btn" aria-label="More">
            <Icon.More />
          </button>
        </div>
      </div>
    </section>
  );
}
