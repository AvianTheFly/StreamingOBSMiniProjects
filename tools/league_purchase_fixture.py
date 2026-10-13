"""Disposable purchase integration fixture. Never polls League or writes OBS."""
import json
from pathlib import Path
import sys
import tempfile
import threading
from http.server import ThreadingHTTPServer
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths
ensure_import_paths()
from league_api import main
from league_api.http_server import make_handler


def run():
    root=main.ROOT
    with tempfile.TemporaryDirectory() as folder, patch.object(main,'ROOT',Path(folder)):
        service=main.Service(threading.Event())
        service.engine.config['overlay_enabled']=False
        service.engine.purchases=type(service.engine.purchases)(
            json.loads((root/'media/purchases/catalog.json').read_text())['data'])
        service.purchase_permission=threading.Event();service.purchase_permission.set()
        base=make_handler(service,root=root,port=0,load_config=main.load_config)
        class Handler(base):
            def handle(self):
                try:super().handle()
                except (ConnectionAbortedError,ConnectionResetError,BrokenPipeError):pass
            def do_POST(self):
                if self.path!='/fixture':return super().do_POST()
                data=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                with service.lock:
                    service.engine.config['paused']=data.pop('_paused',False)
                    service.engine.ingest(data)
                    service.engine.slots=[]
                self.send_bytes(b'{}')
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        server.daemon_threads=True
        threading.Thread(target=server.serve_forever,daemon=True).start()
        print(json.dumps(dict(port=server.server_port)),flush=True)
        try:sys.stdin.buffer.read()
        finally:server.shutdown();server.server_close()


if __name__=='__main__':run()
