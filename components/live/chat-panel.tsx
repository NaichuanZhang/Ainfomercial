"use client";

import { useEffect, useRef, useState } from "react";

import type { ChatMessage } from "@/lib/station-types";

const NAMES = ["couchshopper", "latenightdeals", "fizzfan", "tvbargains", "remotecontrol", "channel9lover"];

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

export function ChatPanel({ messages, viewers }: { messages: ChatMessage[]; viewers: number }) {
  const [handle, setHandle] = useHandle();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
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

  return (
    <aside className="chat" aria-label="Live chat">
      <header className="chat-head">
        <span>Live chat</span>
        <span className="muted">
          <span className="viewer-dot" aria-hidden /> {viewers} watching
        </span>
      </header>
      <ol
        className="chat-list"
        ref={list}
        onScroll={(event) => {
          const el = event.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {messages.length === 0 && <li className="chat-empty">Ask the host anything about what&apos;s on air.</li>}
        {messages.map((message) => (
          <li key={message.id} className={`chat-msg ${message.kind}`}>
            {message.kind === "host" && <span className="host-badge">Host</span>}
            <span className="chat-author">{message.kind === "system" ? "📺" : message.author}</span>{" "}
            <span className="chat-body">{message.body}</span>
          </li>
        ))}
      </ol>
      <form className="chat-form" onSubmit={send}>
        <label className="sr-only" htmlFor="chat-handle">
          Your name
        </label>
        <input
          id="chat-handle"
          className="chat-handle"
          value={handle}
          maxLength={32}
          onChange={(event) => setHandle(event.target.value)}
        />
        <label className="sr-only" htmlFor="chat-input">
          Message
        </label>
        <input
          id="chat-input"
          className="chat-input"
          placeholder="Ask about the product…"
          value={draft}
          maxLength={280}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button className="btn primary" type="submit" disabled={sending || !draft.trim()}>
          Send
        </button>
        {error && <p className="chat-error">{error}</p>}
      </form>
    </aside>
  );
}
