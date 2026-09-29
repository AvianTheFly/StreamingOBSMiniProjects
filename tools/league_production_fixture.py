"""Isolated preview server: no live polling, OBS mutation or keyboard listener."""
import json
import sys
import tempfile
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths
ensure_import_paths()
from league_api import main
from league_api.http_server import make_handler
from league_api.production.config import DEFAULTS


if __name__ == '__main__':
    web_root = main.ROOT
    with tempfile.TemporaryDirectory() as folder, patch.object(main, 'ROOT', Path(folder)), patch('lib.settings_backups.SettingsBackups.snapshot'):
        (main.ROOT/'production.json').write_text(json.dumps({**DEFAULTS,'enabled':True}),encoding='utf-8')
        service = main.Service(threading.Event())
        handler = make_handler(service,root=web_root,port=0,load_config=main.load_config)
        server = ThreadingHTTPServer(('127.0.0.1',0),handler)
        print(json.dumps({'port':server.server_port}),flush=True)
        try: server.serve_forever()
        finally: server.server_close()
