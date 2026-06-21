#!/usr/bin/env python3
"""Independent World Cup 2026 feed service using only Python's standard library."""

from __future__ import annotations

import json
import logging
import os
import sqlite3
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
db_lock = threading.Lock()


def database() -> sqlite3.Connection:
    connection = sqlite3.connect(
        os.getenv("SUBSCRIPTIONS_DB", "/home/luiti/fwc2026-feed/subscriptions.sqlite3")
    )
    connection.execute(
        """CREATE TABLE IF NOT EXISTS subscriptions (
            endpoint TEXT PRIMARY KEY,
            subscription TEXT NOT NULL,
            language TEXT NOT NULL DEFAULT 'es',
            muted_fixtures TEXT NOT NULL DEFAULT '[]',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )"""
    )
    connection.commit()
    return connection


def save_subscription(subscription: dict[str, Any], language: str) -> None:
    endpoint = subscription["endpoint"]
    now = int(time.time())
    with db_lock, database() as connection:
        connection.execute(
            """INSERT INTO subscriptions
               (endpoint, subscription, language, muted_fixtures, created_at, updated_at)
               VALUES (?, ?, ?, '[]', ?, ?)
               ON CONFLICT(endpoint) DO UPDATE SET
                 subscription=excluded.subscription,
                 language=excluded.language,
                 updated_at=excluded.updated_at""",
            (endpoint, json.dumps(subscription), language, now, now),
        )
        connection.commit()


def save_preferences(endpoint: str, muted_fixtures: list[int]) -> None:
    with db_lock, database() as connection:
        connection.execute(
            "UPDATE subscriptions SET muted_fixtures=?, updated_at=? WHERE endpoint=?",
            (json.dumps(muted_fixtures), int(time.time()), endpoint),
        )
        connection.commit()


def subscriptions() -> list[dict[str, Any]]:
    with db_lock, database() as connection:
        rows = connection.execute(
            "SELECT endpoint, subscription, language, muted_fixtures FROM subscriptions"
        ).fetchall()
    return [{
        "endpoint": row[0],
        "subscription": json.loads(row[1]),
        "language": row[2],
        "muted": set(json.loads(row[3])),
    } for row in rows]


def remove_subscription(endpoint: str) -> None:
    with db_lock, database() as connection:
        connection.execute("DELETE FROM subscriptions WHERE endpoint=?", (endpoint,))
        connection.commit()


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


def event_key(event: dict[str, Any]) -> str:
    return json.dumps([
        event.get("minute"), event.get("addedTime"), event.get("teamId"),
        event.get("player"), event.get("type"), event.get("detail"),
    ], separators=(",", ":"))


def notification_events(
    previous: dict[str, Any] | None,
    current: dict[str, Any],
) -> list[dict[str, Any]]:
    if not previous:
        return []
    old_fixtures = {fixture["id"]: fixture for fixture in previous["fixtures"]}
    notifications: list[dict[str, Any]] = []
    for fixture in current["fixtures"]:
        old = old_fixtures.get(fixture["id"])
        if not old:
            continue
        old_events = {event_key(event) for event in old["events"]}
        for event in fixture["events"]:
            if event_key(event) in old_events:
                continue
            if event["type"] == "Goal":
                notifications.append({"kind": "goal", "fixture": fixture, "event": event})
            elif event["type"] == "Card" and "Red" in (event["detail"] or ""):
                notifications.append({"kind": "red-card", "fixture": fixture, "event": event})
        if fixture["status"] != old["status"]:
            if fixture["status"] == "1H" and old["status"] in {"NS", "TBD"}:
                notifications.append({"kind": "started", "fixture": fixture})
            elif fixture["status"] == "HT":
                notifications.append({"kind": "halftime", "fixture": fixture})
            elif fixture["status"] == "2H":
                notifications.append({"kind": "second-half", "fixture": fixture})
            elif fixture["status"] in {"FT", "AET", "PEN"}:
                notifications.append({"kind": "finished", "fixture": fixture})
    return notifications


def localized_push(item: dict[str, Any], language: str) -> dict[str, Any]:
    fixture = item["fixture"]
    score = f'{fixture["home"]["goals"]}–{fixture["away"]["goals"]}'
    teams = f'{fixture["home"]["name"]} {score} {fixture["away"]["name"]}'
    event = item.get("event") or {}
    minute = event.get("minute")
    minute_label = f"{minute}' · " if minute is not None else ""
    if language == "en":
        labels = {
            "started": ("Kick-off", teams),
            "goal": ("Goal!", f'{minute_label}{event.get("player") or "Goal"} · {teams}'),
            "red-card": ("Red card", f'{minute_label}{event.get("player") or "Player"} · {teams}'),
            "halftime": ("Half-time", teams),
            "second-half": ("Second half", teams),
            "finished": ("Full-time", teams),
        }
    else:
        labels = {
            "started": ("Comenzó el partido", teams),
            "goal": ("¡Gol!", f'{minute_label}{event.get("player") or "Gol"} · {teams}'),
            "red-card": ("Tarjeta roja", f'{minute_label}{event.get("player") or "Jugador"} · {teams}'),
            "halftime": ("Entretiempo", teams),
            "second-half": ("Segundo tiempo", teams),
            "finished": ("Final", teams),
        }
    title, body = labels[item["kind"]]
    return {
        "title": title,
        "body": body,
        "url": "/",
        "fixtureId": fixture["id"],
        "tag": f'{item["kind"]}-{fixture["id"]}-{minute or fixture["status"]}',
    }


