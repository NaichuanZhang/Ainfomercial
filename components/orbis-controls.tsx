"use client";

import { FormEvent, useState } from "react";

import type { OrbisSession } from "@/hooks/use-orbis-session";
import {
  CHUNK_SECONDS,
  ORBIS_COMMAND_EXAMPLES,
  ORBIS_COMMANDS,
  type OrbisCommand,
} from "@/lib/orbis";

export function OrbisControls({ session }: { session: OrbisSession }) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void session.startRun();
  };

  const idle = !session.connected || session.controlsBusy;
  const beforeRun = idle || session.runStarted;
  const duringRun = idle || !session.runStarted;

  return (
    <form className="controls" onSubmit={submit}>
      <div className="button-row">
        {!session.connected ? (
          <button
            type="button"
            disabled={session.controlsBusy}
            onClick={session.connectSession}
          >
            Connect
          </button>
        ) : (
          <button
            type="button"
            disabled={session.controlsBusy}
            onClick={session.disconnectSession}
          >
            Disconnect
          </button>
        )}
        <button type="button" onClick={session.toggleMuted}>
          {session.muted ? "Enable sound" : "Mute"}
        </button>
        <button type="button" onClick={session.toggleObjectFit}>
          Fit: {session.objectFit}
        </button>
      </div>

      <fieldset disabled={beforeRun}>
        <legend>Next run setup — read when `start` fires</legend>
        <p className="hint">
          Image and seed are fixed for the run (change them after `reset`).
          Resolution and audio survive `reset`; prompt and image do not.
        </p>
        <div className="two-column">
          <label>
            <span className="label-text">
              Start image — <code>set_image</code> (16:9, optional)
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) =>
                session.selectImage(event.target.files?.[0] || null)
              }
            />
          </label>
          <label>
            <span className="label-text">
              Seed — <code>set_seed</code>
            </span>
            <span className="inline-field">
              <input
                type="number"
                min={0}
                step={1}
                placeholder="model default (42)"
                value={session.seed}
                onChange={(event) => session.setSeed(event.target.value)}
              />
              <button
                type="button"
                className="ghost"
                disabled={beforeRun || !session.seed.trim()}
                onClick={session.applySeed}
              >
                Apply
              </button>
            </span>
          </label>
        </div>
        <div className="two-column">
          <label>
            <span className="label-text">
              Resolution — <code>set_resolution</code>
            </span>
            <span className="inline-field">
              <select
                value={session.resolution}
                onChange={(event) => session.setResolution(event.target.value)}
              >
                <option value="">Model setting (2k default)</option>
                {session.availableResolutions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="ghost"
                disabled={beforeRun || !session.resolution}
                onClick={session.applyResolution}
              >
                Apply
              </button>
            </span>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={session.audioEnabled}
              onChange={(event) =>
                void session.applyAudioEnabled(event.target.checked)
              }
            />
            <span className="label-text">
              Generate sound — <code>set_audio_enabled</code>
            </span>
          </label>
        </div>
        <p className="selected-image">
          Orbis start image: {session.image?.name || "none (text-to-video)"}
          {session.imageStatus ? ` · ${session.imageStatus}` : ""}
        </p>
      </fieldset>

      <label>
        <span className="label-text">
          Scene prompt — <code>set_prompt</code>
        </span>
        <textarea
          value={session.prompt}
          placeholder="Enter prompt here"
          onChange={(event) => session.setPrompt(event.target.value)}
        />
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={session.passthrough}
          onChange={(event) => session.setPassthrough(event.target.checked)}
        />
        Passthrough — send text verbatim, skip server-side prompt preparation
      </label>

      <div className="button-row">
        <button type="submit" disabled={beforeRun}>
          Start run
        </button>
        <button type="button" disabled={duringRun} onClick={session.steer}>
          Steer current run
        </button>
      </div>

      <fieldset disabled={idle}>
        <legend>Sound — `set_audio_prompt` (live: next chunk)</legend>
        <textarea
          className="short"
          value={session.audioPrompt}
          placeholder="Empty = sound generated from the picture alone (default, measured best)"
          onChange={(event) => session.setAudioPrompt(event.target.value)}
        />
        <div className="button-row secondary">
          <button
            type="button"
            disabled={idle || !session.audioPrompt.trim()}
            onClick={session.applyAudioPrompt}
          >
            Apply sound prompt
          </button>
          <button type="button" disabled={idle} onClick={session.clearAudioPrompt}>
            Clear (picture-driven)
          </button>
        </div>
      </fieldset>

      <div className="button-row secondary">
        <button
          type="button"
          disabled={duringRun || session.paused}
          onClick={session.pause}
        >
          Pause
        </button>
        <button
          type="button"
          disabled={duringRun || !session.paused}
          onClick={session.resume}
        >
          Resume
        </button>
        <button type="button" disabled={idle} onClick={session.reset}>
          Reset
        </button>
      </div>

      <fieldset disabled={duringRun}>
        <legend>Recording — `requestClip` → MP4</legend>
        <div className="inline-field">
          <input
            type="number"
            min={1}
            max={300}
            step={1}
            value={session.clipSeconds}
            onChange={(event) =>
              session.setClipSeconds(Number(event.target.value) || 1)
            }
          />
          <button type="button" className="ghost" onClick={session.saveClip}>
            Save last N seconds
          </button>
        </div>
        {session.clipStatus && <p className="hint tight">{session.clipStatus}</p>}
      </fieldset>

      {session.error && <p className="error">{session.error}</p>}

      <StateReadout session={session} />
      <RawCommandConsole session={session} />
    </form>
  );
}

