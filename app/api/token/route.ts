import { NextResponse } from "next/server";

import {
  DEFAULT_SESSION_CONFIG,
  isOrbisModelName,
  TOKEN_LIMITS,
  type TokenRequest,
} from "@/lib/orbis";
import { labDisabledResponse } from "@/lib/server/lab-guard";

const REACTOR_API_URL = "https://api.reactor.inc";

function clampInt(
  value: unknown,
  fallback: number,
  range: { min: number; max: number },
) {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(range.max, Math.max(range.min, Math.trunc(parsed)));
}

export async function POST(request: Request) {
  const blocked = labDisabledResponse();
  if (blocked) return blocked;

  const apiKey = process.env.REACTOR_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "REACTOR_API_KEY is not configured" },
      { status: 500 },
    );
  }

  // The body is optional so the original no-body call keeps working.
  const body = (await request.json().catch(() => ({}))) as Partial<TokenRequest>;

  const model = isOrbisModelName(body.model)
    ? body.model
    : DEFAULT_SESSION_CONFIG.model;
  if (body.model !== undefined && body.model !== model) {
    return NextResponse.json(
      { error: `Unsupported model: ${String(body.model)}` },
      { status: 400 },
    );
  }

  const maxSessionDurationSeconds = clampInt(
    body.maxSessionDurationSeconds,
    DEFAULT_SESSION_CONFIG.maxSessionDurationSeconds,
    TOKEN_LIMITS.maxSessionDurationSeconds,
  );
  const expiresAfter = clampInt(
    body.tokenTtlSeconds,
    DEFAULT_SESSION_CONFIG.tokenTtlSeconds,
    TOKEN_LIMITS.tokenTtlSeconds,
  );
  const maxSessions = clampInt(
    body.maxSessions,
    DEFAULT_SESSION_CONFIG.maxSessions,
    TOKEN_LIMITS.maxSessions,
  );
  const bindSessionIds = Array.isArray(body.bindSessionIds)
    ? body.bindSessionIds
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 10)
    : [];

  const resources: Record<string, unknown> = { models: { match: [model] } };
  if (bindSessionIds.length) resources.sessions = { bind: bindSessionIds };

  const response = await fetch(`${REACTOR_API_URL}/tokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Reactor-API-Key": apiKey,
    },
    body: JSON.stringify({
      expires_after: expiresAfter,
      authorization_details: [
        {
          type: "session",
          resources,
          constraints: {
            max_sessions: maxSessions,
            max_session_duration_seconds: maxSessionDurationSeconds,
          },
        },
      ],
    }),
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json(
      { error: `Reactor token request failed (${response.status}): ${text}` },
      { status: response.status },
    );
  }

  const result = JSON.parse(text) as {
    jwt?: string;
    expires_at?: number;
    authorization_details?: unknown;
  };
  if (!result.jwt) {
    return NextResponse.json({ error: "Reactor returned no JWT" }, { status: 502 });
  }

  return NextResponse.json(
    {
      jwt: result.jwt,
      expiresAt: result.expires_at,
      authorizationDetails: result.authorization_details,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
