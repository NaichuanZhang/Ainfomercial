import Link from "next/link";

import { TopBar } from "@/components/top-bar";

export default function Landing() {
  return (
    <>
      <TopBar />
      <main className="page">
        <section className="hero">
          <p className="eyebrow">Live AI home-shopping, open bidding</p>
          <h1>
            The shopping channel <em>anyone</em> can buy airtime on
          </h1>
          <p>
            Upload a product, place a bid, and the highest bid airs next. A live
            AI-generated infomercial pulls your product onto the set, pitches
            it, and answers viewers&apos; questions on air, re-staging the shot
            as they ask.
          </p>
          <div className="ctas">
            <Link className="btn primary" href="/live">
              Watch the channel
            </Link>
            <Link className="btn" href="/console">
              Buy airtime
            </Link>
          </div>
        </section>

        <section className="steps" aria-label="How it works">
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
        </section>

        <p className="fineprint">
          All video is AI-generated. Prices and product facts are shown as text
          overlays supplied by the advertiser, never rendered by the model.
          Built for the Visko Orbis Online Challenge on Reactor Orbis and InsForge.
        </p>
      </main>
    </>
  );
}
