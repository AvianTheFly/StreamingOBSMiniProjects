"""Browser playback contract: stale acknowledgements, pause clocks, media isolation."""
import json
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from unittest.mock import patch, Mock

from lib.browser_effects.session import Channel
from lib.browser_effects.http_server import handler


class SessionTests(unittest.TestCase):
    def setUp(self):
        self.now=10
        self.channel=Channel(lambda:self.now)

    def test_replacement_ignores_stale_end_and_stop(self):
        old=self.channel.begin('old',Path('old.wav'),{})
        new=self.channel.begin('new',Path('new.wav'),{})
        self.assertFalse(self.channel.acknowledge(old,'ended'))
        self.channel.stop(old)
        self.assertEqual(self.channel.snapshot()['active']['id'],new)
        self.assertFalse(self.channel.done.is_set())
        self.assertTrue(self.channel.acknowledge(new,'playing'))
        self.assertTrue(self.channel.started.is_set())
        self.channel.acknowledge(new,'ended')
        self.assertTrue(self.channel.done.is_set())

    def test_pause_clock_and_idle_volume_attribution(self):
        self.channel.begin('die die die',Path('audio.wav'),{})
        self.now=12;self.channel.pause(True)
        self.now=32
        self.assertEqual(self.channel.snapshot()['active']['elapsed'],2)
        self.channel.pause(False);self.now=33
        self.assertEqual(self.channel.snapshot()['active']['elapsed'],3)
        self.channel.stop()
        self.assertTrue(self.channel.matches('DIE DIE DIE'))
        self.assertFalse(self.channel.matches('hooray'))


class HTTPTests(unittest.TestCase):
    def test_audio_ranges_expiry_host_and_cross_origin_ack(self):
        with tempfile.TemporaryDirectory() as folder:
            file=Path(folder)/'sound.wav';file.write_bytes(b'0123456789')
            channel=Channel();pid=channel.begin('sound',file,{'renderer':'muffins'})
            server=ThreadingHTTPServer(('127.0.0.1',0),handler(lambda name:channel if name=='soundboard' else None,0))
            port=server.server_port
            server.RequestHandlerClass=handler(lambda name:channel if name=='soundboard' else None,port)
            thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
            url=f'http://127.0.0.1:{port}'
            try:
                with urlopen(Request(url+'/audio/soundboard/'+pid,headers={'Range':'bytes=2-5'})) as response:
                    self.assertEqual(response.status,206);self.assertEqual(response.read(),b'2345')
                    self.assertEqual(response.headers['Content-Range'],'bytes 2-5/10')
                with urlopen(Request(url+'/audio/soundboard/'+pid,headers={'Range':'bytes=-3'})) as response:
                    self.assertEqual(response.read(),b'789')
                with urlopen(url+'/api/state/soundboard') as response:
                    self.assertEqual(json.load(response)['active']['stem'],'sound')
                body=json.dumps({'id':pid,'status':'ended'}).encode()
                with self.assertRaises(HTTPError) as error:
                    urlopen(Request(url+'/api/ack/soundboard',data=body,headers={'Content-Type':'application/json','Origin':'https://untrusted.test'}))
                self.assertEqual(error.exception.code,403)
                self.assertFalse(channel.done.is_set())
                channel.stop()
                with self.assertRaises(HTTPError) as error:urlopen(url+'/audio/soundboard/'+pid)
                self.assertEqual(error.exception.code,404)
                with self.assertRaises(HTTPError) as error:urlopen(Request(url+'/overlay/soundboard',headers={'Host':'untrusted.test'}))
                self.assertEqual(error.exception.code,403)
            finally:
                server.shutdown();server.server_close();thread.join()

    def test_browser_fader_matches_only_its_loaded_asset(self):
        from hub_ui.server import _obs_source_matches_runtime_stem
        from lib.browser_effects.obs_source import source_name
        channel=Channel();channel.begin('die die die',Path('audio.wav'),{})
        with patch('lib.browser_effects.runtime.find_channel',return_value=channel):
            self.assertTrue(_obs_source_matches_runtime_stem(source_name('soundboard'),'die die die'))
            self.assertFalse(_obs_source_matches_runtime_stem(source_name('soundboard'),'hooray'))

    def test_player_cancellation_clears_browser_and_finishes(self):
        from lib.browser_effects.player import BrowserPlayer
        player=BrowserPlayer('test-browser',Path('.'),'soundboard','monitor',{})
        cancelled=threading.Event()
        with patch.object(player,'effect',return_value={'renderer':'muffins'}), \
             patch('lib.browser_effects.player.prepare_audio',return_value=Path('audio.wav')), \
             patch('lib.browser_effects.player.attach'),patch('obs.set_input_mute'),patch('obs.set_input_volume_db'), \
             patch('obs.get_obs') as connection:
            worker=threading.Thread(target=player.play,args=('sound',Path('clip.mp4'),-12,cancelled.is_set,20))
            worker.start()
            for _ in range(100):
                if player.channel.item:break
                cancelled.wait(.01)
            self.assertIsNotNone(player.channel.item)
            cancelled.set();worker.join(2)
            self.assertFalse(worker.is_alive())
            self.assertIsNone(player.channel.item)
            connection.return_value.send.assert_called_once_with('PressInputPropertiesButton',
                {'inputName':player.source,'propertyName':'refreshnocache'},raw=True)


