# FWC2026 feed service

Independent API-Football collector. It has no relationship to Abril and imports no code, configuration or credentials from it.

The service:

- polls World Cup 2026 fixtures;
- fetches event details only for active matches;
- uses only Python's standard library;
- exposes a sanitized JSON snapshot on `127.0.0.1:8787`;
- emits structured JSON logs;
- never sends the API key to browsers.
- stores Web Push subscriptions in its own SQLite database;
- sends VAPID-authenticated goal, red-card and match-state alerts;
- supports per-fixture mute preferences.

It is intended to sit behind a dedicated Cloudflare Tunnel hostname such as `feed.fwc2026live.com`.

Create the isolated environment and VAPID keys:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python configure_vapid.py
```
