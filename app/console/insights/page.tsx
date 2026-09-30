import type { Metadata } from "next";

import { InsightsDashboard } from "@/components/console/insights/insights-dashboard";
import { TopBar } from "@/components/top-bar";

import "./insights.css";

export const metadata: Metadata = {
  title: "Insights · A.Infomercial advertiser console",
  description: "Audience and conversion insights for a campaign's last airing (demo preview with mocked data).",
};

export default function InsightsPage() {
  return (
    <>
      <TopBar />
      <InsightsDashboard />
    </>
  );
}
