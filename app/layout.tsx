import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./station.css";

export const metadata: Metadata = {
  title: "A.Infomercial: the shopping channel anyone can buy airtime on",
  description:
    "Upload a product, bid for airtime, and a live AI-generated infomercial pitches it on air and answers the chat.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
