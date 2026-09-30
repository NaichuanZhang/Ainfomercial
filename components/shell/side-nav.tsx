"use client";

import Link from "next/link";

import { Icon } from "@/components/shell/icons";
import type { Campaign } from "@/lib/station-types";

const fmtBid = (campaign: Campaign) => `${Number(campaign.bid_per_min).toFixed(0)}/min`;

function Thumb({ campaign, live }: { campaign: Campaign; live?: boolean }) {
  return (
    <span className={`avatar avatar-30 ${live ? "ring-live" : ""}`}>
      {campaign.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={campaign.image_url} alt="" />
      ) : (
        <span className="avatar-letter">{campaign.product_name.slice(0, 1)}</span>
      )}
    </span>
  );
}

function Row({
  campaign,
  live,
  featured,
  collapsed,
}: {
  campaign: Campaign;
  /** The channel is live with this campaign on air. */
  live?: boolean;
  /** Listed under "Live channels" (the airing slot) even while the channel warms up. */
  featured?: boolean;
  collapsed: boolean;
}) {
  const meta = live ? `${campaign.brand} · Live` : campaign.brand;
  return (
    <li>
      <Link
        className={`side-row${live ? " live" : ""}`}
        href={featured ? "/live" : "/console"}
        title={collapsed ? `${campaign.product_name} · ${meta} · ${fmtBid(campaign)}` : undefined}
      >
        <Thumb campaign={campaign} live={live} />
        {!collapsed && (
          <>
            <span className="side-row-text">
              <span className="side-row-name">{campaign.product_name}</span>
              <span className="side-row-meta">{meta}</span>
            </span>
            <span className="side-row-count">
              <span className={live ? "dot live" : "dot"} aria-hidden="true" />
              {fmtBid(campaign)}
            </span>
          </>
        )}
      </Link>
    </li>
  );
}

/**
 * Left sidebar in the Twitch "recommended channels" idiom: the product on air first (red ring),
 * then the open bids as recommendations, bid per minute where the viewer count would be.
 */
export function SideNav({
  live,
  airing,
  queue,
  collapsed,
  onToggle,
}: {
  live: boolean;
  airing: Campaign | null;
  queue: Campaign[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  const recommended = queue.slice(0, 6);
  return (
    <aside className={`sidenav${collapsed ? " collapsed" : ""}`} aria-label="Channels">
      <div className="sidenav-head">
        {!collapsed && <h2>For You</h2>}
        <button
          type="button"
          className="icon-btn"
          aria-label={collapsed ? "Expand" : "Collapse"}
          title={collapsed ? "Expand" : "Collapse"}
          onClick={onToggle}
        >
          <Icon.Collapse flipped={collapsed} />
        </button>
      </div>

      <section className="sidenav-section" aria-label="Live channels">
        <h3 className="sidenav-title">{collapsed ? <Icon.Video /> : live ? "Live channels" : "Followed channels"}</h3>
        <ul className="sidenav-list">
          {airing ? (
            <Row campaign={airing} live={live} featured collapsed={collapsed} />
          ) : (
            <li>
              <Link className="side-row" href="/live" title={collapsed ? "A.Infomercial · off air" : undefined}>
                <span className="avatar avatar-30 avatar-brand">A</span>
                {!collapsed && (
                  <>
                    <span className="side-row-text">
                      <span className="side-row-name">A.Infomercial</span>
                      <span className="side-row-meta">Home Shopping · off air</span>
                    </span>
                    <span className="side-row-count muted">Offline</span>
                  </>
                )}
              </Link>
            </li>
          )}
        </ul>
      </section>

      <section className="sidenav-section" aria-label="Recommended">
        <h3 className="sidenav-title">{collapsed ? <Icon.Heart /> : "Up next · open bids"}</h3>
        <ul className="sidenav-list">
          {recommended.map((campaign) => (
            <Row key={campaign.id} campaign={campaign} collapsed={collapsed} />
          ))}
          {recommended.length === 0 && !collapsed && (
            <li className="sidenav-empty">No bids waiting. The next bid airs first.</li>
          )}
        </ul>
        {!collapsed && (
          <Link className="sidenav-more" href="/console">
            {queue.length > recommended.length ? `Show ${queue.length - recommended.length} more` : "Place a bid"}
          </Link>
        )}
      </section>
    </aside>
  );
}
