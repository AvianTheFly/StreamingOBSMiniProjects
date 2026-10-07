"""Hub assembly and bounded service lifetime for Twitch celebrations."""
import threading
from http.server import ThreadingHTTPServer
from .config import ROOT, PORT, SOURCE
from .service import Service
from .http_server import handler

REQUIRES_OBS = False


def run(input_queue, stop_event, *, startup_event=None):
    service = Service(stop_event)
    server = ThreadingHTTPServer(('127.0.0.1',PORT),handler(service,ROOT,PORT))
    server.daemon_threads = True
    from .interface import _live
    _live['service'] = service
    from lib.twitch_clip_session import clip_sessions
    clip_sessions.register(service, token=service.twitch.token,
        available=lambda: bool(service.twitch.tokens), stop=service.twitch.stop)
    from lib.twitch_chat_session import chat_sessions
    chat_sessions.register(service, authorize=service.twitch.chat_authorization,
                           status=service.twitch.chat_status, stop=service.twitch.stop)
    http_thread = threading.Thread(target=server.serve_forever,daemon=True,name='celebrations-http')
    try:
        http_thread.start()
        threading.Thread(target=service.twitch.listen,daemon=True,name='celebrations-twitch').start()
        # OBS may have opened this page before the local HTTP server was available.
        # Reload existing input once; polling then handles later server interruptions.
        def reload_existing():
            try:
                import obs
                client = obs.get_obs()
                inputs = client.send('GetInputList',{},raw=True)['inputs']
                if any(x['inputName']==SOURCE and x['inputKind']=='browser_source' for x in inputs):
                    client.send('PressInputPropertiesButton',dict(inputName=SOURCE,propertyName='refreshnocache'),raw=True)
            except Exception:
                pass  # OBS can be offline while Twitch is listening.
        threading.Thread(target=reload_existing,daemon=True,name='celebrations-overlay-reload').start()
        if startup_event: startup_event.set()
        print(f'[twitch_celebrations] Ready: http://127.0.0.1:{PORT}',flush=True)
        stop_event.wait()
    finally:
        clip_sessions.unregister(service)
        chat_sessions.unregister(service)
        service.close()
        if service.twitch.socket: service.twitch.socket.close()
        if http_thread.is_alive():
            server.shutdown()
        server.server_close()
        _live.clear()
