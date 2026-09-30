"use client";

import {
  ORBIS_MODELS,
  type OrbisModelName,
  type SessionConfig,
  TOKEN_LIMITS,
  type TokenResponse,
} from "@/lib/orbis";

type SessionConfigPanelProps = {
  config: SessionConfig;
  onChange: (next: SessionConfig) => void;
  locked: boolean;
  token: TokenResponse | null;
  sessionId?: string;
};

function formatSeconds(total: number) {
  if (total % 3600 === 0) return `${total / 3600} h`;
  if (total % 60 === 0) return `${total / 60} min`;
  return `${total} s`;
}

export function SessionConfigPanel({
  config,
  onChange,
  locked,
  token,
  sessionId,
}: SessionConfigPanelProps) {
  const update = <K extends keyof SessionConfig>(
    key: K,
    value: SessionConfig[K],
  ) => onChange({ ...config, [key]: value });

  const numberField = (
    key: "maxSessionDurationSeconds" | "tokenTtlSeconds" | "maxSessions" | "maxAttempts",
    label: string,
    hint: string,
  ) => {
    const range = TOKEN_LIMITS[key];
    return (
      <label>
        {label}
        <input
          type="number"
          min={range.min}
          max={range.max}
          step={1}
          value={config[key]}
          onChange={(event) => {
            const parsed = Number.parseInt(event.target.value, 10);
            update(
              key,
              Number.isFinite(parsed)
                ? Math.min(range.max, Math.max(range.min, parsed))
                : range.min,
            );
          }}
        />
        <span className="field-hint">{hint}</span>
      </label>
    );
  };

  const model = ORBIS_MODELS.find((entry) => entry.name === config.model);
  const expiresAt =
    token?.expiresAt !== undefined
      ? new Date(token.expiresAt * 1000).toLocaleTimeString()
      : null;

  return (
    <details className="config-panel" open={!locked}>
      <summary>
        Session &amp; token configuration
        <span className="summary-meta">
          {model?.label} · {formatSeconds(config.maxSessionDurationSeconds)} cap
          {locked ? " · locked while connected" : ""}
        </span>
      </summary>
      <fieldset disabled={locked} className="config-fields">
        <legend>Token (`POST /tokens`, minted server-side)</legend>
        <p className="hint">
          These become the JWT&apos;s <code>authorization_details</code>. The API
          key never leaves the server; only the scoped token reaches the browser.
        </p>
        <div className="two-column">
          <label>
            <span className="label-text">
              Model (<code>resources.models.match</code>)
            </span>
            <select
              value={config.model}
              onChange={(event) =>
                update("model", event.target.value as OrbisModelName)
              }
            >
              {ORBIS_MODELS.map((entry) => (
                <option key={entry.name} value={entry.name}>
                  {entry.label} — {entry.name}
                </option>
              ))}
            </select>
            <span className="field-hint">{model?.note}</span>
          </label>
          {numberField(
            "maxSessionDurationSeconds",
            "Session cap (constraints.max_session_duration_seconds)",
            "300–86400 s (5 min floor, default 30 min). Reactor closes the session at this point regardless of what is playing.",
          )}
        </div>
        <div className="two-column">
          {numberField(
            "tokenTtlSeconds",
            "Token lifetime (expires_after)",
            "60 s–6 h; the server clamps higher values. Check expires_at below.",
          )}
          {numberField(
            "maxSessions",
            "Sessions per token (constraints.max_sessions)",
            "1–500 sessions ever created by this token; closing one does not restore capacity.",
          )}
        </div>
      </fieldset>

      <fieldset disabled={locked} className="config-fields">
        <legend>Connection (`ReactorProvider.connectOptions`)</legend>
        <div className="two-column">
          <label>
            <span className="label-text">
              Join existing session (<code>sessionId</code>)
            </span>
            <input
              type="text"
              placeholder="leave blank to create a new session"
              value={config.joinSessionId}
              onChange={(event) =>
                update("joinSessionId", event.target.value.trim())
              }
            />
            <span className="field-hint">
              Multi-client: attach as a second viewer of a session another
              client started. The token is minted with{" "}
              <code>resources.sessions.bind</code> for this ID.
            </span>
          </label>
          {numberField(
            "maxAttempts",
            "SDP polling attempts (maxAttempts)",
            "How many times the SDK polls for the WebRTC answer before giving up. Default 6.",
          )}
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={config.autoResumeTracks}
            onChange={(event) => update("autoResumeTracks", event.target.checked)}
          />
          <span className="label-text">
            Auto-resume tracks on connect (<code>autoResumeTracks</code>)
          </span>
        </label>
      </fieldset>

      {(token || sessionId) && (
        <aside>
          <strong>Granted by Reactor</strong>
          <code>
            {sessionId ? `session ${sessionId}` : "no session yet"}
            {expiresAt ? ` · token expires ${expiresAt}` : ""}
          </code>
          {token?.authorizationDetails ? (
            <pre className="json">
              {JSON.stringify(token.authorizationDetails, null, 2)}
            </pre>
          ) : null}
        </aside>
      )}
    </details>
  );
}
