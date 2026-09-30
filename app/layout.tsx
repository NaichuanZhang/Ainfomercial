import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import "./station.css";

// Inter (OFL) is self-hosted so the demo renders the same on any machine, online or not.
const inter = localFont({
  src: "./fonts/InterVariable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "A.Infomercial: the shopping channel anyone can buy airtime on",
  description:
    "Upload a product, bid for airtime, and a live AI-generated infomercial pitches it on air and answers the chat.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
