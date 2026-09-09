"""Pool selection, persistence and exact-file serving contracts."""
import copy
import json
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.request import urlopen
from http.server import ThreadingHTTPServer
from .engine import Engine, defaults
from .editor import validate_rule
from .main import Service
from .presentation import capture, initialize, switch


class PoolTests(unittest.TestCase):
    def rule(self):
        return {**defaults()['events']['kill'],'media':'a.mp4','duration':1.2,'cooldown':0,
                'media_pool':[{'media':'b.mp4','duration':2.4,'start_time':.5,'loop':False}]}

    def test_rotation_timing_and_event_volume(self):
        c=defaults();c['events']['kill']=self.rule();clock=[10];e=Engine(c,clock=lambda:clock[0])
        chosen=[]
        for _ in range(8):
            e.clear();a=e.submit([{'key':'kill'}])[0];chosen.append(a['media'])
            self.assertEqual(a['volume'],c['events']['kill']['volume'])
            self.assertAlmostEqual(a['expires']-clock[0],1.2 if a['media']=='a.mp4' else 2.4)
            clock[0]+=3
        self.assertTrue(all(a!=b for a,b in zip(chosen,chosen[1:])))

    def test_disabled_pool_uses_primary_and_preserves_alternatives(self):
        c=defaults();c['events']['kill']={**self.rule(),'pool_enabled':False};e=Engine(c)
        for _ in range(4):self.assertEqual(e.submit([{'key':'kill'}])[0]['media'],'a.mp4')
        self.assertEqual(len(c['events']['kill']['media_pool']),1)

    def test_validation_and_duplicate_files(self):
        r=self.rule();r['media_pool']*=2
        self.assertEqual(len(validate_rule(r)['media_pool']),1)
        for value in (float('nan'),0,61,True):
            bad=self.rule();bad['media_pool'][0]['duration']=value
            with self.assertRaises(ValueError):validate_rule(bad)

    def test_banks_do_not_share_mutable_pool_lists(self):
        c=defaults();initialize(c,capture(c));c['events']['kill']=self.rule()
        switch(c,'personal');self.assertEqual(c['events']['kill']['media_pool'],[])
        switch(c,'memes');c['events']['kill']['media_pool'][0]['duration']=1.9
        self.assertEqual(c['presentations']['memes']['events']['kill']['media_pool'][0]['duration'],2.4)

    def test_selected_file_survives_rule_edit_and_is_served(self):
        with tempfile.TemporaryDirectory() as tmp, patch('league_api.main.ROOT',Path(tmp)), patch('lib.settings_backups.SettingsBackups.snapshot'):
            root=Path(tmp);(root/'a.mp4').write_bytes(b'primary');(root/'b.mp4').write_bytes(b'alternative')
            service=Service(threading.Event());rule=self.rule();rule['media_pool'][0]['media']=str(root/'b.mp4')
            service.save_edit('/event',{'key':'kill','revision':0,'rule':rule})
            with patch('league_api.media_pool.random.choice',side_effect=lambda choices:next(x for x in choices if x['media'].endswith('b.mp4'))):
                service.engine.submit([{'key':'kill'}])
            url=service.snapshot()['alerts'][0]['media']
            self.assertIn('/asset?path=',url)
            service.save_edit('/event',{'key':'kill','revision':1,'rule':{'media_pool':[]}})
            server=ThreadingHTTPServer(('127.0.0.1',0),service.handler())
            thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
            try:
                with urlopen(f'http://127.0.0.1:{server.server_port}'+url) as response:
                    self.assertEqual(response.read(),b'alternative')
            finally:server.shutdown();server.server_close()
            self.assertEqual(Service(threading.Event()).engine.config['events']['kill']['media_pool'],[])

    def test_missing_pool_file_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp, patch('league_api.main.ROOT',Path(tmp)):
            service=Service(threading.Event())
            with self.assertRaises(ValueError):
                service.save_edit('/event',{'key':'kill','revision':0,'rule':{'media_pool':[{'media':'missing.mp4'}]}})


if __name__=='__main__':unittest.main()
