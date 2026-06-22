# FWC2026 Live

**FWC2026 Live** is an independent, bilingual web app that shows how every
live World Cup 2026 goal changes the tournament in real time.

Instead of waiting for the final whistle, the app treats the current score as
the provisional final result, recalculates all affected group standings,
re-ranks the best third-placed teams and updates the projected round-of-32
bracket — including the impact of simultaneous matches.

Live site: **[fwc2026live.com](https://fwc2026live.com/)**

> Independent project. Not affiliated with or endorsed by FIFA.

## Why it exists

Traditional score apps tell you what the score is. FWC2026 Live focuses on the
more interesting question:

> **If every match ended right now, who would qualify and who would they play?**

The product was designed to make the movement of the tournament visible,
immediate and understandable on desktop and mobile.

## Product features

### Live tournament projection

- Live scores for all World Cup 2026 matches
- All 48 teams and 12 groups
- Animated movement when teams change position
- Current scores treated as provisional final results
- Simultaneous matches calculated as one global tournament state
- Eight best third-placed teams ranked continuously
- Projected round-of-32 bracket
- Contextual landing group: active match first, otherwise the next kickoff

### FIFA 2026 ranking engine

The app calculates standings independently from the provider feed and applies:

- points;
- head-to-head points;
- head-to-head goal difference;
- head-to-head goals scored;
- reapplication of head-to-head criteria to teams that remain tied;
- overall goal difference;
- overall goals scored;
- fair-play score;
- FIFA ranking fallback.

Third-placed teams are compared by points, goal difference, goals scored,
fair play and ranking.

### Interactive simulation

Every group includes a control room where visitors can add or remove goals:

- during active matches, including half-time;
- for the next scheduled matches when no match is live;
- across simultaneous fixtures;
- without changing the underlying live feed.

Simulation changes are applied instantly to groups, best thirds and knockout
projections. Each simulated score can be reset independently.

### Live event marquee

The top marquee displays:

- score, flags and match clock;
- first half, half-time, second half, extra time, penalties and suspension;
- goals, scorers and assists;
- yellow and red cards;
- the latest match events;
- direct navigation to the affected group.

During live matches the public feed updates every 10 seconds and open clients
refresh every 5 seconds. When no match is active, browser polling pauses and
wakes shortly before the next kickoff.

### Web Push notifications

- Opt-in browser notifications using VAPID Web Push
- Goal and red-card alerts
- Half-time, second-half and full-time alerts
- Global notifications toggle
- Per-match mute controls
- Immediate test notification
- Installable PWA support

No Apple Developer membership is required. On iOS/iPadOS, Web Push requires
installing the PWA on the Home Screen.

### Interface and identity

- Responsive, mobile-first dark interface
- Spanish and English
- Local SVG country flags for consistent rendering across platforms
- Custom favicon, Apple touch icon and PWA icons
- Landscape Open Graph/Twitter share card
- Accessible reduced-motion support

### Analytics, privacy and discovery

- Cloudflare Web Analytics
- Google Analytics 4 loaded only after explicit consent
- Reopenable privacy preferences
- Search-engine metadata, canonical URLs and `hreflang`
- `robots.txt` and XML sitemap
- Open Graph and Twitter Card metadata
- Independent-site disclaimer

## Architecture

```text
API-Football Pro
       │
       ▼
Independent Python feed service
Raspberry Pi 4 · systemd user service
       │
       ├── polling and event normalization
       ├── sanitized public JSON
       ├── SQLite Push subscriptions
       ├── VAPID notification delivery
       └── structured operational logs
       │
       ▼
Cloudflare Tunnel
feed.fwc2026live.com
       │
       ▼
Astro + React static frontend
Cloudflare Pages and CDN
fwc2026live.com
```

The browser never receives the API-Football key or VAPID private key.

The feed is a standalone service created exclusively for this project. It has
no code, credentials, imports or operational dependency on the separate Abril
AI platform.

## Technology

- Astro 6
- React 19 and TypeScript
- Motion for animated table transitions
- Python 3 feed service
- API-Football Pro
- SQLite
- Web Push / VAPID
- Cloudflare Pages, CDN, DNS and Tunnel
- Raspberry Pi 4
- Vitest and Python `unittest`

## Repository structure

```text
public/                 Static assets, flags, icons, manifest and social cards
scripts/                Private API discovery and snapshot tools
services/feed/          Independent Raspberry Pi feed and Push service
src/components/         Interactive React dashboard
src/lib/                Tournament engine, data adapters and tests
src/pages/              Spanish and English Astro routes
src/styles/             Responsive interface styles
```

## Local development

Requirements:

- Node.js 22.12 or newer
- Python 3

```bash
npm install
npm run dev
```

Open `http://localhost:4321`.

Validation:

```bash
npm test
npm run check
npm run build
```

## API-Football tools

Copy the example environment file and add the key locally:

```bash
cp .env.example .env
```

Never commit `.env`. It is ignored by Git.

Discover available competitions:

```bash
npm run api:discover
```

Download a private World Cup snapshot:

```bash
npm run api:sync
```

Downloaded API responses are stored under `.data/`, which is also ignored.

## Feed service

The operational service lives in [`services/feed`](services/feed/README.md).
It runs in its own directory, Python virtual environment, systemd user service,
SQLite database and environment file.

Its public endpoints expose only sanitized tournament data and Push operations.
Secrets remain on the Raspberry Pi.

## Hosting and cost profile

- Frontend hosting and CDN: Cloudflare Pages
- DNS, TLS and public tunnel: Cloudflare
- Feed compute and logs: existing Raspberry Pi
- Live sports data: API-Football Pro
- Domain: `fwc2026live.com`

The architecture keeps recurring infrastructure costs low while allowing the
public site to scale through Cloudflare rather than sending visitors directly
to the Raspberry Pi.

## Security and privacy

- No secrets in the public repository or frontend bundle
- API key stored only in the private feed environment
- VAPID private key stored only on the feed server
- Push subscriptions stored in a dedicated SQLite database
- CORS-limited public API surface
- Security headers served by Cloudflare Pages
- GA4 disabled until the visitor provides consent
- No complete visitor IP addresses stored by application code

## Brand and licensing

- Site identity and football artwork were created for this project
- Country flags are provided by
  [flag-icons](https://github.com/lipis/flag-icons) under the MIT License
- Third-party notices are documented in
  [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)
- Official FIFA logos and protected visual branding are not used

## Disclaimer

FWC2026 Live is an independent project and is not affiliated with, endorsed by
or sponsored by FIFA. Competition and team names are used descriptively.
