"use client";

import { type ReactNode, useEffect, useState } from "react";

import { SideNav } from "@/components/shell/side-nav";
import { TopBar } from "@/components/top-bar";
import type { Campaign } from "@/lib/station-types";

const STORAGE_KEY = "ainfomercial-sidenav";
const NARROW = "(max-width: 1200px)";

/**
 * The page chrome every screen shares: sticky 50 px top nav, collapsible 240 px left sidebar,
 * scrolling content. Station data comes in as props so a page keeps its single subscription.
 */
export function AppShell({
  live,
  airing,
  queue,
  className,
  children,
}: {
  live?: boolean;
  airing: Campaign | null;
  queue: Campaign[];
  className?: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  // Like twitch.tv: the sidebar folds to icons on narrow windows, otherwise remembers the choice.
  useEffect(() => {
    const media = window.matchMedia(NARROW);
    const apply = () => setCollapsed(media.matches || localStorage.getItem(STORAGE_KEY) === "collapsed");
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const toggle = () => {
    setCollapsed((current) => {
      if (!window.matchMedia(NARROW).matches) localStorage.setItem(STORAGE_KEY, current ? "expanded" : "collapsed");
      return !current;
    });
  };

  return (
    <div className={`shell${collapsed ? " side-collapsed" : ""}${className ? ` ${className}` : ""}`}>
      <TopBar live={live} onMenu={toggle} />
      <div className="shell-body">
        <SideNav live={!!live} airing={airing} queue={queue} collapsed={collapsed} onToggle={toggle} />
        <main className="shell-main">{children}</main>
      </div>
    </div>
  );
}
