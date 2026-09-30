# A.Infomercial

**The shopping channel anyone can buy airtime on.** A live, AI-generated home-shopping TV
channel with open bidding. Advertisers upload a product and bid for airtime. The highest bid
airs next, and [Reactor Orbis](https://docs.reactor.inc) generates the infomercial in real
time. Viewers ask questions in a Twitch-style chat, and the host answers on air from the
advertiser's facts while the video re-stages to show the answer.

Built for the [Visko Orbis Online Challenge](https://www.visko.ai/challenge/orbis-september-2026)
(September 2026).

Live: https://5whyuw3k.insforge.site · `/live` (the channel) · `/console` (advertisers) ·
`/console/insights` (mocked analytics)

## Why it needs a live model

A pre-rendered ad can't answer a question it has never heard. Here the picture is a live
Orbis session that never repeats:

- **Every product is a new chapter.** Its staged studio shot becomes the start frame
  (`set_image` → `set_prompt` → `start`), then scripted scene beats morph every ~9 s.
- **Every viewer question changes the shot.** "Does it taste like regular Coke?" gets a
  spoken, fact-grounded answer and a new scene prompt (a pour over ice), which lands 2-4 s
  later on everyone's screen.
- **The queue is an open auction.** Raising a bid re-orders "Up next" live. Budgets are
  debited per second of airtime at the winning bid.

## How it works

| Piece | What it does |
| - | - |
| `/console` | Upload a photo → **AI draft** (vision model reads the pack: tagline, look, taste, facts, 5 scene beats, jingle prompt; an image model stages the product on the studio set) → edit → bid → submit. Live bid board with +5 raises. |
| `/live` | One shared Orbis session per channel. HTML overlays (item #, price box, fact card, on-air clock, "AI-generated" label, "Coming up next" bumper), realtime chat, viewer count, bid rail. |
| Director | The first viewer's tab holds a 15 s lease and runs the airing loop: pick the top bid, stage it, walk its beats, cue answer shots, bill airtime. If that tab closes, another viewer's tab takes over the same session. |
| Host | `lib/server/host-answer.ts`: picks the best fresh viewer question, answers in ≤ 30 words from the campaign facts only (deflects off-topic, medical and prompt-injection questions), chooses the fact to highlight, and writes the Orbis re-stage prompt. p50 1.8 s. |
| Session | Created server-side (`POST /sessions`), so no browser tab owns it. Tabs attach with bound tokens that cannot create sessions. A reaper ends it 60 s after the last director heartbeat. |
| Backend | [InsForge](https://insforge.dev): Postgres (campaigns, chat, channel state, RLS: public read, server-only writes), Storage (product images), Realtime (`station:main` events, `station:viewers` presence), Sites (Vercel hosting), Model Gateway (OpenRouter). |

Truthful-ads rule: prices, facts and product names are always HTML text from the advertiser's
campaign. The generated video is staging and mood only, and every frame is labelled AI-generated.

## Run it

```bash
cp .env.example .env.local   # REACTOR_API_KEY, NEXT_PUBLIC_INSFORGE_URL, NEXT_PUBLIC_INSFORGE_ANON_KEY,
                             # INSFORGE_API_KEY, OPENROUTER_API_KEY, REAPER_SECRET
npm install
npx -y @insforge/cli db migrations up --all
node --env-file=.env.local scripts/seed-demo.mjs          # Diet Coke demo campaign
node --env-file=.env.local scripts/seed-competitors.mjs   # two fictional rivals
npm run dev
```

Open `/live` and click **Tune in** (WebRTC; needs a network that allows UDP or TURN).
`/lab` keeps the original Orbis starter playground (dev only).

Built on the [Orbis hackathon starter](https://github.com/Visko-Platform/orbis-online-hackathon-starter).
