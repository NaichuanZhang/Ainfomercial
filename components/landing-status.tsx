"use client";

import Link from "next/link";

import type { Campaign, ChannelState } from "@/lib/station-types";

/** Live strip on the landing page: what's on air (or up next) and the current top bids. */
export function LandingStatus({
  channel,
  airing,
  queue,
}: {
  channel: ChannelState | null;
  airing: Campaign | null;
  queue: Campaign[];
}) {
  const live = channel?.status === "live";
  const feature = airing ?? queue[0] ?? null;
  return (
    <section className="landing-status" aria-label="Channel status">
      <span className={live ? "live-pill" : "live-pill off"}>{live ? "On air now" : "Off air"}</span>
      {feature ? (
        <div className="landing-feature">
          <span className={`avatar avatar-30 ${live ? "ring-live" : ""}`}>
            {feature.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={feature.image_url} alt="" />
            ) : (
              <span className="avatar-letter">{feature.product_name.slice(0, 1)}</span>
            )}
          </span>
          <div>
            <p className="muted">{live ? "Now airing" : "Up next"}</p>
            <strong>{feature.product_name}</strong>
            <span className="muted"> · {feature.brand}</span>
          </div>
        </div>
      ) : (
        <p className="muted">The queue is empty: the next bid airs first.</p>
      )}
      <div className="landing-bids">
        {queue.slice(0, 3).map((campaign, index) => (
          <span key={campaign.id} className="chip ghost">
            #{index + 1} {campaign.product_name} · <span className="bid">{Number(campaign.bid_per_min).toFixed(0)}/min</span>
          </span>
        ))}
      </div>
      <Link className="btn primary" href="/live">
        {live ? "Watch live" : "Tune in"}
      </Link>
    </section>
  );
}
