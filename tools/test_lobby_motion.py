"""Feature plan protection and finite web publication; no live scene writes."""
import json
from pathlib import Path
import unittest
import urllib.parse
from lib.paths import ensure_import_paths
ensure_import_paths()
from scene_voice_switcher.motion import layer,WORLDS
from scene_voice_switcher.presentation import plan
from scene_voice_switcher.layouts import LAYOUTS


class MotionTests(unittest.TestCase):
    def test_pilot_uses_personal_apertures_and_document_lifetime(self):
        custom={'screen':[600,140,800,370],'camera':[20,290,450,510],'chat':[1500,350,300,520]}
        spec=layer('ReefLobby',custom)
        query=urllib.parse.parse_qs(urllib.parse.urlsplit(spec['settings']['url']).query)
        self.assertEqual(json.loads(query['holes'][0]),list(custom.values()))
        self.assertTrue(spec['settings']['shutdown'])
        self.assertTrue(spec['settings']['restart_when_active'])
        self.assertEqual(spec['settings']['fps'],24)

    def test_pilot_stacks_motion_after_painted_foreground_before_live_chat(self):
        data={'locations':{'ReefLobby':{'camera':[120,300,420,550],'extra_personal':'kept'}}}
        blueprint=plan('ReefLobby',data)
        sources=[e['source'] for e in blueprint['layers']]
        self.assertEqual(sources[-3:],['ReefLobby Foreground','ReefLobby Living World','ReefLobby Chat'])
        self.assertEqual(blueprint['layers'][0]['kind'],'image_source')
        self.assertIn('reef-base.png',blueprint['layers'][0]['settings']['file'])
        self.assertEqual(data['locations']['ReefLobby']['extra_personal'],'kept')
        for name in LAYOUTS:
            if name not in WORLDS:
                self.assertIsNone(layer(name,{}))

    def test_every_ready_world_keeps_original_art_and_protected_live_placement(self):
        from scene_voice_switcher.layouts import defaults,FLAT_LOCATIONS
        for name in WORLDS:
            blueprint=plan(name,{})
            layers=blueprint['layers'];sources=[item['source'] for item in layers]
            predecessor='FaceCamWithProps' if name in FLAT_LOCATIONS else name+' Foreground'
            self.assertEqual(sources[-3:],[predecessor,name+' Living World',name+' Chat'])
            self.assertEqual(layers[0]['kind'],'image_source')
            query=urllib.parse.parse_qs(urllib.parse.urlsplit(layers[-2]['settings']['url']).query)
            self.assertEqual(json.loads(query['holes'][0]),[defaults(name)[key] for key in ('screen','camera','chat')])

    def test_generated_files_match_their_declared_owners(self):
        root=Path(__file__).resolve().parents[1]
        target=root/'hub_ui/app/lobby-motion'
        import hashlib
        for name,item in json.loads((target/'build.json').read_text(encoding='utf-8')).items():
            self.assertEqual(hashlib.sha256((target/name).read_bytes()).hexdigest(),item['sha256'])
            self.assertEqual((target/name).read_bytes(),(root/item['source']).read_bytes())
