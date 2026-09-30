export const ORBIS_MODEL_NAME = "reactor/visko-orbis-stable";

/**
 * Every Orbis deployment this app may connect to. Slugs and limits come from
 * docs.reactor.inc/model-api-reference/visko-orbis-{stable,dynamic}/schema.
 */
export const ORBIS_MODELS = [
  {
    name: "reactor/visko-orbis-stable",
    label: "Orbis Stable",
    maxChunks: 2000,
    note: "Up to ~61 min per run. Resolutions 1080p / 2k / 4k.",
  },
  {
    name: "reactor/visko-orbis-dynamic",
    label: "Orbis Dynamic",
    maxChunks: 229,
    note: "Up to ~7 min per run. Adds a native 832×480 delivery tier.",
  },
] as const;

export type OrbisModelName = (typeof ORBIS_MODELS)[number]["name"];

export const ORBIS_MODEL_NAMES = ORBIS_MODELS.map((model) => model.name);

export function isOrbisModelName(value: unknown): value is OrbisModelName {
  return (
    typeof value === "string" &&
    (ORBIS_MODEL_NAMES as readonly string[]).includes(value)
  );
}

export const ORBIS_TRACKS = [
  { name: "main_video", kind: "video", direction: "recvonly" },
  { name: "main_audio", kind: "audio", direction: "recvonly" },
] as const;

export const DOCUMENTED_RESOLUTIONS = ["1080p", "2k", "4k"];

/** 33 frames at 18 fps — the unit every set_* command lands on. */
export const CHUNK_SECONDS = 33 / 18;

/** Every command in the published Orbis schema, for the raw command console. */
export const ORBIS_COMMANDS = [
  "set_prompt",
  "set_audio_prompt",
  "set_image",
  "set_seed",
  "set_resolution",
  "set_audio_enabled",
  "start",
  "pause",
  "resume",
  "reset",
] as const;

export type OrbisCommand = (typeof ORBIS_COMMANDS)[number];

/** Example arguments the console pre-fills when a command is picked. */
export const ORBIS_COMMAND_EXAMPLES: Record<OrbisCommand, string> = {
  set_prompt: JSON.stringify(
    { prompt: "A slow aerial shot over a foggy pine forest at dawn.", passthrough: false },
    null,
    2,
  ),
  set_audio_prompt: JSON.stringify({ prompt: "Wind through pine trees, distant birds." }, null, 2),
  set_image: JSON.stringify({ image: "<FileRef from uploadFile — use the start-image field instead>" }, null, 2),
  set_seed: JSON.stringify({ seed: 42 }, null, 2),
  set_resolution: JSON.stringify({ resolution: "2k" }, null, 2),
  set_audio_enabled: JSON.stringify({ audio_enabled: true }, null, 2),
  start: "{}",
  pause: "{}",
  resume: "{}",
  reset: "{}",
};

/** The `state` broadcast — the authoritative session snapshot per the schema. */
export type OrbisState = {
  started?: boolean;
  running?: boolean;
  paused?: boolean;
  has_image?: boolean;
  has_prompt?: boolean;
  current_chunk?: number;
  available_resolutions?: string[];
  resolution?: string;
  seed?: number;
  audio_prompt?: string | null;
  audio_enabled?: boolean;
};

/** Payload of `generation_started` (both a reply and a broadcast). */
export type OrbisRunInfo = {
  fps?: number;
  width?: number;
  height?: number;
  max_chunks?: number;
  resolution?: string;
  audio_enabled?: boolean;
  frames_per_chunk?: number;
  image_conditioned?: boolean;
};

export type OrbisMessage = OrbisState &
  OrbisRunInfo & {
    type?: string;
    command?: string;
    reason?: string;
    prompt?: string;
    chunk_index?: number;
    frames_emitted?: number;
    audio_samples?: number | null;
    total_chunks?: number;
  };

export function unwrapOrbisMessage(raw: unknown): OrbisMessage {
  const envelope = raw as { type?: string; data?: Record<string, unknown> };
  if (envelope?.data && typeof envelope.data === "object") {
    return { ...envelope.data, type: envelope.type } as OrbisMessage;
  }
  return raw as OrbisMessage;
}

/**
 * Everything that is decided before the WebRTC session exists: what the
 * server-minted JWT allows, and how the SDK connects.
 */
export type SessionConfig = {
  model: OrbisModelName;
  /** `constraints.max_session_duration_seconds` on the token (1–86400). */
  maxSessionDurationSeconds: number;
  /** `expires_after` on the token (seconds, server clamps at 6 h). */
  tokenTtlSeconds: number;
  /** `constraints.max_sessions` on the token (1–500). */
  maxSessions: number;
  /** Join an existing session instead of creating one (`connectOptions.sessionId`). */
  joinSessionId: string;
  /** `connectOptions.autoResumeTracks` — stream tracks as soon as connected. */
  autoResumeTracks: boolean;
  /** `connectOptions.maxAttempts` — SDP polling attempts before giving up. */
  maxAttempts: number;
};

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  model: "reactor/visko-orbis-stable",
  /** 30 min. The upstream starter shipped with 300 s, which cut demos off. */
  maxSessionDurationSeconds: 1800,
  tokenTtlSeconds: 3600,
  maxSessions: 1,
  joinSessionId: "",
  autoResumeTracks: true,
  maxAttempts: 6,
};

export const TOKEN_LIMITS = {
  /** Reactor allows 1–86400; we floor at 5 min so a demo can never be cut short. */
  maxSessionDurationSeconds: { min: 300, max: 86_400 },
  tokenTtlSeconds: { min: 60, max: 21_600 },
  maxSessions: { min: 1, max: 500 },
  maxAttempts: { min: 1, max: 60 },
} as const;

export type TokenRequest = Pick<
  SessionConfig,
  "model" | "maxSessionDurationSeconds" | "tokenTtlSeconds" | "maxSessions"
> & {
  /** Sessions this token must be allowed to act on but did not create. */
  bindSessionIds?: string[];
};

export type TokenResponse = {
  jwt: string;
  expiresAt?: number;
  authorizationDetails?: unknown;
};

export async function requestReactorJwt(
  request: TokenRequest,
): Promise<TokenResponse> {
  const response = await fetch("/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const result = (await response.json()) as Partial<TokenResponse> & {
    error?: string;
  };
  if (!response.ok || !result.jwt) {
    throw new Error(result.error || "Could not create a Reactor token");
  }
  return {
    jwt: result.jwt,
    expiresAt: result.expiresAt,
    authorizationDetails: result.authorizationDetails,
  };
}
