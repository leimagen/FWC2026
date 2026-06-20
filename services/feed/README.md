# FWC2026 feed service

Independent API-Football collector. It has no relationship to Abril and imports no code, configuration or credentials from it.

The service:

- polls World Cup 2026 fixtures;
- fetches event details only for active matches;
- uses only Python's standard library;
- exposes a sanitized JSON snapshot on `127.0.0.1:8787`;
- emits structured JSON logs;
- never sends the API key to browsers.

It is intended to sit behind a dedicated Cloudflare Tunnel hostname such as `feed.fwc2026live.com`.
