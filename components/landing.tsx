"use client";

import Link from "next/link";

import { LandingStatus } from "@/components/landing-status";
import { AppShell } from "@/components/shell/app-shell";
import { Icon } from "@/components/shell/icons";
import { useStation } from "@/hooks/use-station";

export function Landing() {
  const { channel, airing, queue } = useStation();
  const live = channel?.status === "live";
  const feature = airing ?? queue[0] ?? null;

  return (
    <AppShell live={live} airing={airing} queue={queue}>
      <main className="page landing">
        <section className="hero" aria-label="Featured channel">
          <Link className="hero-preview" href="/live" aria-label="Open the live channel">
            <span className={live ? "live-pill" : "live-pill off"}>{live ? "Live" : "Off air"}</span>
            <span className="hero-preview-body">
              {feature?.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={feature.image_url} alt="" />
              ) : (
                <span className="hero-play" aria-hidden="true">
                  <Icon.Play size={26} />
                </span>
              )}
              <strong>{feature ? feature.product_name : "A.Infomercial"}</strong>
              <span className="muted">
                {feature ? `${live ? "Now airing" : "Up next"} · ${feature.brand}` : "Live AI home-shopping, open bidding"}
              </span>
            </span>
            <span className="hero-viewers">Home Shopping</span>
          </Link>

          <div className="hero-card">
            <p className="eyebrow">Live AI home-shopping, open bidding</p>
            <h1>
              The shopping channel <em>anyone</em> can buy airtime on
            </h1>
            <p>
              Upload a product, place a bid, and the highest bid airs next. A live AI-generated infomercial pulls your
              product onto the set, pitches it, and answers viewers&apos; questions on air, re-staging the shot as they
              ask.
            </p>
            <div className="ctas">
              <Link className="btn primary big" href="/live">
                <Icon.Play />
                Watch the channel
              </Link>
              <Link className="btn big" href="/console">
                Buy airtime
              </Link>
              <Link className="btn big" href="/console/insights">
                See the analytics
              </Link>
            </div>
            <LandingStatus channel={channel} airing={airing} queue={queue} />
          </div>
        </section>

        <section aria-label="How it works">
          <div className="section-head">
            <h2>How it works</h2>
            <Link href="/console">Start a campaign</Link>
          </div>
          <div className="steps">
            <div className="card">
              <span className="num">1</span>
              <h2>Upload the product</h2>
              <p>Photo, price, key facts, how it looks and tastes. AI drafts the scene beats.</p>
            </div>
            <div className="card">
              <span className="num">2</span>
              <h2>Bid for airtime</h2>
              <p>Credits per minute of airtime. Highest bid airs next; raise it any time.</p>
            </div>
            <div className="card">
              <span className="num">3</span>
              <h2>Go live</h2>
              <p>Reactor Orbis generates the infomercial in real time. No clip is pre-rendered.</p>
            </div>
            <div className="card">
              <span className="num">4</span>
              <h2>Answer the chat</h2>
              <p>Viewer questions get a spoken answer from your facts, and the video re-stages to show it.</p>
            </div>
          </div>
        </section>

        <p className="fineprint">
          All video is AI-generated. Prices and product facts are shown as text overlays supplied by the advertiser,
          never rendered by the model. Built for the Visko Orbis Online Challenge on Reactor Orbis and InsForge.
        </p>
      </main>
    </AppShell>
  );
}
