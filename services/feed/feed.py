#!/usr/bin/env python3
"""Independent World Cup 2026 feed service using only Python's standard library."""

from __future__ import annotations

import json
import logging
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

API_BASE = "https://v3.football.api-sports.io"
LIVE_STATES = {"1H", "HT", "2H", "ET", "BT", "P", "INT", "SUSP"}

logging.basicConfig(level=logging.INFO, format="%(message)s")
state: dict[str, Any] = {"snapshot": None, "last_error": None}
state_lock = threading.Lock()


def api_get(path: str, params: dict[str, Any]) -> tuple[list[dict[str, Any]], int | None]:
    query = urllib.parse.urlencode(params)
    request = urllib.request.Request(
        f"{API_BASE}{path}?{query}",
        headers={"x-apisports-key": os.environ["API_FOOTBALL_KEY"]},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.load(response)
        if payload.get("errors"):
            raise RuntimeError(f"API-Football: {payload['errors']}")
        remaining = response.headers.get("x-ratelimit-requests-remaining")
        return payload["response"], int(remaining) if remaining else None


def normalize_event(event: dict[str, Any]) -> dict[str, Any]:
    return {
        "minute": event["time"].get("elapsed"),
        "addedTime": event["time"].get("extra"),
        "teamId": event["team"].get("id"),
        "player": (event.get("player") or {}).get("name"),
        "assist": (event.get("assist") or {}).get("name"),
        "type": event.get("type"),
        "detail": event.get("detail"),
        "comments": event.get("comments"),
    }


def normalize_fixture(item: dict[str, Any], events: list[dict[str, Any]]) -> dict[str, Any]:
    fixture = item["fixture"]
    return {
        "id": fixture["id"],
        "kickoff": fixture["date"],
        "round": item["league"]["round"],
        "status": fixture["status"]["short"],
        "statusLabel": fixture["status"]["long"],
        "elapsed": fixture["status"].get("elapsed"),
        "addedTime": fixture["status"].get("extra"),
        "venue": (fixture.get("venue") or {}).get("name"),
        "city": (fixture.get("venue") or {}).get("city"),
        "home": {
            "id": item["teams"]["home"]["id"],
            "name": item["teams"]["home"]["name"],
            "logo": item["teams"]["home"]["logo"],
            "goals": item["goals"]["home"] or 0,
        },
        "away": {
            "id": item["teams"]["away"]["id"],
            "name": item["teams"]["away"]["name"],
            "logo": item["teams"]["away"]["logo"],
            "goals": item["goals"]["away"] or 0,
        },
        "events": [normalize_event(event) for event in events],
    }


def refresh() -> None:
    try:
        fixtures, remaining = api_get("/fixtures", {"league": 1, "season": 2026})
        events: dict[int, list[dict[str, Any]]] = {}
        for item in fixtures:
            if item["fixture"]["status"]["short"] in LIVE_STATES:
                fixture_id = item["fixture"]["id"]
                events[fixture_id], _ = api_get("/fixtures/events", {"fixture": fixture_id})
        snapshot = {
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "remainingRequests": remaining,
            "fixtures": [
                normalize_fixture(item, events.get(item["fixture"]["id"], []))
                for item in fixtures
            ],
        }
        with state_lock:
            state["snapshot"] = snapshot
            state["last_error"] = None
        logging.info(json.dumps({
            "level": "info",
            "event": "snapshot_refreshed",
            "at": snapshot["generatedAt"],
            "fixtures": len(fixtures),
            "live": len(events),
            "remainingRequests": remaining,
        }))
    except Exception as error:  # noqa: BLE001 - service must retain its last good snapshot
        with state_lock:
            state["last_error"] = str(error)
        logging.error(json.dumps({
            "level": "error",
            "event": "snapshot_failed",
            "error": str(error),
        }))


def poll_forever() -> None:
    interval = int(os.getenv("POLL_SECONDS", "60"))
    while True:
        refresh()
        time.sleep(interval)


class Handler(BaseHTTPRequestHandler):
    def send_json(self, status: int, body: dict[str, Any]) -> None:
        encoded = json.dumps(body, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Access-Control-Allow-Origin", os.getenv(
            "ALLOWED_ORIGIN", "https://fwc2026live.com"
        ))
        self.send_header("Cache-Control", "public, max-age=15, stale-while-revalidate=45")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        with state_lock:
            snapshot = state["snapshot"]
            last_error = state["last_error"]
        if self.path == "/health":
            self.send_json(200 if snapshot else 503, {
                "ok": bool(snapshot),
                "generatedAt": snapshot["generatedAt"] if snapshot else None,
                "lastError": last_error,
            })
        elif self.path == "/v1/world-cup":
            self.send_json(200, snapshot) if snapshot else self.send_json(
                503, {"error": "snapshot_not_ready", "lastError": last_error}
            )
        else:
            self.send_json(404, {"error": "not_found"})

    def log_message(self, _format: str, *args: Any) -> None:
        return


if __name__ == "__main__":
    threading.Thread(target=poll_forever, daemon=True).start()
    port = int(os.getenv("PORT", "8787"))
    logging.info(json.dumps({"level": "info", "event": "server_started", "port": port}))
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