function StateReadout({ session }: { session: OrbisSession }) {
  const state = session.orbisState;
  const run = session.runInfo;
  const chunk = state?.current_chunk ?? session.lastChunk?.chunk_index;
  const maxChunks = run?.max_chunks;
  const elapsed =
    chunk !== undefined ? `${(chunk * CHUNK_SECONDS).toFixed(0)}s` : "—";
  const limit =
    maxChunks !== undefined
      ? ` / ${maxChunks} (${Math.round((maxChunks * CHUNK_SECONDS) / 60)} min)`
      : "";

  const rows: Array<[string, string]> = state
    ? [
        ["started / running / paused", `${state.started} / ${state.running} / ${state.paused}`],
        ["has_prompt / has_image", `${state.has_prompt} / ${state.has_image}`],
        ["current_chunk", `${chunk ?? "—"}${limit} · ${elapsed}`],
        ["resolution (next start)", state.resolution ?? "—"],
        ["seed (next start)", state.seed !== undefined ? String(state.seed) : "—"],
        ["audio_enabled", String(state.audio_enabled)],
        ["audio_prompt", state.audio_prompt ?? "null (picture-driven)"],
        [
          "available_resolutions",
          state.available_resolutions?.join(", ") ?? "—",
        ],
      ]
    : [];

  const runRows: Array<[string, string]> = run
    ? [
        ["fps / frames_per_chunk", `${run.fps ?? "—"} / ${run.frames_per_chunk ?? "—"}`],
        ["delivery", `${run.resolution ?? "—"}${run.width && run.height ? ` (gen ${run.width}×${run.height})` : ""}`],
        ["image_conditioned", String(run.image_conditioned)],
        ["audio_enabled (this run)", String(run.audio_enabled)],
      ]
    : [];

  return (
    <aside>
      <strong>Session state — `state` broadcast</strong>
      {rows.length ? (
        <table className="state-table">
          <tbody>
            {rows.map(([key, value]) => (
              <tr key={key}>
                <th scope="row">{key}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <code>No state yet — connect to receive the first snapshot</code>
      )}
      {runRows.length ? (
        <>
          <strong>Current run — `generation_started`</strong>
          <table className="state-table">
            <tbody>
              {runRows.map(([key, value]) => (
                <tr key={key}>
                  <th scope="row">{key}</th>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
      <strong>Recent model events</strong>
      <code>
        {session.events.length ? session.events.join(" · ") : "No events yet"}
      </code>
    </aside>
  );
}

function RawCommandConsole({ session }: { session: OrbisSession }) {
  const [command, setCommand] = useState<string>("set_prompt");
  const [args, setArgs] = useState<string>(ORBIS_COMMAND_EXAMPLES.set_prompt);
  const [reply, setReply] = useState<unknown>(null);

  const pick = (value: string) => {
    setCommand(value);
    if ((ORBIS_COMMANDS as readonly string[]).includes(value)) {
      setArgs(ORBIS_COMMAND_EXAMPLES[value as OrbisCommand]);
    }
  };

  const send = async () => {
    const result = await session.sendRawCommand(command, args);
    setReply(result);
  };

  return (
    <details className="console">
      <summary>Raw command console — any `sendCommand(name, args)`</summary>
      <div className="console-body">
        <div className="two-column">
          <label>
            Command
            <input
              type="text"
              list="orbis-commands"
              value={command}
              onChange={(event) => pick(event.target.value)}
            />
            <datalist id="orbis-commands">
              {ORBIS_COMMANDS.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <div className="button-row align-end">
            <button
              type="button"
              disabled={!session.connected || session.controlsBusy}
              onClick={() => void send()}
            >
              Send
            </button>
          </div>
        </div>
        <label>
          Arguments (JSON object)
          <textarea
            className="mono short"
            value={args}
            onChange={(event) => setArgs(event.target.value)}
          />
        </label>
        <strong className="console-heading">Correlated reply</strong>
        <pre className="json">
          {reply === null ? "—" : JSON.stringify(reply, null, 2)}
        </pre>
        <strong className="console-heading">
          Command log (newest first, includes UI-issued commands)
        </strong>
        <pre className="json log">
          {session.commandLog.length
            ? session.commandLog
                .map((entry) => {
                  const replyType =
                    entry.reply && typeof entry.reply === "object"
                      ? String((entry.reply as { type?: string }).type ?? "reply")
                      : "no reply";
                  return `${entry.at.slice(11, 19)} ${entry.command} ${JSON.stringify(
                    entry.args,
                  )} → ${replyType}`;
                })
                .join("\n")
            : "—"}
        </pre>
      </div>
    </details>
  );
}
