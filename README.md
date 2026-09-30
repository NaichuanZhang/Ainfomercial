# Orbis hackathon starter!

A minimal Next.js example for the public Reactor-hosted Visko Orbis Stable API.
It demonstrates server-side token minting, WebRTC video and audio, text-to-video,
optional image-to-video, live prompt steering, delivery resolution, pause,
resume, and a foldable Nano Banana-to-Orbis livestreaming example.

## Requirements

- Node.js 20.9 or newer
- A Reactor API key with access to Visko Orbis Stable
- A Google Gemini API key with access to Nano Banana

## Run locally

```bash
cp .env.example .env.local
# Add your Reactor API key to .env.local.
npm install
npm run dev
```

Open <http://localhost:3000>.

`npm run dev` starts Next.js through a small session-cleanup wrapper. While in
development, sessions created by this starter are recorded in the gitignored
`.reactor-dev-sessions.json` file. It contains session IDs and metadata, but no
API keys or JWTs. The wrapper uses the server-only `REACTOR_API_KEY` to delete
recorded sessions before startup and again on `Ctrl+C`/`SIGTERM`, so restarting
the dev server cannot silently leave a previous Orbis session consuming
capacity. If a startup sweep cannot delete a recorded session, the wrapper
refuses to start another dev server and reports the session ID.

Set both keys in `.env.local`:

```dotenv
REACTOR_API_KEY=your_reactor_api_key
GEMINI_API_KEY=your_gemini_api_key
```

Keep both keys server-side. The browser receives only the short-lived Reactor
JWT and the image returned by the Nano Banana route.

## Nano Banana kickoff example

Connect to Orbis, expand **Livestreaming example**, and click
**Edit and start stream**. The bundled `dog.png` is displayed as the source
image. The server sends it with the displayed image-editing prompt to
`gemini-2.5-flash-image`. Gemini then analyzes the edited image with the user
prompt and returns a plain-text, image-grounded prompt. The
edited output is previewed, uploaded as the Orbis start image, and used with
that grounded prompt to begin the stream.

The two starting prompts are exported from `lib/nano-banana.ts`.
`NANO_BANANA_PROMPT` controls the image edit, while `ORBIS_KICKOFF_PROMPT`
describes the requested motion. The final Gemini-grounded prompt is displayed
before it is sent to Orbis.

## API flow

1. `POST /api/token` requests a scoped session JWT from
   `https://api.reactor.inc/tokens`.
2. `ReactorProvider` connects to `reactor/visko-orbis-stable` with the
   recv-only `main_video` and `main_audio` tracks.
3. The model sends a `state` snapshot. Its `state.available_resolutions` list
   replaces the starter's initial documented resolution choices.
4. If supplied, the reference image is uploaded and passed to `set_image`
   before `start`.
5. If selected, `set_resolution` stages a delivery tier for the next `start`.
   Omitting it keeps the model's current setting; the documented default is
   `2k`.
6. `set_prompt` supplies the required prompt, then `start` begins generation.
7. Sending another `set_prompt` while running steers the video at the next
   chunk boundary.

## Every API configuration, in the UI

The page exposes the complete published Orbis surface so the whole API can be
exercised without editing code. Anything not covered by a dedicated control is
reachable from the raw command console.

**Session & token panel** (top of the page; locked while connected — these
rebuild the SDK client, so change them between sessions)

| Control | Wire field | Range / notes |
| --- | --- | --- |
| Model | `authorization_details[].resources.models.match`, `ReactorProvider.modelName` | `reactor/visko-orbis-stable` (≤2000 chunks ≈ 61 min) or `reactor/visko-orbis-dynamic` (≤229 chunks ≈ 7 min, adds `native`) |
| Session cap | `constraints.max_session_duration_seconds` | 300–86400 s (route floors at 5 min); Reactor closes the session at this point. Default **1800 s (30 min)**; the upstream starter shipped with 300 s |
| Token lifetime | `expires_after` | 60 s–6 h, server-clamped; the granted `expires_at` is shown after connect |
| Sessions per token | `constraints.max_sessions` | 1–500, counts sessions ever created |
| Join existing session | `connectOptions.sessionId` + `resources.sessions.bind` | multi-client viewing of a session another client started |
| SDP polling attempts | `connectOptions.maxAttempts` | default 6 |
| Auto-resume tracks | `connectOptions.autoResumeTracks` | default on |

