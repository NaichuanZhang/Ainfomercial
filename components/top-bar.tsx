"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/shell/icons";

const LINKS = [
  { href: "/live", label: "Watch live" },
  { href: "/console", label: "Advertiser console", exact: true },
  { href: "/console/insights", label: "Insights" },
];

/** 50 px top navigation: wordmark, primary links, centered search, primary action and icon buttons. */
export function TopBar({ live, onMenu }: { live?: boolean; onMenu?: () => void }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [query, setQuery] = useState("");

  const isCurrent = (link: (typeof LINKS)[number]) =>
    link.exact ? pathname === link.href : pathname.startsWith(link.href);

  return (
    <header className="topnav">
      <div className="topnav-left">
        {onMenu && (
          <button type="button" className="icon-btn topnav-menu" aria-label="Toggle sidebar" onClick={onMenu}>
            <Icon.Menu />
          </button>
        )}
        <Link className="brand" href="/" aria-label="A.Infomercial home">
          <span className="brand-mark" aria-hidden="true">
            A
          </span>
          <span className="brand-word">
            A<span className="dot">.</span>Infomercial
          </span>
        </Link>
        <nav className="topnav-links" aria-label="Main">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} aria-current={isCurrent(link) ? "page" : undefined}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="topnav-center">
        <form
          className="topnav-search"
          role="search"
          onSubmit={(event) => {
            // Decorative on purpose: there is one channel, so any search lands on it.
            event.preventDefault();
            setQuery("");
            router.push("/live");
          }}
        >
          <label className="sr-only" htmlFor="topnav-search">
            Search
          </label>
          <input
            id="topnav-search"
            type="search"
            placeholder="Search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit" aria-label="Search">
            <Icon.Search />
          </button>
        </form>
      </div>

      <div className="topnav-right">
        {live !== undefined && (
          <span className={live ? "live-pill topnav-live" : "live-pill off topnav-live"}>{live ? "On air" : "Off air"}</span>
        )}
        <button type="button" className="icon-btn topnav-icon" aria-label="Notifications">
          <Icon.Bell />
        </button>
        <button type="button" className="icon-btn topnav-icon" aria-label="Whispers">
          <Icon.Inbox />
        </button>
        <Link className="btn primary topnav-cta" href="/console">
          Buy airtime
        </Link>
        <span className="avatar avatar-30 topnav-avatar" aria-hidden="true">
          <Icon.Person size={18} />
        </span>
      </div>
    </header>
  );
}
