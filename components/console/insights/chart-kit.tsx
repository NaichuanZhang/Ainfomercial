"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Card chrome shared by every metric/chart on the insights pages. Always carries the mock badge. */
export function InsightCard({
  title,
  subtitle,
  children,
  className,
  aside,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  /** Optional right-aligned slot next to the badge (legend, toggle...). */
  aside?: ReactNode;
}) {
  return (
    <section className={`card ins-card${className ? ` ${className}` : ""}`} aria-label={title}>
      <header className="ins-card-head">
        <div className="ins-card-titles">
          <h3>{title}</h3>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        <div className="ins-card-tools">
          {aside}
          <span className="mock-badge">Mocked data</span>
        </div>
      </header>
      {children}
    </section>
  );
}

/** Small up/down chip, e.g. "+12.4% vs last airing". */
export function Delta({ pct, className }: { pct: number | null; className?: string }) {
  if (pct === null) return null;
  const dir = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  const sign = pct > 0 ? "+" : "";
  return (
    <span className={`ins-delta ${dir}${className ? ` ${className}` : ""}`}>
      <span aria-hidden="true">{dir === "up" ? "▲" : dir === "down" ? "▼" : "•"}</span>
      {sign}
      {pct.toFixed(1)}%
      <span className="sr-only"> vs previous airing</span>
    </span>
  );
}

export function Legend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <ul className="ins-legend">
      {items.map((item) => (
        <li key={item.label}>
          <span className="ins-swatch" style={{ background: item.color }} aria-hidden="true" />
          <span className="ins-legend-label">{item.label}</span>
          {item.value && <span className="ins-legend-value">{item.value}</span>}
        </li>
      ))}
    </ul>
  );
}

/**
 * Width of a container element, kept up to date with ResizeObserver. The SVG charts
 * draw in CSS pixels so axis text stays legible on a 390 px phone as well as at 1440 px.
 */
export function useContainerWidth<T extends HTMLElement>(fallback = 900) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setWidth(w);
    };
    apply();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

/** Chart palette (matches the station tokens). */
export const PALETTE = {
  gold: "#ffd23f",
  cyan: "#3fd6ff",
  green: "#41e28a",
  red: "#ff3d3d",
  violet: "#b48cff",
  muted: "#9aa1c8",
  line: "#2a3163",
  ink: "#f6f3e8",
};