The server route (`app/api/token/route.ts`) validates the model against the
allowlist and clamps every number, so the browser can only ask for what the
route permits. The API key never leaves the server.

**Model commands** (right column; every command in the schema)

| Control | Command | When it applies |
| --- | --- | --- |
| Start image | `set_image` | next `start` only; change after `reset` |
| Seed + Apply | `set_seed` | next `start`; blank = model default 42 |
| Resolution + Apply | `set_resolution` | next `start`; survives `reset` |
| Generate sound | `set_audio_enabled` | next `start`; survives `reset` |
| Scene prompt / Start run / Steer | `set_prompt` (+ `passthrough`) | before `start` arms; during a run morphs at the next chunk |
| Sound prompt / Clear | `set_audio_prompt` | live, next chunk; empty string = picture-driven audio |
| Pause / Resume / Reset | `pause` / `resume` / `reset` | lifecycle |
| Save last N seconds | `requestClip` → `downloadClipAsFile` | Recordings API, downloads an MP4 |
| Fit: contain/cover | `ReactorView.videoObjectFit` | client-side only |

**Observability**

- *Session state* renders the full `state` broadcast (`started`, `running`,
  `paused`, `has_prompt`, `has_image`, `current_chunk` with elapsed time,
  `resolution`, `seed`, `audio_enabled`, `audio_prompt`, `available_resolutions`).
- *Current run* renders the `generation_started` payload (`fps`,
  `frames_per_chunk`, `max_chunks`, delivery tier, `image_conditioned`).
- *Raw command console* sends any `sendCommand(name, args)` with a JSON argument
  object, shows the correlated reply, and keeps a log of every command the UI
  issued (with the reply type), so the request/reply contract can be inspected
  end to end.

## Documented model behavior

- A prompt is required before `start`; the reference image is optional.
- A 16:9 reference image works best. Other aspect ratios are resized without
  cropping and may appear distorted.
- The starter initially shows the currently documented `1080p`, `2k`, and `4k`
  tiers. After connection, treat `state.available_resolutions` as authoritative
  and send the selected value exactly as given.
- `set_resolution` applies from the next `start`, not during the active run.
- Orbis emits chunks about every 1.8 seconds. The first chunk emits no frames
  while the upscaler primes; this is expected.
- Commands are asynchronous. Use model events such as `state`,
  `prompt_accepted`, `resolution_accepted`, `generation_started`,
  `chunk_complete`, and `command_error` as the source of truth.
- `pause` takes effect after the current chunk. `resume` continues the same
  generation, and `reset` clears the current prompt and image.

## Project files

- `app/api/token/route.ts` performs the server-side token exchange.
- `app/api/session-cleanup/route.ts` performs best-effort session deletion when
  the browser page exits.
- `app/api/session-registry/route.ts` records verified development sessions for
  startup and shutdown cleanup.
- `scripts/dev-with-session-cleanup.mjs` wraps `next dev` with the development
  cleanup sweeps.
- `app/api/nano-banana/route.ts` performs the server-side image edit.
- `app/api/orbis-prompt/route.ts` creates the image-grounded video prompt.
- `components/orbis-demo.tsx` composes the provider, player, controls, and demo.
- `components/session-config.tsx` renders the token and connect-option panel.
- `components/orbis-player.tsx` renders the streamed video and audio.
- `components/orbis-controls.tsx` renders every model command, the `state`
  readout, and the raw command console.
- `components/nano-banana-example.tsx` owns the kickoff example and source image.
- `hooks/use-orbis-session.ts` contains the reusable Orbis command sequence and
  session state.
- `dog.png` is the Nano Banana source image.
- `lib/orbis.ts` contains the public model configuration and message helpers.
- `lib/orbis-prompt.ts` contains the plain-text Gemini grounding instruction.
- `lib/nano-banana.ts` contains the model and kickoff prompt.
- `.env.example` documents the required environment variables.

For the complete command parameters, message schemas, tracks, and current model
behavior, use the public Reactor documentation:

- [Visko Orbis Stable API](https://www.reactor.inc/models/visko-orbis-stable/api)
- [Visko Orbis Dynamic API](https://www.reactor.inc/models/visko-orbis-dynamic/api)
- [Gemini image generation and editing](https://ai.google.dev/gemini-api/docs/image-generation)
