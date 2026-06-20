# FWC2026 Live Table

An independent, bilingual World Cup 2026 live-table experience. The central idea is simple: every live goal recalculates and animates the provisional group standings immediately, including the effect of simultaneous matches.

Live site: [fwc2026live.com](https://fwc2026live.com/)

## Current status

The first public prototype includes:

- Responsive dark-mode dashboard
- Spanish and English interfaces
- Two simultaneous simulated matches
- Animated provisional standings
- Initial FIFA 2026 group tiebreak logic
- Installable PWA shell and Web Push service worker
- SEO and social metadata foundations

Live sports data is deliberately not connected yet. The UI currently labels all scores as simulated.

### Private API discovery

Create a local `.env` file from `.env.example` and add your API-Football key. The file and all downloaded discovery data are ignored by Git.

```bash
cp .env.example .env
npm run api:discover
```

The command searches the authenticated account for current World Cup/FIFA competitions and writes a private report to `.data/api-football/discovery.json`.

## Development

```bash
npm install
npm run dev
```

Then open `http://localhost:4321`.

```bash
npm test
npm run build
```

## Architecture direction

- Astro + React frontend
- Provider-neutral live-data adapter
- Raspberry Pi ingestion and observability service
- Cloudflare edge cache and public delivery

## Disclaimer

Independent project. Not affiliated with or endorsed by FIFA. Competition names are used descriptively; official logos and protected branding are not included.
