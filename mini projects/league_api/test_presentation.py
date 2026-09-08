import copy
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from .engine import Engine, defaults
from .presentation import initialize, switch, capture
from .main import Service

class PresentationTests(unittest.TestCase):
    def test_roundtrip_preserves_latest_volume_and_logic(self):
        c=defaults(); personal=capture(c); c['events']['kill'].update(media='meme.mp4',duration=2)
        initialize(c,personal)
        c['layout']['width']=600
        switch(c,'personal')
        self.assertEqual(c['events']['kill']['media'],'')
        c['events']['kill'].update(media='mine.mp4',audio='mine.wav',volume=.23,enabled=False,cooldown=45)
        switch(c,'memes')
        self.assertEqual(c['events']['kill']['media'],'meme.mp4')
        self.assertEqual(c['layout']['width'],600)
        self.assertEqual(c['events']['kill']['volume'],.23)
        self.assertFalse(c['events']['kill']['enabled'])
        self.assertEqual(c['events']['kill']['cooldown'],45)
        switch(c,'personal')
        self.assertEqual(c['events']['kill']['media'],'mine.mp4')
        self.assertEqual(c['events']['kill']['audio'],'mine.wav')

    def test_off_blocks_preview_and_carries_companion_audio(self):
        c=defaults(); c['events']['kill']['audio']='sound.wav'; e=Engine(c)
        a=e.submit([{'key':'kill','confidence':'preview'}])
        self.assertEqual(a[0]['audio'],'sound.wav')
        c['overlay_enabled']=False
        self.assertEqual(e.submit([{'key':'kill','confidence':'preview'}]),[])
        self.assertEqual(e.active(),[])

    def test_settings_persist_switch_and_reject_bad_layout(self):
        with tempfile.TemporaryDirectory() as folder, patch('league_api.main.ROOT',Path(folder)), patch('lib.settings_backups.SettingsBackups.snapshot'):
            service=Service(threading.Event())
            result=service.save_edit('/options',{'revision':0,'overlay_enabled':False,'layout':{'x':0,'y':0,'width':1920,'height':1080}})
            self.assertFalse(result['config']['overlay_enabled'])
            loaded=Service(threading.Event())
            self.assertFalse(loaded.engine.config['overlay_enabled'])
            self.assertEqual(loaded.engine.config['layout']['width'],1920)
            with self.assertRaises(ValueError):
                loaded.save_edit('/options',{'revision':1,'layout':{'x':1900,'y':0,'width':500,'height':200}})

    def test_companion_assignment_and_snapshot(self):
        with tempfile.TemporaryDirectory() as folder, patch('league_api.main.ROOT',Path(folder)), patch('lib.settings_backups.SettingsBackups.snapshot'):
            root=Path(folder); (root/'media').mkdir(); (root/'media'/'sound.wav').write_bytes(b'RIFF')
            service=Service(threading.Event())
            service.save_edit('/event',{'revision':0,'key':'kill','rule':{'audio':'media/sound.wav'}})
            service.engine.submit([{'key':'kill','confidence':'preview'}])
            self.assertEqual(service.snapshot()['alerts'][0]['audio'],'/asset?path=media/sound.wav')
            with self.assertRaises(ValueError):
                service.save_edit('/event',{'revision':1,'key':'kill','rule':{'audio':'missing.wav'}})
            service.save_edit('/event',{'revision':1,'key':'kill','rule':{'audio':''}})
            self.assertEqual(service.engine.config['events']['kill']['audio'],'')
