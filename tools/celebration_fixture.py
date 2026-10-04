"""Isolated HTTP fixture: no Twitch listener, OBS access, settings writes or live events."""
import json
from pathlib import Path
import sys
import threading
from http.server import ThreadingHTTPServer
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT),str(ROOT/'mini projects')]
from twitch_celebrations.main import Service
from twitch_celebrations.http_server import handler
stop=threading.Event()
s=Service(stop)
s.settings=dict(enabled=True,volume=.22,muted=True,custom={})
def denied(*args):raise ValueError('Fixture is preview only')
s.save=denied;s.attach_obs=denied;s.twitch.connect=denied
server=ThreadingHTTPServer(('127.0.0.1',0),handler(s,ROOT/'mini projects/twitch_celebrations',0))
server.RequestHandlerClass=handler(s,ROOT/'mini projects/twitch_celebrations',server.server_port)
server.daemon_threads=True
threading.Thread(target=server.serve_forever,daemon=True).start()
print(json.dumps(dict(port=server.server_port)),flush=True)
try:sys.stdin.read()
finally:stop.set();server.shutdown();server.server_close()
