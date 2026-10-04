"""Resource preservation regressions for the standalone brand installer."""
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import copy
import unittest
from obsws_python.error import OBSSDKRequestError

from tools.install_channel_brand_obs import CARDS, install


class Client:
    def __init__(self):
        self.scenes = {'Personal lobby': [{'sourceName': 'Personal camera', 'sceneItemId': 10}]}
        self.inputs = {'Personal camera': 'dshow_input'}
        self.settings = {'Personal camera': {'device': 'keep-me'}}
        self.transforms = {10: {'positionX': 87, 'cropTop': 13}}
        self.locked = {10: False}
        self.calls = []
        self.active = False
        self.next_id = 11

    def get_stream_status(self): return SimpleNamespace(output_active=self.active)
    def get_record_status(self): return SimpleNamespace(output_active=False)
    def get_video_settings(self): return SimpleNamespace(base_width=2560, base_height=1440)
    def get_scene_list(self): return SimpleNamespace(scenes=[{'sceneName': s} for s in self.scenes])
    def get_input_list(self): return SimpleNamespace(inputs=[{'inputName': n, 'inputKind': k} for n, k in self.inputs.items()])
    def get_scene_item_list(self, scene):
        if scene not in self.scenes:
            raise OBSSDKRequestError('GetSceneItemList',600,'Source does not exist')
        return SimpleNamespace(scene_items=self.scenes[scene])
    def create_scene(self, name):
        self.calls.append(('scene', name)); self.scenes[name] = []
    def create_scene_item(self, scene, source, enabled):
        item = self.next_id; self.next_id += 1
        self.scenes[scene].append({'sourceName': source, 'sceneItemId': item, 'sceneItemEnabled': enabled})
        self.calls.append(('item', scene, source))
        return SimpleNamespace(scene_item_id=item)
    def create_input(self, scene, source, kind, settings, enabled):
        self.inputs[source] = kind; self.settings[source] = settings
        return self.create_scene_item(scene, source, enabled)
    def set_scene_item_transform(self, scene, item, transform): self.transforms[item] = transform.copy()
    def set_scene_item_locked(self, scene, item, locked): self.locked[item] = locked


class BrandInstallation(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.assets = Path(self.temp.name)
        for _, _, filename in CARDS: (self.assets / filename).write_bytes(b'fixture')
        self.client = Client()

    def test_existing_resources_and_personalized_rerun_are_preserved(self):
        camera = copy.deepcopy(self.client.scenes['Personal lobby'])
        install(self.client, self.assets)
        self.assertEqual(self.client.scenes['Personal lobby'], camera)
        self.assertEqual(self.client.transforms[10], {'positionX': 87, 'cropTop': 13})
        self.assertEqual(self.client.settings['Personal camera'], {'device': 'keep-me'})
        scene, source, _ = CARDS[0]
        item = self.client.scenes[scene][0]['sceneItemId']
        self.assertEqual(self.client.transforms[item]['boundsWidth'], 2560)
        self.assertTrue(self.client.settings[source]['unload'])
        self.client.settings[source] = {'file': 'my-new-art.png', 'unknown': 42}
        self.client.transforms[item] = {'positionX': 123, 'cropTop': 21}
        self.client.locked[item] = False
        self.client.scenes[scene][0]['sceneItemEnabled'] = False
        before = copy.deepcopy(self.client.__dict__)
        result = install(self.client, self.assets)
        self.assertEqual(self.client.__dict__, before)
        self.assertTrue(all(not row['created'] for row in result))

    def test_missing_asset_is_detected_before_mutation(self):
        (self.assets / CARDS[-1][2]).unlink()
        with self.assertRaises(FileNotFoundError): install(self.client, self.assets)
        self.assertEqual(self.client.calls, [])

    def test_active_output_blocks_changes(self):
        self.client.active = True
        with self.assertRaises(RuntimeError): install(self.client, self.assets)
        self.assertEqual(self.client.calls, [])

    def test_wrong_input_kind_is_detected_before_mutation(self):
        self.client.inputs[CARDS[-1][1]] = 'ffmpeg_source'
        with self.assertRaises(ValueError): install(self.client, self.assets)
        self.assertEqual(self.client.calls, [])

    def test_scene_name_collision_is_detected_before_mutation(self):
        self.client.inputs[CARDS[-1][0]] = 'browser_source'
        with self.assertRaises(ValueError): install(self.client, self.assets)
        self.assertEqual(self.client.calls, [])

    def test_existing_image_source_is_reused_without_resetting_its_settings(self):
        _, source, _ = CARDS[0]
        self.client.inputs[source] = 'image_source'
        self.client.settings[source] = {'file': 'personal-art.png', 'unknown': 'kept'}
        install(self.client, self.assets)
        self.assertEqual(self.client.settings[source], {'file': 'personal-art.png', 'unknown': 'kept'})

    def test_clean_audio_scene_is_shared_only_on_first_creation(self):
        self.client.scenes['Recording Audio - No Music'] = []
        install(self.client, self.assets)
        for scene, _, _ in CARDS:
            self.assertEqual(sum(r['sourceName'] == 'Recording Audio - No Music' for r in self.client.scenes[scene]), 1)
        self.client.scenes[CARDS[0][0]] = [r for r in self.client.scenes[CARDS[0][0]] if r['sourceName'] != 'Recording Audio - No Music']
        before = copy.deepcopy(self.client.__dict__)
        install(self.client, self.assets)
        self.assertEqual(self.client.__dict__, before)


if __name__ == '__main__':
    unittest.main()
