"""One bounded, loopback-only snapshot cache shared by the League consumers."""
import copy
import json
import math
import ssl
import threading
import time
from urllib.error import URLError
from urllib.request import HTTPSHandler, ProxyHandler, build_opener


class LiveClientUnavailable(RuntimeError):
    pass


class SnapshotClient:
    def __init__(self, clock=time.monotonic, opener=None):
        self.clock = clock
        self.opener = opener or build_opener(ProxyHandler({}), HTTPSHandler(context=ssl._create_unverified_context()))
        self.lock = threading.Lock()
        self.snapshot = None
        self.fetched_at = -1000
        self.unavailable_until = -1000

    def fetch(self):
        with self.lock:
            now = self.clock()
            if self.snapshot is not None and now - self.fetched_at < .25:
                return copy.deepcopy(self.snapshot)
            if now < self.unavailable_until:
                raise LiveClientUnavailable('League live client is unavailable')
            try:
                with self.opener.open('https://127.0.0.1:2999/liveclientdata/allgamedata', timeout=2) as response:
                    data = json.load(response)
                game_time = data.get('gameData', {}).get('gameTime')
                if isinstance(game_time, bool) or not isinstance(game_time, (int, float)) or not math.isfinite(game_time):
                    raise ValueError('League snapshot is missing gameTime')
            except (OSError, URLError) as exc:
                self.snapshot = None
                self.unavailable_until = self.clock() + .5
                raise LiveClientUnavailable('League live client is unavailable') from exc
            except (ValueError, TypeError, AttributeError):
                self.snapshot = None
                raise
            self.snapshot, self.fetched_at = data, self.clock()
            self.unavailable_until = -1000
            return copy.deepcopy(data)


_client = SnapshotClient()
fetch_snapshot = _client.fetch
