"use client";

import { useEffect, useRef, useState } from "react";

import { useSeam } from "@/components/live/seam-cover";
import { BRING_UP_LAND_MS, isHandoffBeat } from "@/lib/handoff";
import type { Campaign, ChannelState } from "@/lib/station-types";

function useNow(intervalMs = 1_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

const formatClock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.max(0, seconds % 60)).padStart(2, "0")}`;

export const itemNumber = (campaign: Campaign) =>
  `A-${campaign.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

/**
 * Everything drawn over the video is HTML, never model output: the product name, price and
 * facts come from the advertiser's campaign, so the generated video can't misstate them.
 * During a product change the player holds the last live frame (see SeamCover), and this draws
 * a slim "Up next" lower third over it instead of the full-screen bumper.
 */
export function BroadcastOverlay({
  channel,
  airing,
  highlightFact,
  upNext,
}: {
  channel: ChannelState | null;
  airing: Campaign | null;
  highlightFact?: string | null;
  /** The highest bid waiting (same order the server picks from), shown while the host hands off. */
  upNext?: Campaign | null;
}) {
  const now = useNow(250);
  const seam = useSeam();
  const live = channel?.status === "live";

  // Graphics follow the product in the picture, not the database row. A continuous handoff is
  // one take: the product leaves (handoff beat), then the next one is lifted into frame, which
  // lands a few seconds after the segment starts. Until then the lower third stays down and a
  // slim "Up next" bar names what is coming.
  const previousAiring = useRef<string | null>(null);
  const [enteringUntil, setEnteringUntil] = useState(0);
  useEffect(() => {
    const id = airing?.id ?? null;
    const before = previousAiring.current;
    previousAiring.current = id;
    if (id && before && before !== id && live && !seam.covering) {
      const started = Date.parse(channel?.segment_started_at ?? "") || Date.now();
      setEnteringUntil(started + BRING_UP_LAND_MS);
    }
  }, [airing?.id, channel?.segment_started_at, live, seam.covering]);
  const handingOff = live && isHandoffBeat(channel?.beat_index);
  const entering = live && now < enteringUntil;
  const comingUp = handingOff ? (upNext ?? null) : entering ? airing : null;

  // While the player holds the last frame of a product change, the regular graphics wait for the
  // crossfade to finish; a same-product re-air keeps them up (the picture never stops).
  const onAir =
    !!airing && !handingOff && !entering && ((live && !seam.covering) || (seam.covering && !seam.upNext));
  const remaining = channel?.segment_ends_at
    ? Math.max(0, Math.round((Date.parse(channel.segment_ends_at) - now) / 1000))
    : 0;
  const facts = airing?.facts ?? [];
  const [factIndex, setFactIndex] = useState(0);
  useEffect(() => {
    if (!facts.length) return;
    const timer = setInterval(() => setFactIndex((i) => (i + 1) % facts.length), 4_000);
    return () => clearInterval(timer);
  }, [facts.length]);
  const highlighted = highlightFact ? facts.find((f) => f.label === highlightFact) : undefined;
  const fact = highlighted ?? facts[factIndex % Math.max(1, facts.length)];

  return (
    <div className="overlay" aria-live="polite">
      <div className="bug">
        A<span>.</span>I
      </div>
      <div className="ai-label">AI-generated video</div>
      {(onAir || handingOff || entering) && <span className="live-pill overlay-live">Live</span>}

      {onAir && airing && (
        <div className="lower-third">
          <div className="lt-main">
            <div className="lt-item">Item {itemNumber(airing)}</div>
            <div className="lt-name">{airing.product_name}</div>
            <div className="lt-brand">{airing.tagline ?? airing.brand}</div>
          </div>
          {fact && (
            <div className={highlighted ? "lt-fact hot" : "lt-fact"} key={fact.label}>
              <span className="lt-fact-value">{fact.value}</span>
              <span className="lt-fact-label">{fact.label}</span>
            </div>
          )}
          <div className="price-box">
            <div className="pb-label">Today&apos;s on-air price</div>
            {airing.compare_at_price && <div className="pb-compare">{airing.compare_at_price}</div>}
            <div className="pb-price">{airing.price ?? "Ask the host"}</div>
            <div className="pb-clock" title="Airtime left for this product">
              ON AIR {formatClock(remaining)}
            </div>
          </div>
        </div>
      )}

      {comingUp && !seam.covering && (
        <div className="up-next" key={`handoff-${comingUp.id}`}>
          {comingUp.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="up-next-img" src={comingUp.image_url} alt="" />
          )}
          <div className="up-next-text">
            <div className="up-next-kicker">Up next</div>
            <div className="up-next-name">{comingUp.product_name}</div>
            <div className="up-next-sub">
              {comingUp.brand} · Item {itemNumber(comingUp)}
            </div>
          </div>
        </div>
      )}

      {!onAir && seam.upNext && airing && (
        <div className="up-next" key={airing.id}>
          {airing.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="up-next-img" src={airing.image_url} alt="" />
          )}
          <div className="up-next-text">
            <div className="up-next-kicker">Up next</div>
            <div className="up-next-name">{airing.product_name}</div>
            <div className="up-next-sub">
              {airing.brand} · Item {itemNumber(airing)}
            </div>
          </div>
        </div>
      )}

      {!onAir && !seam.covering && !comingUp && !(live && (handingOff || entering)) && (
        <div className="bumper">
          <p className="bumper-kicker">{channel?.status === "offline" || !channel ? "Off air" : "Coming up next"}</p>
          {airing ? (
            <>
              {airing.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="bumper-img" src={airing.image_url} alt="" />
              )}
              <p className="bumper-name">{airing.product_name}</p>
              <p className="bumper-sub">
                {airing.brand} · winning bid {Number(airing.bid_per_min).toFixed(0)} credits/min
              </p>
            </>
          ) : (
            <p className="bumper-name">A.Infomercial</p>
          )}
        </div>
      )}
    </div>
  );
}
