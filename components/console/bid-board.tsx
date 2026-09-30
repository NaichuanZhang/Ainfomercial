"use client";

import { useState } from "react";

import { itemNumber } from "@/components/live/broadcast-overlay";
import type { Campaign } from "@/lib/station-types";

export function BidBoard({
  airing,
  queue,
  highlightId,
}: {
  airing: Campaign | null;
  queue: Campaign[];
  highlightId?: string | null;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");

  const raise = async (campaign: Campaign, by: number) => {
    setPending(campaign.id);
    setError("");
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bid_per_min: Number(campaign.bid_per_min) + by }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Bid failed");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending(null);
    }
  };

  return (
    <aside className="card board" aria-label="Live bid board">
      <div className="board-head">
        <h2>Live bid board</h2>
        <span className="live-pill">Open auction</span>
      </div>

      <div className="board-now">
        <span className="board-label">On air</span>
        {airing ? (
          <div className="board-row airing">
            <Thumb campaign={airing} live />
            <div className="board-name">
              <strong>{airing.product_name}</strong>
              <span className="muted">
                {airing.brand} · {itemNumber(airing)}
              </span>
            </div>
            <span className="bid">{Number(airing.bid_per_min).toFixed(0)}/min</span>
          </div>
        ) : (
          <p className="muted">Nothing on air.</p>
        )}
      </div>

      <span className="board-label">Up next (highest bid airs first)</span>
      {queue.length === 0 ? (
        <p className="muted">Queue is empty. The next bid airs next.</p>
      ) : (
        <ol className="board-list">
          {queue.map((campaign, index) => (
            <li key={campaign.id} className={campaign.id === highlightId ? "board-row mine" : "board-row"}>
              <span className="rank">{index + 1}</span>
              <Thumb campaign={campaign} />
              <div className="board-name">
                <strong>{campaign.product_name}</strong>
                <span className="muted">
                  {campaign.brand} · {Math.max(0, Number(campaign.budget) - Number(campaign.spent)).toFixed(0)} credits left
                </span>
              </div>
              <span className="bid">{Number(campaign.bid_per_min).toFixed(0)}/min</span>
              <button
                type="button"
                className="btn small"
                disabled={pending === campaign.id}
                onClick={() => void raise(campaign, 5)}
                title="Raise this bid by 5 credits/min"
              >
                +5
              </button>
            </li>
          ))}
        </ol>
      )}
      {error && <p className="chat-error">{error}</p>}
      <p className="muted fine">
        Demo credits, not real money. Budgets are debited per second of airtime at the winning bid.
      </p>
    </aside>
  );
}

function Thumb({ campaign, live }: { campaign: Campaign; live?: boolean }) {
  return (
    <span className={`avatar avatar-30 thumb${live ? " ring-live" : ""}`}>
      {campaign.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={campaign.image_url} alt="" />
      ) : (
        <span className="avatar-letter">{campaign.product_name.slice(0, 1)}</span>
      )}
    </span>
  );
}
