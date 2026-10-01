"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { BroadcastOverlay } from "@/components/live/broadcast-overlay";
import { SEAM_IDLE, SeamContext, SeamCover, type SeamState } from "@/components/live/seam-cover";
import { RESET_SETTLE_MS } from "@/lib/handoff";
import { type Campaign, type ChannelState, SEGMENT_SECONDS } from "@/lib/station-types";

/**
 * Dev-only harness for the product-handoff seam cover. No Orbis session, no network: a canvas
 * animation stands in for the live picture, and buttons (or ?auto=freeze|fade|same) replay the
 * channel_state transitions the director produces. Disabled in production builds.
 */

const swatch = (color: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="14" y="4" width="36" height="56" rx="8" fill="${color}"/></svg>`,
  )}`;

const campaign = (id: string, product_name: string, brand: string, color: string, price: string): Campaign => ({
  id,
  brand,
  product_name,
  tagline: `${product_name}, live on air`,
  image_url: swatch(color),
  image_key: null,
  staged_image_url: null,
  staged_image_key: null,
  price,
  compare_at_price: null,
  look: null,
  taste: null,
  facts: [
    { label: "Calories", value: "Zero" },
    { label: "Pack", value: "12 cans" },
  ],
  beats: ["beat one", "beat two"],
  audio_prompt: null,
  host_script: null,
  host_lines: [],
  bid_per_min: 25,
  budget: 500,
  spent: 0,
  airtime_seconds: 0,
  status: "queued",
  created_at: "2026-09-30T00:00:00Z",
  updated_at: "2026-09-30T00:00:00Z",
});

const PRODUCT_A = campaign("aaaaaaaa-0000-4000-8000-000000000001", "Diet Coke", "Coca-Cola", "#c8102e", "$8.99 / 12-pack");
const PRODUCT_B = campaign("bbbbbbbb-0000-4000-8000-000000000002", "Fizzix Zero", "Fizzix", "#1f7ae0", "$7.49 / 12-pack");
const PRODUCTS: Record<string, Campaign> = { [PRODUCT_A.id]: PRODUCT_A, [PRODUCT_B.id]: PRODUCT_B };

const makeChannel = (status: ChannelState["status"], airingId: string | null): ChannelState => {
  const now = Date.now();
  return {
    id: "main",
    status,
    session_id: "lab",
    airing_campaign_id: airingId,
    segment_started_at: new Date(now).toISOString(),
    segment_ends_at: new Date(now + SEGMENT_SECONDS * 1000).toISOString(),
    beat_index: 0,
    current_prompt: null,
    airtime_day: "2026-09-30",
    airtime_seconds_day: 0,
    updated_at: new Date(now).toISOString(),
  };
};

/** What the fake Orbis run is drawing: a product's shot, or nothing (the reset stall). */
type Run = { product: Campaign | null; emptyHands: boolean };

function drawFrame(context: CanvasRenderingContext2D, run: Run, frame: number) {
  const { width, height } = context.canvas;
  if (!run.product) {
    // Reset stall: the stream carries black. The seam cover must hide this.
    context.fillStyle = "#000";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#333";
    context.font = `${Math.round(height / 18)}px sans-serif`;
    context.fillText("(orbis reset: no frames)", width * 0.06, height * 0.5);
    return;
  }
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#17122b");
  gradient.addColorStop(1, "#07060c");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  // Twinkling studio lights.
  for (let i = 0; i < 24; i += 1) {
    const x = ((i * 977) % 1000) / 1000;
    const y = ((i * 613) % 400) / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(frame / 9 + i);
    context.fillStyle = i % 2 ? `rgba(230,190,90,${0.3 + 0.5 * pulse})` : `rgba(110,150,255,${0.3 + 0.5 * pulse})`;
    context.beginPath();
    context.arc(x * width, 0.08 * height + y * height, 4 + 5 * pulse, 0, Math.PI * 2);
    context.fill();
  }
  // Counter.
  context.fillStyle = "#101014";
  context.fillRect(0, height * 0.68, width, height * 0.32);
  context.fillStyle = "rgba(255,255,255,0.08)";
  context.fillRect(0, height * 0.68, width, 6);
  // Host: a bobbing head and shoulders.
  const bob = Math.sin(frame / 7) * height * 0.01;
  context.fillStyle = "#1a7f8e";
  context.beginPath();
  context.ellipse(width * 0.42, height * 0.72 + bob, width * 0.13, height * 0.16, 0, Math.PI, 0);
  context.fill();
  context.fillStyle = "#e8c4a0";
  context.beginPath();
  context.arc(width * 0.42, height * 0.4 + bob, height * 0.13, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#2b1d14";
  context.beginPath();
  context.arc(width * 0.42, height * 0.33 + bob, height * 0.13, Math.PI, 0);
  context.fill();
  // Pedestal on the right, with the product on it unless the host has put it away.
  context.fillStyle = "#0a0a0c";
  context.fillRect(width * 0.7, height * 0.5, width * 0.09, height * 0.2);
  if (!run.emptyHands) {
    context.fillStyle = run.product.image_url?.includes("c8102e") ? "#c8102e" : "#1f7ae0";
    context.fillRect(width * 0.715, height * 0.3, width * 0.06, height * 0.2);
    context.fillStyle = "#fff";
    context.font = `bold ${Math.round(height / 32)}px sans-serif`;
    context.fillText(run.product.product_name, width * 0.705, height * 0.28);
  }
  // Frame counter: a held frame stops counting while the live picture keeps going.
  context.fillStyle = "rgba(255,255,255,0.75)";
  context.font = `${Math.round(height / 26)}px ui-monospace, monospace`;
  context.fillText(`live frame ${String(frame).padStart(5, "0")}`, width * 0.4, height * 0.95);
}

function Harness() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const runRef = useRef<Run>({ product: PRODUCT_A, emptyHands: false });
  const [channel, setChannel] = useState<ChannelState>(() => makeChannel("live", PRODUCT_A.id));
  const [seam, setSeam] = useState<SeamState>(SEAM_IDLE);
  const [log, setLog] = useState<string[]>([]);
  const airing = channel.airing_campaign_id ? (PRODUCTS[channel.airing_campaign_id] ?? null) : null;
  const getVideo = useCallback(() => videoRef.current, []);

  const note = useCallback((line: string) => {
    setLog((current) => [`${new Date().toLocaleTimeString()} ${line}`, ...current].slice(0, 12));
  }, []);

  // A canvas animation is the "Orbis" picture; captureStream makes it a real <video> source.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const context = canvas.getContext("2d");
    if (!context) return;
    const stream = canvas.captureStream(18);
    video.srcObject = stream;
    void video.play().catch(() => undefined);
    let frame = 0;
    const timer = setInterval(() => {
      frame += 1;
      drawFrame(context, runRef.current, frame);
    }, 1000 / 18);
    return () => {
      clearInterval(timer);
      for (const track of stream.getTracks()) track.stop();
      video.srcObject = null;
    };
  }, []);

  // The director's moves, replayed against local state.
  const putDown = useCallback(() => {
    runRef.current = { ...runRef.current, emptyHands: true };
    note("director: put-down shot (pedestal empty, hands on the counter)");
  }, [note]);
  const nextSegment = useCallback(
    (product: Campaign) => {
      setChannel(makeChannel("bumper", product.id));
      note(`next_segment -> bumper, airing ${product.product_name}`);
      // RESET_SETTLE_MS later the old run is reset: the stream goes dark until the new run starts.
      setTimeout(() => {
        if (runRef.current.product?.id !== product.id) {
          runRef.current = { product: null, emptyHands: false };
          note("orbis: reset (stream dark)");
        }
      }, RESET_SETTLE_MS);
    },
    [note],
  );
  const goLive = useCallback(
    (product: Campaign) => {
      runRef.current = { product, emptyHands: false };
      setChannel((current) => ({ ...current, status: "live", airing_campaign_id: product.id }));
      note(`orbis: new run producing frames; live -> ${product.product_name}`);
    },
    [note],
  );
  const offAir = useCallback(() => {
    setChannel(makeChannel("offline", null));
    runRef.current = { product: null, emptyHands: false };
    note("channel offline");
  }, [note]);

  const scenario = useCallback(
    (name: string) => {
      const other = airing?.id === PRODUCT_B.id ? PRODUCT_A : PRODUCT_B;
      const current = airing ?? PRODUCT_A;
      if (name === "freeze" || name === "fade") {
        putDown();
        setTimeout(() => nextSegment(other), 1_200);
        if (name === "fade") setTimeout(() => goLive(other), 1_200 + RESET_SETTLE_MS + 4_000);
      } else if (name === "same") {
        nextSegment(current);
        setTimeout(() => goLive(current), 350);
      } else if (name === "cold") {
        offAir();
        setTimeout(() => setChannel(makeChannel("bumper", other.id)), 800);
        setTimeout(() => goLive(other), 3_000);
      } else if (name === "live") {
        goLive(current);
      }
    },
    [airing, goLive, nextSegment, offAir, putDown],
  );
  const scenarioRef = useRef(scenario);
  scenarioRef.current = scenario;

  // ?auto=<scenario> runs one scenario after the picture is up, for screenshots and Playwright.
  useEffect(() => {
    const auto = new URLSearchParams(window.location.search).get("auto");
    if (!auto) return;
    const timer = setTimeout(() => scenarioRef.current(auto), 1_500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="handoff-lab">
      <header>
        <p className="eyebrow">Lab · dev only</p>
        <h1>Handoff seam cover</h1>
        <p>
          The canvas animation stands in for the Orbis picture. Trigger the director&apos;s channel_state moves
          and watch the held frame, the &ldquo;Up next&rdquo; lower third and the crossfade.
        </p>
      </header>
      <div
        className="player-frame"
        style={{ maxWidth: 1100 }}
        data-seam-covering={seam.covering ? "1" : "0"}
        data-seam-upnext={seam.upNext ? "1" : "0"}
        data-status={channel.status}
      >
        <div className="player-video">
          <video ref={videoRef} muted playsInline autoPlay style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <SeamCover channel={channel} active getVideo={getVideo} onChange={setSeam} />
        <SeamContext.Provider value={seam}>
          <BroadcastOverlay channel={channel} airing={airing} />
        </SeamContext.Provider>
      </div>
      <div className="button-row" style={{ marginTop: 16 }}>
        <button type="button" onClick={() => scenario("freeze")}>
          Switch product (freeze and hold)
        </button>
        <button type="button" onClick={() => scenario("fade")}>
          Switch product (freeze, then live)
        </button>
        <button type="button" onClick={() => scenario("same")}>
          Same product re-airs
        </button>
        <button type="button" onClick={() => scenario("cold")}>
          Off air, then cold start
        </button>
        <button type="button" onClick={() => scenario("live")}>
          Go live now
        </button>
      </div>
      <p className="hint">
        status {channel.status} · airing {airing?.product_name ?? "none"} · covering {String(seam.covering)} · up next{" "}
        {String(seam.upNext)}
      </p>
      <ol className="hint">
        {log.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ol>
    </main>
  );
}

export default function HandoffLabPage() {
  if (process.env.NODE_ENV === "production") {
    return (
      <main>
        <p className="hint">The handoff lab is a development-only harness.</p>
      </main>
    );
  }
  return <Harness />;
}
