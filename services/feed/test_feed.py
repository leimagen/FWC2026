import importlib.util
import pathlib
import unittest

MODULE_PATH = pathlib.Path(__file__).with_name("feed.py")
SPEC = importlib.util.spec_from_file_location("fwc2026_feed", MODULE_PATH)
feed = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(feed)


class FeedTest(unittest.TestCase):
    def test_normalizes_goal_event(self):
        event = feed.normalize_event({
            "time": {"elapsed": 45, "extra": 2},
            "team": {"id": 25},
            "player": {"name": "Player"},
            "assist": {"name": "Assistant"},
            "type": "Goal",
            "detail": "Normal Goal",
            "comments": None,
        })
        self.assertEqual(event["minute"], 45)
        self.assertEqual(event["addedTime"], 2)
        self.assertEqual(event["player"], "Player")

    def test_detects_new_goal_without_replaying_old_events(self):
        fixture = {
            "id": 1, "status": "1H",
            "home": {"name": "Germany", "goals": 1},
            "away": {"name": "Ivory Coast", "goals": 1},
            "events": [],
        }
        previous = {"fixtures": [fixture]}
        current_fixture = {**fixture, "events": [{
            "minute": 50, "addedTime": None, "teamId": 25,
            "player": "Player", "type": "Goal", "detail": "Normal Goal",
        }]}
        items = feed.notification_events(previous, {"fixtures": [current_fixture]})
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["kind"], "goal")

    def test_active_statuses_include_halftime(self):
        self.assertIn("HT", feed.LIVE_STATES)


if __name__ == "__main__":
    unittest.main()
