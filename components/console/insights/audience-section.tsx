"use client";

import { fmtInt, type Audience, type DeviceSlice } from "@/lib/mock-insights";

import { InsightCard, Legend, PALETTE } from "./chart-kit";

const GENDER_COLORS = [PALETTE.cyan, PALETTE.gold, PALETTE.violet];
const DEVICE_COLORS: Record<DeviceSlice["label"], string> = {
  Mobile: PALETTE.cyan,
  Desktop: PALETTE.gold,
  CTV: PALETTE.green,
};

export function AudienceSection({ audience, viewers, accent }: { audience: Audience; viewers: number; accent: string }) {
  return (
    <div className="ins-grid ins-grid-audience">
      <AgeBands bands={audience.ageBands} accent={accent} />
      <DeviceDonut devices={audience.devices} />
      <MetroList metros={audience.metros} viewers={viewers} accent={accent} />
      <div className="ins-col">
        <GenderSplit split={audience.gender} />
        <NewVsReturning newPct={audience.newVsReturning.newPct} returningPct={audience.newVsReturning.returningPct} accent={accent} />
      </div>
    </div>
  );
}

function AgeBands({ bands, accent }: { bands: Audience["ageBands"]; accent: string }) {
  const max = Math.max(...bands.map((b) => b.sharePct));
  const top = bands.reduce((a, b) => (b.sharePct > a.sharePct ? b : a), bands[0]);
  return (
    <InsightCard title="Age bands" subtitle={`Share of unique viewers · ${top.label} is the largest group at ${top.sharePct}%`} className="ins-age">
      <div className="ins-bars" role="list">
        {bands.map((b) => (
          <div key={b.label} className="ins-bar-col" role="listitem" aria-label={`${b.label}: ${b.sharePct}%`}>
            <span className="ins-bar-value">{b.sharePct}%</span>
            <div className="ins-bar-track">
              <div
                className={`ins-bar-fill${b === top ? " hot" : ""}`}
                style={{ height: `${(b.sharePct / max) * 100}%`, background: b === top ? accent : undefined }}
              />
            </div>
            <span className="ins-bar-label">{b.label}</span>
          </div>
        ))}
      </div>
    </InsightCard>
  );
}

function GenderSplit({ split }: { split: Audience["gender"] }) {
  return (
    <InsightCard title="Gender split" subtitle="Self-reported on the viewer profile; undisclosed shown separately" className="ins-gender">
      <div className="ins-stack" role="img" aria-label={split.map((s) => `${s.label} ${s.sharePct}%`).join(", ")}>
        {split.map((s, i) => (
          <div key={s.label} className="ins-stack-seg" style={{ width: `${s.sharePct}%`, background: GENDER_COLORS[i] }}>
            {s.sharePct >= 12 && <span>{s.sharePct}%</span>}
          </div>
        ))}
      </div>
      <Legend items={split.map((s, i) => ({ label: s.label, color: GENDER_COLORS[i], value: `${s.sharePct}%` }))} />
    </InsightCard>
  );
}

function DeviceDonut({ devices }: { devices: DeviceSlice[] }) {
  const size = 148;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const lead = devices.reduce((a, b) => (b.sharePct > a.sharePct ? b : a), devices[0]);
  return (
    <InsightCard title="Device" subtitle="Where the stream was watched" className="ins-device">
      <div className="ins-donut-row">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={devices.map((d) => `${d.label} ${d.sharePct}%`).join(", ")} className="ins-donut">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={PALETTE.line} strokeWidth={stroke} />
          {devices.map((d) => {
            const len = (d.sharePct / 100) * c;
            const el = (
              <circle
                key={d.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={DEVICE_COLORS[d.label]}
                strokeWidth={stroke}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
            offset += len;
            return el;
          })}
          <text x="50%" y="47%" textAnchor="middle" className="ins-donut-value">
            {lead.sharePct}%
          </text>
          <text x="50%" y="60%" textAnchor="middle" className="ins-donut-label">
            {lead.label}
          </text>
        </svg>
        <Legend items={devices.map((d) => ({ label: d.label === "CTV" ? "Connected TV" : d.label, color: DEVICE_COLORS[d.label], value: `${d.sharePct}%` }))} />
      </div>
    </InsightCard>
  );
}

function NewVsReturning({ newPct, returningPct, accent }: { newPct: number; returningPct: number; accent: string }) {
  return (
    <InsightCard title="New vs returning" subtitle="Returning = watched a previous airing of this channel" className="ins-returning">
      <div className="ins-split">
        <div className="ins-split-num">
          <span className="ins-big" style={{ color: accent }}>
            {newPct}%
          </span>
          <span className="muted">new to the channel</span>
        </div>
        <div className="ins-split-num">
          <span className="ins-big">{returningPct}%</span>
          <span className="muted">returning viewers</span>
        </div>
      </div>
      <div className="ins-stack thin" role="img" aria-label={`New ${newPct}%, returning ${returningPct}%`}>
        <div className="ins-stack-seg" style={{ width: `${newPct}%`, background: accent }} />
        <div className="ins-stack-seg" style={{ width: `${returningPct}%`, background: PALETTE.muted }} />
      </div>
    </InsightCard>
  );
}

function MetroList({ metros, viewers, accent }: { metros: Audience["metros"]; viewers: number; accent: string }) {
  const max = metros[0]?.sharePct ?? 1;
  const covered = metros.reduce((a, m) => a + m.sharePct, 0);
  return (
    <InsightCard title="Top US metros" subtitle={`Top ${metros.length} metros cover ${covered.toFixed(0)}% of ${fmtInt(viewers)} viewers`} className="ins-metros">
      <ol className="ins-metro-list">
        {metros.map((m, i) => (
          <li key={m.name}>
            <span className="rank">{i + 1}</span>
            <span className="ins-metro-name">{m.name}</span>
            <span className="ins-metro-track" aria-hidden="true">
              <span className="ins-metro-fill" style={{ width: `${(m.sharePct / max) * 100}%`, background: accent }} />
            </span>
            <span className="ins-metro-viewers">{fmtInt(m.viewers)}</span>
            <span className="ins-metro-share muted">{m.sharePct.toFixed(1)}%</span>
          </li>
        ))}
      </ol>
    </InsightCard>
  );
}
