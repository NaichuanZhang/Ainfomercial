"use client";

import { useMemo, useRef, useState } from "react";

import type { Campaign, CampaignFact } from "@/lib/station-types";

type DraftForm = {
  brand: string;
  product_name: string;
  tagline: string;
  look: string;
  taste: string;
  price: string;
  compare_at_price: string;
  facts: CampaignFact[];
  beats: string[];
  audio_prompt: string;
  image_url: string | null;
  image_key: string | null;
  staged_image_url: string | null;
  staged_image_key: string | null;
  bid_per_min: number;
  budget: number;
};

const EMPTY: DraftForm = {
  brand: "",
  product_name: "",
  tagline: "",
  look: "",
  taste: "",
  price: "",
  compare_at_price: "",
  facts: [],
  beats: [],
  audio_prompt: "",
  image_url: null,
  image_key: null,
  staged_image_url: null,
  staged_image_key: null,
  bid_per_min: 30,
  budget: 1000,
};

type Phase = "idle" | "drafting" | "ready" | "submitting" | "done";

export function CampaignForm({
  queue,
  airing,
  onSubmitted,
}: {
  queue: Campaign[];
  airing: Campaign | null;
  onSubmitted?: (campaign: Campaign) => void;
}) {
  const [form, setForm] = useState<DraftForm>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitted, setSubmitted] = useState<Campaign | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const set = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const rank = useMemo(() => {
    const ahead = queue.filter((c) => c.id !== submitted?.id && Number(c.bid_per_min) >= form.bid_per_min).length;
    return ahead + 1;
  }, [form.bid_per_min, queue, submitted?.id]);
  const topBid = queue[0] ? Number(queue[0].bid_per_min) : 0;

  const pick = (next: File | null) => {
    if (!next) return;
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setError("");
  };

  const draft = async () => {
    if (!file) {
      setError("Add a product photo first.");
      return;
    }
    setPhase("drafting");
    setError("");
    setNotice("");
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
    try {
      const body = new FormData();
      body.append("image", file);
      body.append("notes", notes);
      if (form.brand) body.append("brand", form.brand);
      if (form.product_name) body.append("product_name", form.product_name);
      const response = await fetch("/api/campaigns/draft", { method: "POST", body });
      const result = (await response.json().catch(() => ({}))) as {
        draft?: Partial<DraftForm>;
        error?: string;
        stagingError?: string | null;
      };
      if (!response.ok || !result.draft) throw new Error(result.error ?? "Draft failed");
      setForm((current) => ({ ...current, ...result.draft, compare_at_price: current.compare_at_price }));
      if (result.stagingError) setNotice("Studio shot could not be staged; the original photo will be used.");
      setPhase("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setPhase("idle");
    } finally {
      clearInterval(timer);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPhase("submitting");
    setError("");
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json().catch(() => ({}))) as { campaign?: Campaign; error?: string };
      if (!response.ok || !result.campaign) throw new Error(result.error ?? "Could not submit");
      setSubmitted(result.campaign);
      onSubmitted?.(result.campaign);
      setPhase("done");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setPhase("ready");
    }
  };

  if (phase === "done" && submitted) {
    const position = queue.findIndex((c) => c.id === submitted.id);
    return (
      <section className="card form-card done-card">
        <p className="eyebrow">You&apos;re in the queue</p>
        <h2>{submitted.product_name}</h2>
        <p className="queue-pos">
          {airing?.id === submitted.id
            ? "On air right now"
            : position >= 0
              ? `#${position + 1} in line at ${Number(submitted.bid_per_min).toFixed(0)} credits/min`
              : "Joining the queue…"}
        </p>
        <div className="row-actions">
          <a className="btn primary" href="/live">
            Watch it air
          </a>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setForm(EMPTY);
              setFile(null);
              setPreview(null);
              setNotes("");
              setSubmitted(null);
              setPhase("idle");
            }}
          >
            New campaign
          </button>
        </div>
      </section>
    );
  }

  const busy = phase === "drafting" || phase === "submitting";
  const drafted = phase === "ready" || phase === "submitting";

  return (
    <form className="card form-card" onSubmit={submit}>
      <div className="form-head">
        <p className="eyebrow">New campaign</p>
        <h2>Put your product on air</h2>
      </div>

      <div className="upload-row">
        <button
          type="button"
          className={preview ? "dropzone has-image" : "dropzone"}
          onClick={() => input.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            pick(event.dataTransfer.files?.[0] ?? null);
          }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Product preview" />
          ) : (
            <span>
              <strong>Drop a product photo</strong>
              <br />
              PNG, JPEG or WebP · up to 8 MB
            </span>
          )}
        </button>
        <input
          ref={input}
          className="sr-only"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => pick(event.target.files?.[0] ?? null)}
          aria-label="Product photo"
        />
        <div className="upload-side">
          <label>
            <span>Notes for the AI producer (optional)</span>
            <textarea
              rows={3}
              maxLength={600}
              value={notes}
              placeholder="e.g. 12 fl oz can, sold as a 12-pack, zero calories"
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <button type="button" className="btn primary" onClick={draft} disabled={!file || busy}>
            {phase === "drafting" ? `Producing your spot… ${elapsed}s` : drafted ? "Redo AI draft" : "✨ AI draft"}
          </button>
          {phase === "drafting" && (
            <ol className="draft-steps">
              <li className={elapsed >= 0 ? "on" : ""}>Reading the packaging</li>
              <li className={elapsed >= 4 ? "on" : ""}>Writing the pitch and scene beats</li>
              <li className={elapsed >= 8 ? "on" : ""}>Staging the studio shot</li>
            </ol>
          )}
        </div>
      </div>

      {form.staged_image_url && (
        <div className="staged">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={form.staged_image_url} alt="Staged studio start frame" />
          <span>Studio start frame for the live video</span>
        </div>
      )}

      <fieldset className="grid-2" disabled={busy}>
        <label>
          <span>Brand</span>
          <input value={form.brand} maxLength={60} onChange={(e) => set("brand", e.target.value)} required />
        </label>
        <label>
          <span>Product name</span>
          <input
            value={form.product_name}
            maxLength={80}
            onChange={(e) => set("product_name", e.target.value)}
            required
          />
        </label>
        <label className="span-2">
          <span>Tagline</span>
          <input value={form.tagline} maxLength={140} onChange={(e) => set("tagline", e.target.value)} />
        </label>
        <label>
          <span>On-air price</span>
          <input value={form.price} maxLength={24} placeholder="$8.99 / 12-pack" onChange={(e) => set("price", e.target.value)} />
        </label>
        <label>
          <span>Compare-at price</span>
          <input
            value={form.compare_at_price}
            maxLength={24}
            placeholder="$10.99"
            onChange={(e) => set("compare_at_price", e.target.value)}
          />
        </label>
        <label className="span-2">
          <span>How it looks</span>
          <textarea rows={2} maxLength={400} value={form.look} onChange={(e) => set("look", e.target.value)} />
        </label>
        <label className="span-2">
          <span>How it tastes / feels</span>
          <textarea rows={2} maxLength={400} value={form.taste} onChange={(e) => set("taste", e.target.value)} />
        </label>
      </fieldset>

      <fieldset className="facts" disabled={busy}>
        <legend>
          Facts <span className="muted">(shown as on-screen text; the host only answers from these)</span>
        </legend>
        {form.facts.map((fact, index) => (
          <div className="fact-row" key={index}>
            <input
              aria-label="Fact label"
              value={fact.label}
              maxLength={40}
              placeholder="Calories"
              onChange={(e) => set("facts", form.facts.map((f, i) => (i === index ? { ...f, label: e.target.value } : f)))}
            />
            <input
              aria-label="Fact value"
              value={fact.value}
              maxLength={80}
              placeholder="0"
              onChange={(e) => set("facts", form.facts.map((f, i) => (i === index ? { ...f, value: e.target.value } : f)))}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label="Remove fact"
              onClick={() => set("facts", form.facts.filter((_, i) => i !== index))}
            >
              ×
            </button>
          </div>
        ))}
        {form.facts.length < 12 && (
          <button type="button" className="btn small" onClick={() => set("facts", [...form.facts, { label: "", value: "" }])}>
            + Add fact
          </button>
        )}
      </fieldset>

      <fieldset className="beats" disabled={busy}>
        <legend>
          Scene beats <span className="muted">(the live video walks through these)</span>
        </legend>
        {form.beats.map((beat, index) => (
          <div className="beat-row" key={index}>
            <span className="rank">{index + 1}</span>
            <textarea
              rows={2}
              maxLength={400}
              value={beat}
              aria-label={`Scene beat ${index + 1}`}
              onChange={(e) => set("beats", form.beats.map((b, i) => (i === index ? e.target.value : b)))}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label="Remove beat"
              onClick={() => set("beats", form.beats.filter((_, i) => i !== index))}
            >
              ×
            </button>
          </div>
        ))}
        {form.beats.length < 8 && (
          <button type="button" className="btn small" onClick={() => set("beats", [...form.beats, ""])}>
            + Add beat
          </button>
        )}
      </fieldset>

      <fieldset className="bid-box" disabled={busy}>
        <legend>Your bid</legend>
        <div className="bid-controls">
          <input
            type="range"
            min={1}
            max={200}
            value={form.bid_per_min}
            aria-label="Bid in credits per minute"
            onChange={(e) => set("bid_per_min", Number(e.target.value))}
          />
          <label className="bid-number">
            <input
              type="number"
              min={1}
              max={1000}
              value={form.bid_per_min}
              onChange={(e) => set("bid_per_min", Math.max(1, Number(e.target.value) || 1))}
            />
            <span>credits / min</span>
          </label>
        </div>
        <p className={rank === 1 ? "rank-hint top" : "rank-hint"}>
          {rank === 1
            ? "▲ You'd air next"
            : `You'd be #${rank} in line. Bid ${Math.ceil(topBid + 1)} to air next.`}
        </p>
        <label className="budget">
          <span>Total budget (credits)</span>
          <input
            type="number"
            min={10}
            max={100000}
            value={form.budget}
            onChange={(e) => set("budget", Math.max(10, Number(e.target.value) || 10))}
          />
          <span className="muted">≈ {Math.round((form.budget / form.bid_per_min) * 10) / 10} min of airtime</span>
        </label>
      </fieldset>

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="chat-error">{error}</p>}
      <button className="btn primary big submit" type="submit" disabled={!drafted || busy || !form.beats.length}>
        {phase === "submitting" ? "Submitting…" : "Place bid & go live"}
      </button>
    </form>
  );
}
