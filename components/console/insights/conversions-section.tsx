"use client";

import { ANSWER_WINDOW_SECONDS, fmtClock, fmtInt, fmtMoneyCents, fmtPct, type Conversions } from "@/lib/mock-insights";

import { Delta, InsightCard, PALETTE } from "./chart-kit";

export function ConversionsSection({ conversions, accent, unitPrice }: { conversions: Conversions; accent: string; unitPrice: number }) {
  return (
    <div className="ins-grid ins-grid-conversions">
      <Funnel funnel={conversions.funnel} accent={accent} />
      <AnswerImpact impact={conversions.answerImpact} accent={accent} />
      <OrdersTable orders={conversions.orders} unitPrice={unitPrice} />
    </div>
  );
}

function Funnel({ funnel, accent }: { funnel: Conversions["funnel"]; accent: string }) {
  const top = funnel[0].value;
  const last = funnel[funnel.length - 1];
  const viewers = funnel.find((s) => s.key === "viewers");
  // Largest relative drop between consecutive steps (skipping the reach -> viewers tune-in step).
  const biggestDrop = funnel
    .slice(2)
    .reduce((worst, step, i) => (step.pctOfPrev < worst.step.pctOfPrev ? { step, prev: funnel[i + 1] } : worst), {
      step: funnel[2],
      prev: funnel[1],
    });
  return (
    <InsightCard
      title="Conversion funnel"
      subtitle={`${fmtInt(last.value)} purchases from ${fmtInt(viewers?.value ?? 0)} viewers · ${fmtPct(last.pctOfViewers, 1)} viewer-to-purchase`}
      className="ins-funnel"
    >
      <ol className="ins-funnel-list">
        {funnel.map((step, i) => {
          // sqrt keeps the small bottom steps visible while the shape still tapers.
          const w = Math.max(6, Math.sqrt(step.value / top) * 100);
          return (
            <li key={step.key} className="ins-funnel-row">
              <div className="ins-funnel-label">
                <span className="ins-funnel-name">{step.label}</span>
                <span className="ins-funnel-count">{fmtInt(step.value)}</span>
              </div>
              <div className="ins-funnel-track">
                <div
                  className="ins-funnel-bar"
                  style={{
                    width: `${w}%`,
                    background: i === funnel.length - 1 ? accent : undefined,
                    opacity: 0.45 + (i / (funnel.length - 1)) * 0.55,
                  }}
                />
              </div>
              <div className="ins-funnel-meta">
                {i === 0 ? (
                  <span className="muted">reach</span>
                ) : (
                  <>
                    <span className="ins-funnel-step">{fmtPct(step.pctOfPrev, step.pctOfPrev < 10 ? 1 : 0)}</span>
                    <span className="muted"> of prev</span>
                    {i >= 2 && <span className="ins-funnel-of-viewers muted"> · {fmtPct(step.pctOfViewers, step.pctOfViewers < 10 ? 1 : 0)} of viewers</span>}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="ins-funnel-note muted">
        Largest drop-off: <strong>{biggestDrop.prev.label}</strong> → <strong>{biggestDrop.step.label}</strong>, where{" "}
        {fmtPct(100 - biggestDrop.step.pctOfPrev, 0)} of the {biggestDrop.prev.label.toLowerCase()} step fell away. Each step
        counts unique viewers, so the funnel is monotonic by construction.
      </p>
    </InsightCard>
  );
}

function AnswerImpact({ impact, accent }: { impact: Conversions["answerImpact"]; accent: string }) {
  const max = Math.max(...impact.moments.map((m) => Math.max(m.atcBefore, m.atcAfter)), 1);
  return (
    <InsightCard
      title="Answer impact"
      subtitle={`Add-to-carts per minute in the ${ANSWER_WINDOW_SECONDS} s after the host answered a viewer on air, vs the rest of the airing`}
      className="ins-answer"
    >
      <div className="ins-split">
        <div className="ins-split-num">
          <span className="ins-big">{impact.baselineAtcPerMin.toFixed(0)}</span>
          <span className="muted">add-to-carts / min · baseline</span>
        </div>
        <div className="ins-split-num">
          <span className="ins-big" style={{ color: accent }}>
            {impact.postAnswerAtcPerMin.toFixed(0)}
          </span>
          <span className="muted">add-to-carts / min · after an answer</span>
        </div>
        <div className="ins-split-num ins-lift">
          <Delta pct={impact.liftPct} className="big" />
          <span className="muted">lift · {fmtPct(impact.atcInWindowsPct, 0)} of all add-to-carts landed in those windows</span>
        </div>
      </div>
      <p className="eyebrow ins-subhead">Biggest moments</p>
      <ol className="ins-moments">
        {impact.moments.map((m) => (
          <li key={m.t}>
            <div className="ins-moment-head">
              <span className="ins-marker-time">{fmtClock(m.t)}</span>
              <span className="ins-moment-q">{m.question}</span>
              <span className="ins-moment-delta">+{m.atcAfter - m.atcBefore} carts</span>
            </div>
            <div className="ins-moment-bars" aria-label={`${m.atcBefore} add-to-carts before, ${m.atcAfter} after`}>
              <span className="ins-moment-bar before" style={{ width: `${(m.atcBefore / max) * 100}%` }}>
                <em>{m.atcBefore} before</em>
              </span>
              <span className="ins-moment-bar after" style={{ width: `${(m.atcAfter / max) * 100}%`, background: accent }}>
                <em>{m.atcAfter} after</em>
              </span>
            </div>
          </li>
        ))}
      </ol>
    </InsightCard>
  );
}

function OrdersTable({ orders, unitPrice }: { orders: Conversions["orders"]; unitPrice: number }) {
  return (
    <InsightCard title="Recent attributed orders" subtitle={`Last ${orders.length} orders placed from the product card during the airing · unit price ${fmtMoneyCents(unitPrice)}`} className="ins-orders">
      <div className="ins-table-wrap">
        <table className="ins-table">
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Time</th>
              <th scope="col" className="num">
                Qty
              </th>
              <th scope="col" className="num">
                Value
              </th>
              <th scope="col" className="ins-col-metro">
                Metro
              </th>
              <th scope="col" className="ins-col-device">
                Device
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="mono">{o.id}</td>
                <td className="mono">{o.time}</td>
                <td className="num">{o.qty}</td>
                <td className="num">{fmtMoneyCents(o.value)}</td>
                <td className="ins-col-metro">{o.metro}</td>
                <td className="ins-col-device">
                  <span className="ins-device-chip" style={{ borderColor: o.device === "Mobile" ? PALETTE.cyan : o.device === "Desktop" ? PALETTE.gold : PALETTE.green }}>
                    {o.device}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </InsightCard>
  );
}
