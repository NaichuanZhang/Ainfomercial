"use client";

import { InsightsDashboard } from "@/components/console/insights/insights-dashboard";
import { AppShell } from "@/components/shell/app-shell";
import { useStation } from "@/hooks/use-station";

/** Insights inside the shared shell; the sidebar needs the station's queue like every other page. */
export function InsightsShell() {
  const station = useStation();
  return (
    <AppShell live={station.channel?.status === "live"} airing={station.airing} queue={station.queue}>
      <InsightsDashboard />
    </AppShell>
  );
}
