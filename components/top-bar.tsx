"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/live", label: "Watch live" },
  { href: "/console", label: "Advertiser console" },
];

export function TopBar({ live }: { live?: boolean }) {
  const pathname = usePathname();
  return (
    <header className="topbar">
      <Link className="brand" href="/" aria-label="A.Infomercial home">
        A<span className="dot">.</span>Infomercial
      </Link>
      <nav aria-label="Main">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={pathname?.startsWith(link.href) ? "page" : undefined}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <span className="spacer" />
      {live !== undefined && (
        <span className={live ? "live-pill" : "live-pill off"}>
          {live ? "On air" : "Off air"}
        </span>
      )}
    </header>
  );
}
