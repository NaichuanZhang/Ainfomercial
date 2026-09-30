"use client";

import { useEffect, useRef, useState } from "react";

import { itemNumber } from "@/components/live/broadcast-overlay";
import { Icon } from "@/components/shell/icons";
import type { Campaign, ChatMessage } from "@/lib/station-types";

const NAMES = ["couchshopper", "latenightdeals", "fizzfan", "tvbargains", "remotecontrol", "channel9lover"];

/** Twitch's fifteen default username colors, lifted where the dark theme would swallow them. */
const NAME_COLORS = [
  "#ff4a4a", // red
  "#6f7cff", // blue
  "#00c274", // green
  "#e0553f", // firebrick
  "#ff7f50", // coral
  "#9acd32", // yellow green
  "#ff4500", // orange red
  "#3fbf7f", // sea green
  "#daa520", // goldenrod
  "#d2691e", // chocolate
  "#5f9ea0", // cadet blue
  "#1e90ff", // dodger blue
  "#ff69b4", // hot pink
  "#a970ff", // blue violet
  "#00ff7f", // spring green
];

function nameColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return NAME_COLORS[hash % NAME_COLORS.length];
}

function useHandle() {
  const [handle, setHandle] = useState("");
  useEffect(() => {
    const stored = localStorage.getItem("ainfomercial-handle");
    const value =
      stored || `${NAMES[Math.floor(Math.random() * NAMES.length)]}${Math.floor(Math.random() * 90 + 10)}`;
    setHandle(value);
  }, []);
  const update = (value: string) => {
    setHandle(value);
    localStorage.setItem("ainfomercial-handle", value);
  };
  return [handle, update] as const;
}

export function ChatPanel({
  messages,
  viewers,
  airing,
  live,
}: {
  messages: ChatMessage[];
  viewers: number;
  airing?: Campaign | null;
  live?: boolean;
}) {
  const [handle, setHandle] = useHandle();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: handle, body }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not send");
      setDraft("");
      stick.current = true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSending(false);
    }
  };

  if (collapsed) {
    return (
      <aside className="chat chat-collapsed" aria-label="Live chat (collapsed)">
        <button type="button" className="icon-btn" aria-label="Expand chat" onClick={() => setCollapsed(false)}>
          <Icon.Collapse flipped />
        </button>
        <span className="chat-collapsed-label">Chat</span>
      </aside>
    );
  }

  return (
    <aside className="chat" aria-label="Live chat">
      <header className="chat-head">
        <button type="button" className="icon-btn" aria-label="Collapse chat" onClick={() => setCollapsed(true)}>
          <Icon.Collapse />
        </button>
        <span className="chat-head-title">Stream chat</span>
        <span className="chat-head-viewers" title="Watching now">
          <Icon.People />
          <span>{viewers}</span>
        </span>
      </header>

      {airing && (
        <div className="chat-pinned" role="note">
          {airing.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="chat-pinned-img" src={airing.image_url} alt="" />
          ) : (
            <span className="chat-pinned-icon">
              <Icon.Pin size={16} />
            </span>
          )}
          <span className="chat-pinned-text">
            <span className="chat-pinned-kicker">
              <Icon.Pin size={11} /> {live ? "Now airing" : "Up next"} · Item {itemNumber(airing)}
            </span>
            <span className="chat-pinned-name">
              {airing.product_name}
              <span className="chat-pinned-price">{airing.price ?? `${Number(airing.bid_per_min).toFixed(0)}/min`}</span>
            </span>
          </span>
        </div>
      )}

      <ol
        className="chat-list"
        ref={list}
        onScroll={(event) => {
          const el = event.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        <li className="chat-status">Welcome to the chat room! Ask the host anything about what&apos;s on air.</li>
        {messages
          .filter((message) => !(message.kind === "system" && message.reply_to !== null))
          .map((message) => (
            <li key={message.id} className={`chat-msg ${message.kind}`}>
              {message.kind === "host" && (
                <span className="chat-badge host-badge" title="Host">
                  <Icon.Crown size={12} />
                  Host
                </span>
              )}
              {message.kind === "system" && (
                <span className="chat-badge system-badge" title="Station">
                  <Icon.Tv size={12} />
                </span>
              )}
              <span
                className="chat-author"
                style={message.kind === "viewer" ? { color: nameColor(message.author) } : undefined}
              >
                {message.kind === "system" ? "A.Infomercial" : message.author}
              </span>
              <span className="chat-colon" aria-hidden="true">
                :{" "}
              </span>
              <span className="chat-body">{message.body}</span>
            </li>
          ))}
      </ol>

      <form className="chat-form" onSubmit={send}>
        <div className="chat-input-wrap">
          <label className="sr-only" htmlFor="chat-input">
            Message
          </label>
          <input
            id="chat-input"
            className="chat-input"
            placeholder="Send a message"
            value={draft}
            maxLength={280}
            autoComplete="off"
            onChange={(event) => setDraft(event.target.value)}
          />
          <span className="chat-input-emote" aria-hidden="true">
            <Icon.Smile />
          </span>
        </div>
        <div className="chat-form-row">
          <label className="chat-identity" title="Your chat name">
            <span className="sr-only">Your name</span>
            <Icon.Person size={16} />
            <input
              id="chat-handle"
              className="chat-handle"
              value={handle}
              maxLength={32}
              onChange={(event) => setHandle(event.target.value)}
            />
          </label>
          <span className="chat-points" title="Channel points">
            <Icon.Gem size={18} />
          </span>
          <span className="chat-form-spacer" />
          <button type="button" className="icon-btn" aria-label="Chat settings">
            <Icon.Gear />
          </button>
          <button className="btn primary" type="submit" disabled={sending || !draft.trim()}>
            Chat
          </button>
        </div>
        {error && <p className="chat-error">{error}</p>}
      </form>
    </aside>
  );
}
