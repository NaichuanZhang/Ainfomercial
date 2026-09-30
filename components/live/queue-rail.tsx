"use client";

import Link from "next/link";

import { itemNumber } from "@/components/live/broadcast-overlay";
import type { Campaign } from "@/lib/station-types";

export function QueueRail({ airing, queue }: { airing: Campaign | null; queue: Campaign[] }) {
  return (
    <section className="rail" aria-label="Airtime queue">
      <div className="rail-now card">
        <p className="eyebrow">Now airing</p>
        {airing ? (
          <div className="rail-product">
            {airing.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={airing.image_url} alt="" />
            )}
            <div>
              <strong>{airing.product_name}</strong>
              <span className="muted">
                {airing.brand} · {itemNumber(airing)}
              </span>
              <span className="bid">{Number(airing.bid_per_min).toFixed(0)} credits/min</span>
            </div>
          </div>
        ) : (
          <p className="muted">Nothing on air yet.</p>
        )}
      </div>

      <div className="rail-next card">
        <div className="rail-next-head">
          <p className="eyebrow">Up next · open bids</p>
          <Link className="btn small primary" href="/console">
            Outbid them
          </Link>
        </div>
        {queue.length === 0 ? (
          <p className="muted">No one is waiting. The next slot goes to the first bid.</p>
        ) : (
          <ol className="bid-list">
            {queue.slice(0, 5).map((campaign, index) => (
              <li key={campaign.id}>
                <span className="rank">{index + 1}</span>
                <span className="bid-name">
                  {campaign.product_name}
                  <span className="muted"> · {campaign.brand}</span>
                </span>
                <span className="bid">{Number(campaign.bid_per_min).toFixed(0)}/min</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
