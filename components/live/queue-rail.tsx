"use client";

import Link from "next/link";

import { itemNumber } from "@/components/live/broadcast-overlay";
import { Icon } from "@/components/shell/icons";
import type { Campaign } from "@/lib/station-types";

/** The "About" section under the stream info, laid out as channel panels: now airing, up next, how bidding works. */
export function QueueRail({ live, airing, queue }: { live: boolean; airing: Campaign | null; queue: Campaign[] }) {
  return (
    <section className="about" aria-label="About the channel and the airtime queue">
      <header className="about-head">
        <h2>About A.Infomercial</h2>
        <p className="muted">
          <strong>{queue.length + (airing ? 1 : 0)}</strong> campaigns bidding · live AI home-shopping · open auction
        </p>
      </header>

      <div className="panels">
        <article className="panel panel-now">
          <h3 className="panel-title">
            <span className={live && airing ? "dot live" : "dot"} aria-hidden="true" />
            {live || !airing ? "Now airing" : "Up next on air"}
          </h3>
          {airing ? (
            <div className="panel-product">
              <span className={`avatar avatar-56${live ? " ring-live" : ""}`}>
                {airing.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={airing.image_url} alt="" />
                ) : (
                  <span className="avatar-letter">{airing.product_name.slice(0, 1)}</span>
                )}
              </span>
              <div className="panel-product-text">
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
        </article>

        <article className="panel panel-next">
          <div className="panel-title-row">
            <h3 className="panel-title">Up next · open bids</h3>
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
        </article>

        <article className="panel panel-how">
          <h3 className="panel-title">How airtime works</h3>
          <ul className="panel-steps">
            <li>
              <Icon.Bolt size={16} /> Upload a product, the AI producer drafts the spot.
            </li>
            <li>
              <Icon.Coin size={16} /> Bid credits per minute. Highest bid airs next.
            </li>
            <li>
              <Icon.Tv size={16} /> The live AI host pitches it and answers the chat.
            </li>
          </ul>
        </article>
      </div>
    </section>
  );
}
