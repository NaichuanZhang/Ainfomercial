import type { Metadata } from "next";

import { DemoPage } from "@/components/demo-page";

export const metadata: Metadata = {
  title: "Demo video · A.Infomercial",
  description: "A 2:45 walkthrough: advertiser console, the live Orbis channel with on-air Q&A and steered handoffs, and insights.",
};

export default function Demo() {
  return <DemoPage />;
}
