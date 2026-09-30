import { ORBIS_MODEL } from "@/lib/station-types";

const REACTOR_API_URL = "https://api.reactor.inc";

/** Hard cap on one channel session; a fresh one is created on the next tune-in. */
export const CHANNEL_SESSION_SECONDS = Number(process.env.CHANNEL_SESSION_SECONDS ?? 1800);

export class ReactorError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function apiKey() {
  const key = process.env.REACTOR_API_KEY;
  if (!key) throw new Error("REACTOR_API_KEY is not configured");
  return key;
}

type MintOptions = {
  /** Model the token may open or attach to (default: the Orbis picture). */
  model?: string;
  bindSessionIds?: string[];
  maxSessions: number;
  maxSessionDurationSeconds: number;
  expiresAfterSeconds: number;
};

/** Mint a session-scoped Reactor JWT. The API key never leaves the server. */
export async function mintReactorToken(options: MintOptions) {
  const resources: Record<string, unknown> = { models: { match: [options.model ?? ORBIS_MODEL] } };
  if (options.bindSessionIds?.length) resources.sessions = { bind: options.bindSessionIds };

  const response = await fetch(`${REACTOR_API_URL}/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Reactor-API-Key": apiKey() },
    body: JSON.stringify({
      expires_after: options.expiresAfterSeconds,
      authorization_details: [
        {
          type: "session",
          resources,
          constraints: {
            max_sessions: options.maxSessions,
            max_session_duration_seconds: options.maxSessionDurationSeconds,
          },
        },
      ],
    }),
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) {
    throw new ReactorError(`Reactor token request failed (${response.status}): ${text.slice(0, 300)}`, response.status);
  }
  const result = JSON.parse(text) as { jwt?: string; expires_at?: number };
  if (!result.jwt) throw new ReactorError("Reactor returned no JWT", 502);
  return { jwt: result.jwt, expiresAt: result.expires_at ?? null };
}

/**
 * Token for a browser to attach to a channel session. Binding one session with
 * max_sessions 1 leaves no room to create another, so a leaked token cannot start a session.
 */
export function mintAttachToken(sessionId: string, model: string = ORBIS_MODEL) {
  return mintReactorToken({
    model,
    bindSessionIds: [sessionId],
    maxSessions: 1,
    maxSessionDurationSeconds: 60,
    expiresAfterSeconds: 3600,
  });
}

/**
 * The server creates the channel session, so no browser tab owns it: the SDK ends a session
 * when its creating client unloads, and a director tab closing must not take the broadcast down.
 */
export async function createChannelSession(model: string = ORBIS_MODEL) {
  const { jwt } = await mintReactorToken({
    model,
    maxSessions: 1,
    maxSessionDurationSeconds: CHANNEL_SESSION_SECONDS,
    expiresAfterSeconds: 300,
  });
  const response = await fetch(`${REACTOR_API_URL}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ model: { name: model } }),
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) {
    throw new ReactorError(`Reactor session create failed (${response.status}): ${text.slice(0, 300)}`, response.status);
  }
  const body = JSON.parse(text) as { session_id?: string };
  if (!body.session_id) throw new ReactorError("Reactor returned no session_id", 502);
  return body.session_id;
}

const TERMINAL_STATES = new Set(["CLOSED", "CLOSING", "TERMINATED", "ENDED", "FAILED", "DELETED", "EXPIRED"]);

/** Whether a session can still be attached to. */
export async function isSessionAlive(sessionId: string) {
  const response = await fetch(`${REACTOR_API_URL}/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
    cache: "no-store",
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new ReactorError(`Reactor session lookup failed (${response.status})`, response.status);
  const body = (await response.json()) as { state?: string };
  return !TERMINAL_STATES.has(String(body.state ?? "").toUpperCase());
}

/** Terminate a session (idempotent). Stops credit spend immediately. */
export async function deleteReactorSession(sessionId: string) {
  const response = await fetch(`${REACTOR_API_URL}/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey()}` },
    cache: "no-store",
  });
  return response.ok || response.status === 404;
}