def send_notifications(items: list[dict[str, Any]]) -> None:
    if not items:
        return
    private_key = os.getenv("VAPID_PRIVATE_KEY")
    subject = os.getenv("VAPID_SUBJECT")
    if not private_key or not subject:
        logging.warning(json.dumps({
            "level": "warning", "event": "push_skipped", "reason": "vapid_not_configured"
        }))
        return
    from pywebpush import WebPushException, webpush

    for subscriber in subscriptions():
        for item in items:
            fixture_id = item["fixture"]["id"]
            if fixture_id in subscriber["muted"]:
                continue
            try:
                webpush(
                    subscription_info=subscriber["subscription"],
                    data=json.dumps(localized_push(item, subscriber["language"])),
                    vapid_private_key=private_key,
                    vapid_claims={"sub": subject},
                    ttl=120,
                )
            except WebPushException as error:
                status = getattr(error.response, "status_code", None)
                if status in {404, 410}:
                    remove_subscription(subscriber["endpoint"])
                logging.error(json.dumps({
                    "level": "error", "event": "push_failed",
                    "status": status, "error": str(error),
                }))


def send_welcome(subscription: dict[str, Any], language: str) -> bool:
    private_key = os.getenv("VAPID_PRIVATE_KEY")
    subject = os.getenv("VAPID_SUBJECT")
    if not private_key or not subject:
        return False
    from pywebpush import WebPushException, webpush

    payload = {
        "title": "¡Avisos activados!" if language == "es" else "Alerts enabled!",
        "body": (
            "Te avisaremos de goles, rojas y estados del partido."
            if language == "es"
            else "We’ll notify you about goals, red cards and match states."
        ),
        "url": "/",
        "tag": "push-welcome",
    }
    try:
        webpush(
            subscription_info=subscription,
            data=json.dumps(payload),
            vapid_private_key=private_key,
            vapid_claims={"sub": subject},
            ttl=120,
        )
        logging.info(json.dumps({
            "level": "info", "event": "test_push_accepted",
        }))
        return True
    except WebPushException as error:
        logging.error(json.dumps({
            "level": "error", "event": "welcome_push_failed", "error": str(error),
        }))
        return False


def refresh() -> tuple[int, int | None]:
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
            previous = state["snapshot"]
            state["snapshot"] = snapshot
            state["last_error"] = None
        send_notifications(notification_events(previous, snapshot))
        logging.info(json.dumps({
            "level": "info",
            "event": "snapshot_refreshed",
            "at": snapshot["generatedAt"],
            "fixtures": len(fixtures),
            "live": len(events),
            "remainingRequests": remaining,
        }))
        return len(events), remaining
    except Exception as error:  # noqa: BLE001 - service must retain its last good snapshot
        with state_lock:
            state["last_error"] = str(error)
        logging.error(json.dumps({
            "level": "error",
            "event": "snapshot_failed",
            "error": str(error),
        }))
        return 0, None


def poll_forever() -> None:
    while True:
        live_count, remaining = refresh()
        if live_count and (remaining is None or remaining > 500):
            interval = int(os.getenv("LIVE_POLL_SECONDS", "10"))
        else:
            interval = int(os.getenv("IDLE_POLL_SECONDS", "120"))
        time.sleep(interval)


class Handler(BaseHTTPRequestHandler):
    def send_json(
        self, status: int, body: dict[str, Any], cache_control: str = "no-store"
    ) -> None:
        encoded = json.dumps(body, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Access-Control-Allow-Origin", os.getenv(
            "ALLOWED_ORIGIN", "https://fwc2026live.com"
        ))
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Cache-Control", cache_control)
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
            self.send_json(
                200, snapshot, "public, max-age=3, stale-while-revalidate=7"
            ) if snapshot else self.send_json(
                503, {"error": "snapshot_not_ready", "lastError": last_error}
            )
        elif self.path == "/v1/push/public-key":
            self.send_json(200, {"publicKey": os.getenv("VAPID_PUBLIC_KEY", "")})
        else:
            self.send_json(404, {"error": "not_found"})

    def read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        return json.loads(self.rfile.read(length) or b"{}")

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_json(204, {})

    def do_POST(self) -> None:  # noqa: N802
        try:
            body = self.read_json()
            if self.path == "/v1/push/subscribe":
                save_subscription(body["subscription"], body.get("language", "es"))
                send_welcome(body["subscription"], body.get("language", "es"))
                self.send_json(201, {"ok": True})
            elif self.path == "/v1/push/test":
                accepted = send_welcome(
                    body["subscription"], body.get("language", "es")
                )
                self.send_json(200 if accepted else 502, {"ok": accepted})
            elif self.path == "/v1/push/preferences":
                save_preferences(body["endpoint"], [
                    int(value) for value in body.get("mutedFixtureIds", [])
                ])
                self.send_json(200, {"ok": True})
            else:
                self.send_json(404, {"error": "not_found"})
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": "invalid_request", "detail": str(error)})

    def do_DELETE(self) -> None:  # noqa: N802
        try:
            body = self.read_json()
            if self.path == "/v1/push/subscribe":
                remove_subscription(body["endpoint"])
                self.send_json(200, {"ok": True})
            else:
                self.send_json(404, {"error": "not_found"})
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": "invalid_request", "detail": str(error)})

    def log_message(self, _format: str, *args: Any) -> None:
        return


if __name__ == "__main__":
    threading.Thread(target=poll_forever, daemon=True).start()
    port = int(os.getenv("PORT", "8787"))
    logging.info(json.dumps({"level": "info", "event": "server_started", "port": port}))
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
