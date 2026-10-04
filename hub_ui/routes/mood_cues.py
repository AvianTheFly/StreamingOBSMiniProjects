"""Local authoring transport for Love Me's public variation API."""
from urllib.parse import urlparse, unquote
from lib.http_files import serve_file
import mimetypes


class MoodCueRoutes:
    def _moods_local(self):
        host=self.headers.get('Host','')
        origin=self.headers.get('Origin')
        return (self.client_address[0] in {'127.0.0.1','::1'} and
                host in {f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}'} and
                (not origin or urlparse(origin).netloc==host))

    def _get_mood_cues(self,path):
        from love_me import api
        if not self._moods_local():
            return self._err(403,'Open mood cues from this local Hub.')
        try:
            if path.startswith('/api/mood-cues/audio/'):
                file=api.audio_file(unquote(path.rsplit('/',1)[-1]))
                return serve_file(self,file,content_type=mimetypes.guess_type(file.name)[0] or 'audio/wav',
                                  headers={'Cache-Control':'no-store'})
            self._json(200,api.state())
        except (ValueError,OSError) as exc:
            self._err(503,str(exc))

    def _post_mood_cues(self,path):
        from love_me import api
        from love_me.settings import Conflict
        if not self._moods_local():
            return self._err(403,'Open mood cues from this local Hub.')
        try:
            size=int(self.headers.get('Content-Length','0'))
            maximum=28*1024*1024 if path.endswith('/audio') else 16384
            if not 0<size<=maximum:
                raise ValueError('Request is too large. Audio uploads support files up to 20 MB.')
            body=self._body()
            if path=='/api/mood-cues/settings': result=api.save(body)
            elif path=='/api/mood-cues/audio': result=api.import_audio(body)
            elif path=='/api/mood-cues/control': result=api.control(body)
            else: return self._err(404,'Unknown mood cue endpoint.')
            self._json(200 if result.get('ok',True) else 400,result)
        except Conflict as exc: self._err(409,str(exc))
        except (ValueError,TypeError) as exc: self._err(400,str(exc))
        except OSError: self._err(503,'Could not save the mood cue. Your previous settings were preserved.')
