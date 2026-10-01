"use client";

import { SEGMENT_SECONDS } from "@/lib/mock-insights";
import { fmtClock, fmtCompact, fmtInt, type AnswerMarker, type ViewerPoint } from "@/lib/mock-insights";

import { InsightCard, Legend, PALETTE, useContainerWidth } from "./chart-kit";

type Pt = { x: number; y: number };

/** Catmull-Rom -> cubic Bezier so the area reads as a smooth curve, not a sawtooth. */
function smoothPath(points: Pt[]): string {
  if (points.length < 2) return "";
  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

/** Y-axis ceiling and tick step so the grid lands on round numbers (0 / 1k / 2k / 3k / 4k). */
function niceScale(peak: number): { yMax: number; ticks: number[] } {
  const target = peak * 1.1;
  for (const step of [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000]) {
    const count = Math.ceil(target / step);
    if (count <= 5) {
      const yMax = count * step;
      return { yMax, ticks: Array.from({ length: count + 1 }, (_, i) => i * step) };
    }
  }
  return { yMax: target, ticks: [0, target] };
}

export function ViewersChart({
  timeline,
  markers,
  airtimeSeconds,
  segments,
  accent,
  peak,
}: {
  timeline: ViewerPoint[];
  markers: AnswerMarker[];
  airtimeSeconds: number;
  segments: number;
  accent: string;
  peak: number;
}) {
  const { ref, width } = useContainerWidth<HTMLDivElement>(960);
  const narrow = width < 560;
  const H = narrow ? 240 : 300;
  const ml = narrow ? 36 : 48;
  const mr = 12;
  const mt = 30;
  const mb = 34;
  const plotW = Math.max(40, width - ml - mr);
  const plotH = H - mt - mb;
  const { yMax, ticks: yTicks } = niceScale(peak);

  const x = (t: number) => ml + (t / airtimeSeconds) * plotW;
  const y = (v: number) => mt + plotH - (v / yMax) * plotH;

  const pts = timeline.map((p) => ({ x: x(p.t), y: y(p.viewers) }));
  const linePath = smoothPath(pts);
  const areaPath = `${linePath} L${x(airtimeSeconds).toFixed(1)},${(mt + plotH).toFixed(1)} L${ml},${(mt + plotH).toFixed(1)} Z`;

  const segmentTicks = Array.from({ length: segments + 1 }, (_, i) => i * SEGMENT_SECONDS);
  // On a phone, label every other boundary so the mm:ss labels never collide.
  const labelEvery = narrow && segments > 4 ? 2 : 1;
  const peakPoint = timeline.find((p) => p.viewers === peak) ?? timeline[0];
  const gradientId = `ins-area-${accent.replace("#", "")}`;

  return (
    <InsightCard
      title="Viewers over time"
      subtitle={`Concurrent viewers across ${segments} × ${SEGMENT_SECONDS} s airing segments · markers show where the host answered a question on air`}
      className="ins-viewers"
      aside={
        <Legend
          items={[
            { label: "Concurrent viewers", color: accent },
            { label: "Answered on air", color: PALETTE.gold },
          ]}
        />
      }
    >
      <div ref={ref} className="ins-chart-wrap">
        <svg
          className="ins-svg"
          width={width}
          height={H}
          viewBox={`0 0 ${width} ${H}`}
          role="img"
          aria-label={`Concurrent viewers over ${fmtClock(airtimeSeconds)} of airtime, peaking at ${fmtInt(peak)}`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.55" />
              <stop offset="100%" stopColor={accent} stopOpacity="0.03" />
            </linearGradient>
          </defs>

          {/* segment bands + dividers */}
          {segmentTicks.slice(0, -1).map((t, i) => (
            <g key={t}>
              {i % 2 === 1 && (
                <rect
                  x={x(t)}
                  y={mt}
                  width={x(t + SEGMENT_SECONDS) - x(t)}
                  height={plotH}
                  fill="rgba(255,255,255,0.025)"
                />
              )}
              {!narrow && (
                <text x={x(t) + 6} y={mt + 14} className="ins-seg-label">
                  Segment {i + 1}
                </text>
              )}
            </g>
          ))}
          {segmentTicks.map((t) => (
            <line
              key={`div-${t}`}
              x1={x(t)}
              x2={x(t)}
              y1={mt}
              y2={mt + plotH}
              stroke={PALETTE.line}
              strokeDasharray="3 4"
            />
          ))}

          {/* y grid */}
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={ml} x2={ml + plotW} y1={y(v)} y2={y(v)} stroke={PALETTE.line} strokeOpacity={v === 0 ? 1 : 0.6} />
              <text x={ml - 6} y={y(v) + 4} textAnchor="end" className="ins-axis">
                {fmtCompact(v)}
              </text>
            </g>
          ))}

          {/* area + line */}
          <path d={areaPath} fill={`url(#${gradientId})`} className="ins-area" />
          <path d={linePath} fill="none" stroke={accent} strokeWidth={2.2} strokeLinejoin="round" />

          {/* peak */}
          <g>
            <circle cx={x(peakPoint.t)} cy={y(peak)} r={4} fill={PALETTE.ink} stroke={accent} strokeWidth={2} />
            <text
              x={Math.min(x(peakPoint.t), ml + plotW - 70)}
              y={y(peak) - 10}
              textAnchor={x(peakPoint.t) > ml + plotW - 70 ? "start" : "middle"}
              className="ins-peak-label"
            >
              peak {fmtInt(peak)}
            </text>
          </g>

          {/* answered-question markers */}
          {markers.map((m, i) => (
            <g key={m.t} className="ins-marker">
              <title>{`${fmtClock(m.t)} · ${m.question}`}</title>
              <line x1={x(m.t)} x2={x(m.t)} y1={y(m.viewers)} y2={mt + plotH} stroke={PALETTE.gold} strokeOpacity={0.55} strokeDasharray="2 3" />
              <circle cx={x(m.t)} cy={y(m.viewers)} r={narrow ? 8 : 9} fill={PALETTE.gold} stroke="#18181b" strokeWidth={2} />
              <text x={x(m.t)} y={y(m.viewers) + 3.5} textAnchor="middle" className="ins-marker-num">
                {i + 1}
              </text>
            </g>
          ))}

          {/* x axis */}
          {segmentTicks.map((t, i) =>
            i % labelEvery === 0 || i === segmentTicks.length - 1 ? (
              <text
                key={`x-${t}`}
                x={x(t)}
                y={H - 10}
                textAnchor={i === 0 ? "start" : i === segmentTicks.length - 1 ? "end" : "middle"}
                className="ins-axis"
              >
                {fmtClock(t)}
              </text>
            ) : null,
          )}
        </svg>
      </div>

      <ol className="ins-marker-list" aria-label="Questions answered on air">
        {markers.map((m, i) => (
          <li key={m.t}>
            <span className="ins-marker-chip" aria-hidden="true">
              {i + 1}
            </span>
            <span className="ins-marker-time">{fmtClock(m.t)}</span>
            <span className="ins-marker-q">{m.question}</span>
            <span className="ins-marker-viewers muted">{fmtInt(m.viewers)} watching</span>
          </li>
        ))}
      </ol>
    </InsightCard>
  );
}