class TriggerGateTests(unittest.TestCase):
    def test_muffin_key_requires_existing_soundboard_trigger_window(self):
        import queue
        from types import SimpleNamespace
        from lib.paths import ensure_import_paths, load_project_env
        ensure_import_paths();load_project_env()
        from soundboard import main
        from lib.global_hotkeys import KeyEvent
        player=Mock(is_busy=False,current_stem=None,loaded_browser_stem=None)
        settings=SimpleNamespace(profile_name='default',hotkeys={'^':'die die die','@':'hooray'},
            interface_hotkeys={},project_volume_db=-5.5,profile_volume_db=0,
            file_volume_offsets={'die die die':1.77},sound_categories={},category_volume_db={})
        played=threading.Event();ready=threading.Event();stop=threading.Event();callbacks=[]
        player.play_async.side_effect=lambda **kwargs:played.set()
        with patch.object(main,'SoundboardPlayer',return_value=player), \
             patch.object(main,'VoicePTT',return_value=None), \
             patch.object(main,'_load_runtime_settings',return_value=settings), \
             patch.object(main,'_build_name_index',return_value={'die die die':Path('muffin.mp4')}), \
             patch.object(main,'load_project_profile_summaries',return_value=[]), \
             patch.object(main,'subscribe_global_hotkeys',side_effect=lambda callback:callbacks.append(callback) or 1), \
             patch.object(main,'unsubscribe_global_hotkeys'), \
             patch.object(main.coordinator,'request_to_play',side_effect=lambda name,on_ready:on_ready()), \
             patch.object(main.coordinator,'announce_finished'), \
             patch.object(main.hub_events,'subscribe'),patch.object(main.hub_events,'unsubscribe'), \
             patch.dict(main._live,{},clear=True):
            thread=threading.Thread(target=main.run,args=(queue.Queue(),stop),kwargs={'startup_event':ready})
            thread.start()
            try:
                self.assertTrue(ready.wait(2))
                callbacks[0](KeyEvent('^',''))
                self.assertFalse(played.wait(.1),'muffin key outside trigger window must do nothing')
                for token in main.CONFIG.trigger_sequences[0]:callbacks[0](KeyEvent(token,''))
                callbacks[0](KeyEvent('^',''))
                self.assertTrue(played.wait(2),'same key inside trigger window must play')
                self.assertEqual(player.play_async.call_args.kwargs['stem'],'die die die')
                self.assertAlmostEqual(player.play_async.call_args.kwargs['volume_db'],-3.73)
                played.clear();callbacks[0](KeyEvent('^',''))
                self.assertFalse(played.wait(.1),'consumed trigger window must close')
            finally:
                stop.set();thread.join(2)
                self.assertFalse(thread.is_alive())


if __name__=='__main__':unittest.main()
