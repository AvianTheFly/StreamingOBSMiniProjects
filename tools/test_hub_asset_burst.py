"""A module graph can queue connections while the HTTP accept loop is busy."""
import socket
import threading
import unittest
from hub_ui.server import _HubHTTPServer, _Handler


class PreviewAssetBurstTests(unittest.TestCase):
    def test_pending_module_downloads_survive_an_accept_loop_pause(self):
        sockets=[]
        with _HubHTTPServer(('127.0.0.1',0),_Handler) as server:
            worker=None
            try:
                # Listen before serving, like a short scheduling pause during
                # startup/other Hub work. These requests must queue successfully.
                for _ in range(24):
                    client=socket.create_connection(server.server_address,timeout=.75)
                    sockets.append(client)
                    client.sendall(b'GET /transitions/rigs/ram/turn.js HTTP/1.0\r\nHost: localhost\r\n\r\n')
                worker=threading.Thread(target=server.serve_forever,daemon=True)
                worker.start()
                for client in sockets:
                    client.settimeout(3)
                    response=b''
                    while chunk:=client.recv(65536):response+=chunk
                    self.assertIn(b'200 OK',response.split(b'\r\n',1)[0])
                    self.assertIn(b'export function turning',response)
            finally:
                for client in sockets:client.close()
                if worker:
                    server.shutdown()
                    worker.join(3)
                    self.assertFalse(worker.is_alive())


if __name__=='__main__':unittest.main()
