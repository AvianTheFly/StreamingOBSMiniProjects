import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from PIL import Image
from .stage_appearance import StageAppearance, MAX_BYTES

class AppearanceTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.owner=StageAppearance(self.root)
        art=self.root/'media/match-screens/game-start.png';art.parent.mkdir(parents=True)
        buffer=io.BytesIO();Image.new('RGB',(48,27),'navy').save(buffer,'PNG');self.payload=buffer.getvalue();art.write_bytes(self.payload)
        self.backup=patch('league_api.stage_appearance.SettingsBackups').start();self.addCleanup(patch.stopall)
    def test_upload_does_not_select_and_selection_survives_restart(self):
        self.owner.path.write_text(json.dumps({'unknown':{'volume':-20.53}}))
        result=self.owner.upload('../my image.png',self.payload)
        self.assertEqual(result['selected'],'sanctuary')
        self.assertEqual(len(result['images']),2)
        self.assertEqual(result['images'][-1]['title'],'my image')
        selected=self.owner.select(result['uploaded'],0)
        self.assertEqual(selected['revision'],1)
        fresh=StageAppearance(self.root)
        self.assertEqual(fresh.snapshot()['selected'],result['uploaded'])
        self.assertEqual(fresh.asset(result['uploaded']).read_bytes(),self.payload)
        self.assertEqual(json.loads(self.owner.path.read_text())['unknown'],{'volume':-20.53})
        self.assertEqual((self.root/'media/match-screens/game-start.png').read_bytes(),self.payload)
        self.backup.return_value.snapshot.assert_called()
    def test_stale_revision_and_invalid_selection_preserve_data(self):
        self.owner.select('sanctuary',0);before=self.owner.path.read_bytes()
        for key,revision in [('sanctuary',0),('sanctuary',True),([],1),('../nope',1)]:
            with self.assertRaises((ValueError,FileNotFoundError)):self.owner.select(key,revision)
            self.assertEqual(self.owner.path.read_bytes(),before)
    def test_malformed_settings_are_not_reset(self):
        for text in ['{broken','[]','{"images":[]}']:
            self.owner.path.write_text(text)
            with self.assertRaises(ValueError):self.owner.upload('x',self.payload)
            with self.assertRaises(ValueError):self.owner.select('sanctuary',0)
            self.assertEqual(self.owner.path.read_text(),text)
    def test_invalid_images_do_not_write_files(self):
        for payload in [b'',b'pretend.png',b'x'*(MAX_BYTES+1)]:
            with self.assertRaises(ValueError):self.owner.upload('x.png',payload)
        self.assertFalse(self.owner.folder.exists())
    def test_duplicate_upload_reuses_image_without_losing_metadata(self):
        first=self.owner.upload('Original.png',self.payload)
        second=self.owner.upload('Renamed.png',self.payload)
        self.assertEqual(first['uploaded'],second['uploaded'])
        self.assertEqual(second['images'][-1]['title'],'Original')
        self.assertEqual(len(list(self.owner.folder.iterdir())),1)
    def test_saved_path_cannot_escape_library(self):
        self.owner.path.write_text(json.dumps({'images':{'evil':{'file':'../outside.png'}}}))
        with self.assertRaises(ValueError):self.owner.asset('evil')

class AppearanceHTTPTests(unittest.TestCase):
    setUp = AppearanceTests.setUp
    def test_hub_authoring_and_league_rendering_share_saved_selection(self):
        import threading
        from types import SimpleNamespace
        from http.server import ThreadingHTTPServer
        from urllib.request import Request, urlopen
        from urllib.error import HTTPError
        from hub_ui.server import _Handler
        from league_api.interface import _live
        from league_api.http_server import make_handler
        service=SimpleNamespace(stage_appearance=self.owner,client_scenes=SimpleNamespace(stage_snapshot=lambda:{'loading':True,'roster':[]}))
        def serve(handler):
            server=ThreadingHTTPServer(('127.0.0.1',0),handler)
            thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
            self.addCleanup(server.server_close);self.addCleanup(server.shutdown)
            return 'http://127.0.0.1:'+str(server.server_port)
        with patch.dict(_live,{'service':service}):
            base=serve(_Handler)
            def send(path,body=None):
                if isinstance(body,dict):body=json.dumps(body).encode()
                return urlopen(Request(base+path,data=body),timeout=3)
            uploaded=json.load(send('/api/league-stage/upload?name=test.png',self.payload))
            key=uploaded['uploaded']
            self.assertEqual(json.load(send('/api/league-stage'))['selected'],'sanctuary')
            self.assertEqual(send('/api/league-stage/art/'+key).read(),self.payload)
            self.assertEqual(json.load(send('/api/league-stage/select',{'image':key,'revision':0}))['selected'],key)
            with self.assertRaises(HTTPError) as conflict:send('/api/league-stage/select',{'image':'sanctuary','revision':0})
            self.assertEqual(conflict.exception.code,400)
            with self.assertRaises(HTTPError):send('/api/league-stage/upload',b'fake image')
            league=serve(make_handler(service,root=self.root,port=0,load_config=lambda:{}))
            snapshot=json.load(urlopen(league+'/stage/state',timeout=3))
            self.assertEqual(snapshot['appearance']['selected'],key)
            self.assertEqual(urlopen(league+snapshot['appearance']['image_url'],timeout=3).read(),self.payload)


if __name__=='__main__':unittest.main()
