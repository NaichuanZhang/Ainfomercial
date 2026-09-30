"use client";

import { useState } from "react";

import {
  DEFAULT_INSIGHTS_CAMPAIGN,
  fmtClock,
  fmtInt,
  getCampaignInsights,
  listInsightsCampaigns,
  type InsightsCampaignId,
} from "@/lib/mock-insights";
import { SEGMENT_SECONDS } from "@/lib/station-types";

import { AudienceSection } from "./audience-section";
import { ConversionsSection } from "./conversions-section";
import { KpiRow } from "./kpi-row";
import { ViewersChart } from "./viewers-chart";

type Tab = "audience" | "conversions";

const TABS: { id: Tab; label: string; blurb: string }[] = [
  { id: "audience", label: "Audience", blurb: "Who watched" },
  { id: "conversions", label: "Conversions", blurb: "What they bought" },
];

export function InsightsDashboard() {
  const [campaignId, setCampaignId] = useState<InsightsCampaignId>(DEFAULT_INSIGHTS_CAMPAIGN);
  const [tab, setTab] = useState<Tab>("audience");
  const campaigns = listInsightsCampaigns();
  const data = getCampaignInsights(campaignId);
  const { campaign, totals } = data;

  return (
    <main className="page ins-page">
      <div className="ins-banner" role="note">
        <span className="mock-badge">Mocked data</span>
        <p>
          <strong>Illustrative numbers.</strong> This dashboard is a demo preview: every figure on this page is
          generated mock data, not measured traffic. Attribution, audience and order data will populate once the
          channel&apos;s analytics pipeline is connected.
        </p>
      </div>

      <header className="ins-head">
        <div className="ins-head-titles">
          <p className="eyebrow">Advertiser console · Insights</p>
          <h1>
            {campaign.product} <span className="muted">by {campaign.brand}</span>
          </h1>
          <p className="ins-head-sub muted">
            {campaign.category} · winning bid {fmtInt(campaign.bidPerMin)} credits/min · aired {campaign.segments} ×{" "}
            {SEGMENT_SECONDS} s ({fmtClock(data.airtimeSeconds)} on air) starting {campaign.airingStart}
          </p>
        </div>
        <div className="ins-controls">
          <label className="ins-select">
            <span className="ins-select-label">Campaign</span>
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value as InsightsCampaignId)} aria-label="Campaign">
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.product}
                </option>
              ))}
            </select>
          </label>
          <span className="ins-pill" title="Only the most recent airing is shown in this preview">
            <span className="ins-pill-dot" aria-hidden="true" />
            {data.periodLabel}
          </span>
        </div>
      </header>

      <KpiRow kpis={data.kpis} />

      <ViewersChart
        timeline={data.timeline}
        markers={data.markers}
        airtimeSeconds={data.airtimeSeconds}
        segments={campaign.segments}
        accent={campaign.accent}
        peak={totals.peakConcurrent}
      />

      <div className="ins-tabs" role="tablist" aria-label="Insights sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`ins-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`ins-panel-${t.id}`}
            className={`ins-tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span className="ins-tab-label">{t.label}</span>
            <span className="ins-tab-blurb">{t.blurb}</span>
          </button>
        ))}
      </div>

      <section
        key={`${campaignId}-${tab}`}
        id={`ins-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`ins-tab-${tab}`}
        className="ins-panel"
      >
        {tab === "audience" ? (
          <AudienceSection audience={data.audience} viewers={totals.viewers} accent={campaign.accent} />
        ) : (
          <ConversionsSection conversions={data.conversions} accent={campaign.accent} unitPrice={campaign.unitPrice} />
        )}
      </section>

      <p className="fineprint">
        All figures are mocked for the demo and regenerate deterministically per campaign. Spend is the winning bid
        (credits per minute) multiplied by airtime; ROAS treats 1 credit as $1.
      </p>
    </main>
  );
}
