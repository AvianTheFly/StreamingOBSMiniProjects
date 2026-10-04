"""Personal-resource preservation for the additive spirit lobby installer."""
import copy
import unittest
from tools.test_channel_brand import Client
from tools.install_spirit_lobby_obs import install, install_camera_stage, validate_url, layer_url, SCENE, SOURCE, FOREGROUND, CAMERA
from types import SimpleNamespace


class CameraClient(Client):
    def get_input_settings(self, source):
        return SimpleNamespace(input_settings=self.settings[source])

    def set_input_settings(self, source, settings, overlay):
        self.settings[source].update(settings)


class SpiritLobbyInstallation(unittest.TestCase):
    def test_camera_stage_preserves_camera_and_customized_rerun(self):
        client = CameraClient()
        client.scenes[CAMERA] = [{'sourceName': 'Personal camera', 'sceneItemId': 10}]
        original = copy.deepcopy(client.scenes[CAMERA])
        install(client)
        client.settings[SOURCE]['unknown'] = 42
        install_camera_stage(client)
        self.assertEqual(client.scenes[CAMERA], original)
        self.assertEqual(client.transforms[10], {'positionX': 87, 'cropTop': 13})
        self.assertEqual(client.settings['Personal camera'], {'device': 'keep-me'})
        self.assertEqual(client.settings[SOURCE]['unknown'], 42)
        self.assertIn('layer=background', client.settings[SOURCE]['url'])
        self.assertIn('layer=foreground', client.settings[FOREGROUND]['url'])
        self.assertEqual([r['sourceName'] for r in client.scenes[SCENE]], [SOURCE, CAMERA, FOREGROUND])
        camera = next(r['sceneItemId'] for r in client.scenes[SCENE] if r['sourceName'] == CAMERA)
        client.transforms[camera] = {'positionX': 901, 'cropTop': 26}
        before = copy.deepcopy(client.__dict__)
        install_camera_stage(client)
        self.assertEqual(client.__dict__, before)

    def test_camera_preflight_rejects_before_mutation(self):
        for collision in ['missing-camera', 'wrong-kind', 'active']:
            client = CameraClient()
            install(client)
            if collision != 'missing-camera': client.scenes[CAMERA] = []
            if collision == 'wrong-kind': client.inputs[FOREGROUND] = 'image_source'
            if collision == 'active': client.active = True
            before = copy.deepcopy(client.__dict__)
            with self.assertRaises((ValueError, RuntimeError)): install_camera_stage(client)
            self.assertEqual(client.__dict__, before)

    def test_layer_urls_preserve_mood_and_unknown_parameters(self):
        url = 'http://localhost:7420/spirit-lobby/index.html?title=MY+SIGN&extra=42&layer=full&cameraGuide=1'
        self.assertEqual(layer_url(url, 'foreground'), 'http://localhost:7420/spirit-lobby/index.html?title=MY+SIGN&extra=42&layer=foreground')
    def test_existing_data_and_personalized_rerun_are_preserved(self):
        client = Client()
        original = copy.deepcopy(client.scenes['Personal lobby'])
        install(client)
        self.assertEqual(client.scenes['Personal lobby'], original)
        self.assertEqual(client.transforms[10], {'positionX': 87, 'cropTop': 13})
        self.assertEqual(client.settings['Personal camera'], {'device': 'keep-me'})
        self.assertTrue(client.settings[SOURCE]['shutdown'])
        self.assertEqual(client.settings[SOURCE]['fps'], 30)
        client.settings[SOURCE] = {'url': 'my-personal-url', 'unknown': 42}
        item = client.scenes[SCENE][-1]['sceneItemId']
        client.transforms[item] = {'positionX': 137, 'cropTop': 7}
        client.locked[item] = False
        client.scenes[SCENE][-1]['sceneItemEnabled'] = False
        before = copy.deepcopy(client.__dict__)
        self.assertFalse(install(client)['created'])
        self.assertEqual(client.__dict__, before)

    def test_active_output_and_name_collisions_reject_before_mutation(self):
        for collision in ['active', 'source-kind', 'scene-input', 'source-scene']:
            with self.subTest(collision=collision):
                client = Client()
                if collision == 'active': client.active = True
                if collision == 'source-kind': client.inputs[SOURCE] = 'image_source'
                if collision == 'scene-input': client.inputs[SCENE] = 'browser_source'
                if collision == 'source-scene': client.scenes[SOURCE] = []
                before = copy.deepcopy(client.__dict__)
                with self.assertRaises((ValueError, RuntimeError)): install(client)
                self.assertEqual(client.__dict__, before)

    def test_existing_browser_source_and_clean_audio_are_reused(self):
        client = Client()
        client.scenes['Recording Audio - No Music'] = []
        client.inputs[SOURCE] = 'browser_source'
        client.settings[SOURCE] = {'url': 'keep-personal', 'unknown': 'yes'}
        install(client)
        self.assertEqual(client.settings[SOURCE], {'url': 'keep-personal', 'unknown': 'yes'})
        self.assertEqual(client.scenes[SCENE][0]['sourceName'], 'Recording Audio - No Music')
        self.assertEqual(client.transforms[client.scenes[SCENE][-1]['sceneItemId']]['boundsWidth'], 2560)

    def test_url_scope_is_local_hub_overlay_only(self):
        self.assertEqual(validate_url('http://localhost:7420/spirit-lobby/index.html?title=HI'), 'http://localhost:7420/spirit-lobby/index.html?title=HI')
        for url in ['https://example.com/', 'http://localhost:7420/api/settings', 'http://user:pass@127.0.0.1:7420/spirit-lobby/index.html']:
            with self.assertRaises(ValueError): validate_url(url)


if __name__ == '__main__':
    unittest.main()
