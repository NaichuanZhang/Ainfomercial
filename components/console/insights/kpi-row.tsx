"use client";

import type { Kpi } from "@/lib/mock-insights";

import { Delta } from "./chart-kit";

/** The 13 headline numbers. Every tile carries its own mock badge (bottom-right). */
export function KpiRow({ kpis }: { kpis: Kpi[] }) {
  return (
    <section className="ins-kpis" aria-label="Key metrics">
      {kpis.map((kpi) => (
        <article key={kpi.key} className={`card ins-kpi ins-kpi-${kpi.key}`}>
          <span className="ins-kpi-label">{kpi.label}</span>
          <p className="ins-kpi-value">{kpi.value}</p>
          <span className="ins-kpi-hint">{kpi.hint}</span>
          <footer className="ins-kpi-foot">
            <Delta pct={kpi.deltaPct} />
            <span className="mock-badge">Mocked data</span>
          </footer>
        </article>
      ))}
    </section>
  );
}
