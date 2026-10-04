"""Validation and catalogs without changing personal settings or network access."""
import copy
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.chat_overlay import settings
from lib.chat_overlay.catalog import _seven, _ffz
from lib.chat_overlay.desktop import activate
from lib.chat_overlay.pointer import is_game
from lib.chat_overlay.sticker_pack import additions
from lib.chat_overlay.startup import ChatStartup
from lib.chat_overlay import chaos_pack
import threading


class ChatSettingsTest(unittest.TestCase):
    def test_local_chaos_pack_survives_provider_outage_and_preserves_personal_data(self):
        asset = dict(id='party-id', url='https://cdn.test/rave.webp', animated=True, frames=20)
        with tempfile.TemporaryDirectory() as folder, patch.object(chaos_pack, 'PATH', Path(folder) / 'pack.json'), patch.object(chaos_pack.SettingsBackups, 'snapshot'):
            chaos_pack.install({'title': 'Chaos', 'emotes': {'RaveTime': asset}, 'aliases': {'rave time': 'RaveTime'}, 'personal': 42})
            installed = chaos_pack.install({'title': 'Chaos', 'emotes': {'RaveTime': {**asset, 'url': 'https://different.test/rave.webp'}, 'Dance': asset}, 'aliases': {'dance break': 'Dance'}})
            self.assertEqual(installed['emotes']['RaveTime']['url'], asset['url'])
            self.assertEqual(installed['personal'], 42)
            from lib.chat_overlay.catalog import catalog
            with patch('lib.chat_overlay.catalog._remote_catalog', return_value={'emotes': {}, 'badges': {}, 'providers': {'7TV': 'Unavailable'}}):
                result = catalog('my_channel', '123')
            self.assertEqual(result['emotes']['RaveTime']['frames'], 20)
            self.assertEqual(result['pack']['aliases']['rave time'], asset['url'])
            chaos_pack.PATH.write_text('{ personal malformed')
            original = chaos_pack.PATH.read_bytes()
            with self.assertRaises(ValueError):
                chaos_pack.install({'emotes': {}, 'aliases': {}})
            self.assertEqual(chaos_pack.PATH.read_bytes(), original)

    def test_installed_chaos_manifest_covers_every_requested_animation(self):
        pack = chaos_pack.read()
        if not pack['emotes']:
            self.skipTest('Optional personal chaos library is not installed')
        for name in chaos_pack.REQUESTED:
            self.assertIn(name, pack['emotes'])
            self.assertGreater(pack['emotes'][name]['frames'], 1)
        self.assertTrue(all(settings.image_url(asset['url']) for asset in pack['emotes'].values()))

    def test_auto_launch_waits_for_own_server_and_reuses_single_worker(self):
        startup = ChatStartup()
        stop, ready, entered, done = (threading.Event() for _ in range(4))
        def preferences():
            entered.set()
            return {'auto_start': True}
        def launch(port):
            self.assertEqual(port, 8123)
            done.set()
            return {'message': 'running'}
        with patch('lib.chat_overlay.startup.settings.read', side_effect=preferences), patch('lib.chat_overlay.startup.activate', side_effect=launch) as activate_host:
            startup.start(stop, ready, port=8123)
            self.assertTrue(entered.wait(1))
            first_thread = startup.thread
            startup.start(stop, ready, port=8123)
            self.assertIs(startup.thread, first_thread)
            activate_host.assert_not_called()
            ready.set()
            self.assertTrue(done.wait(1))
            startup.join()
            activate_host.assert_called_once_with(8123)

    def test_disabled_and_cancelled_startup_never_launch_host(self):
        for enabled in (False, True):
            startup, stop, ready = ChatStartup(), threading.Event(), threading.Event()
            stop.set()
            ready.set()
            with patch('lib.chat_overlay.startup.settings.read', return_value={'auto_start': enabled}), patch('lib.chat_overlay.startup.activate') as activate_host:
                startup.start(stop, ready, port=7420)
                startup.join()
                self.assertFalse(startup.thread.is_alive())
                activate_host.assert_not_called()
        startup = ChatStartup()
        with patch('lib.chat_overlay.startup.settings.read', return_value={'auto_start': False}), patch('lib.chat_overlay.startup.activate') as activate_host:
            startup.start(threading.Event(), threading.Event(), port=7420)
            startup.join()
            activate_host.assert_not_called()

    def test_game_detection_has_safe_fullscreen_fallback(self):
        self.assertTrue(is_game('League of Legends.exe', False))
        self.assertFalse(is_game('LeagueClientUx.exe', True))
        self.assertFalse(is_game('ChatGPT.exe', True))
        self.assertTrue(is_game('unknown.exe', True))
        self.assertFalse(is_game('unknown.exe', False))

    def test_save_preserves_other_preferences_and_rejects_executable_urls(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(settings, 'PATH', Path(folder) / 'settings.json'), patch.object(settings.SettingsBackups, 'snapshot') as snapshot:
            settings.save({'channel': 'My_Channel', 'replacements': {'party': 'https://example.com/party.gif'}})
            result = settings.save({'font_size': 20})
            self.assertEqual(result['channel'], 'my_channel')
            self.assertEqual(result['replacements']['party'], 'https://example.com/party.gif')
            self.assertEqual(snapshot.call_count, 2)
            original = settings.PATH.read_bytes()
            for patch_data in ({'replacements': {'x': 'javascript:alert(1)'}}, {'max_messages': 900}, {'motion': 'false'}, {'channel': '../../x'}, {'replacements': {'two\nwords': 'https://x/a.gif'}}, {'hidden_users': 'nightbot'}, {'max_stickers': 0}):
                with self.assertRaises(ValueError):
                    settings.save(patch_data)
                self.assertEqual(settings.PATH.read_bytes(), original)

    def test_personal_unknown_fields_and_phrases_survive_save(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(settings, 'PATH', Path(folder) / 'settings.json'), patch.object(settings.SettingsBackups, 'snapshot'):
            settings.PATH.write_text(json.dumps({'channel': 'my_channel', 'future_pref': {'keep': 42}}))
            result = settings.save({'replacements': {'let him cook': 'https://example.com/cook.webp'}})
            self.assertEqual(result['future_pref'], {'keep': 42})
            self.assertIn('let him cook', result['replacements'])
            settings.PATH.write_text('{ broken personal data')
            original = settings.PATH.read_bytes()
            with self.assertRaises(ValueError):
                settings.save({'font_size': 20})
            self.assertEqual(settings.PATH.read_bytes(), original)

    def test_pack_uses_available_assets_and_preserves_personal_aliases(self):
        personal = {'gg': 'https://personal.test/gg.gif'}
        result, added, missing = additions({'gg': {'url': 'https://cdn.test/gg.webp'}, 'PogU': {'url': 'https://cdn.test/pog.webp', 'zero_width': True}}, personal)
        self.assertEqual(result['gg'], personal['gg'])
        self.assertEqual(result['gg wp'], 'https://cdn.test/gg.webp')
        self.assertNotIn('clutch', result)
        self.assertIn('PogU', missing)
        self.assertNotIn('gg', added)

    def test_catalog_keeps_animated_files_and_zero_width_flags(self):
        parsed = _seven({'emotes': [{'name': 'Party', 'flags': 1, 'data': {'host': {'url': '//cdn.7tv.app/emote/x', 'files': [{'name': '2x.webp'}]}}}]})
        self.assertEqual(parsed['Party']['url'], 'https://cdn.7tv.app/emote/x/2x.webp')
        self.assertTrue(parsed['Party']['zero_width'])
        parsed = _ffz({'sets': {'1': {'emoticons': [{'name': 'Dance', 'urls': {'2': '//static/x.png'}, 'animated': {'2': '//static/x.gif'}}]}}})
        self.assertEqual(parsed['Dance']['url'], 'https://static/x.gif')

    @unittest.skipUnless(os.name == 'nt', 'Installed Windows desktop host')
    def test_legacy_host_uses_custom_mode_and_keeps_restorable_preferences(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            roaming = root / 'roaming' / 'TransparentTwitchChatWPF'
            installed = root / 'local' / 'TransparentTwitchChat' / 'current'
            roaming.mkdir(parents=True)
            (installed / 'browser').mkdir(parents=True)
            (installed / 'TransparentTwitchChatWPF.exe').touch()
            (installed / 'browser' / 'jchat.html').touch()
            original = [{'Name': 'GeneralSettings', 'Value': {'ChatType': 0, 'OutputVolume': .73, 'ToggleBordersHotkey': {'Key': 98, 'Modifiers': 3}}}]
            config = roaming / 'AppSettings.json'
            config.write_text(json.dumps(original))
            with patch.dict(os.environ, APPDATA=str(root / 'roaming'), LOCALAPPDATA=str(root / 'local')), patch('lib.chat_overlay.desktop.psutil.process_iter', return_value=[]), patch('lib.chat_overlay.desktop.subprocess.Popen'), patch('lib.chat_overlay.desktop.SettingsBackups.snapshot'):
                activate(7420)
            current = json.loads(config.read_text())[0]['Value']
            self.assertEqual(current['ChatType'], 2)  # 3 is discontinued JChat on this version.
            self.assertFalse(current['AllowInteraction'])
            self.assertEqual(current['OutputVolume'], .73)
            self.assertEqual(current['ToggleBordersHotkey'], {'Key': 98, 'Modifiers': 3})
            backup = next((root / 'local' / 'StreamingHub' / 'desktop-chat-backups').glob('*/AppSettings.json'))
            self.assertEqual(json.loads(backup.read_text()), original)


if __name__ == '__main__':
    unittest.main()
