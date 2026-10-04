"""Local command-editor adapter; command policy and persistence stay in the feature."""
from urllib.parse import urlparse
from lib import twitch_chat


class TwitchCommandRoutes:
    def _commands_local(self):
        host = self.headers.get('Host','')
        expected = {f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}'}
        origin = self.headers.get('Origin')
        return (self.client_address[0] in {'127.0.0.1','::1'} and host in expected and
                (not origin or urlparse(origin).netloc==host))

    def _get_twitch_commands(self):
        if not self._commands_local(): return self._err(403,'Open chat commands from this Hub.')
        from twitch_commands import api
        try: self._json(200,{**api.state(),'chat':twitch_chat.status()})
        except (ValueError,OSError): self._err(503,'Chat commands unavailable. Check settings and module startup.')

    def _post_twitch_commands(self,path):
        if not self._commands_local(): return self._err(403,'Open chat commands from this Hub.')
        from twitch_commands import api
        from twitch_commands.settings import Conflict
        try:
            if not 0<int(self.headers.get('Content-Length','0'))<=8192:
                raise ValueError('Command edit is too large.')
            body = self._body()
            if path=='/api/twitch-commands/preview': result = api.preview(body)
            elif path=='/api/twitch-commands/settings': result = api.save(body)
            else: return self._err(404,'Unknown chat command endpoint.')
            self._json(200,result)
        except Conflict as exc: self._err(409,str(exc))
        except (ValueError,TypeError) as exc: self._err(400,str(exc))
        except OSError: self._err(503,'Could not save commands. Your previous settings were preserved.')
