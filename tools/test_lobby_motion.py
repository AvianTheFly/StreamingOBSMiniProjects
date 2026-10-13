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
        self.assertTrue(spec['settings']['fps_custom'])

    def test_pilot_stacks_motion_after_painted_foreground_before_live_chat(self):
        data={'locations':{'ReefLobby':{'camera':[120,300,420,550],'extra_personal':'kept'}}}
        blueprint=plan('ReefLobby',data)
        sources=[e['source'] for e in blueprint['layers']]
        self.assertEqual(sources[-4:],['ReefLobby Foreground','Hub Display Capture','ReefLobby Living World','ReefLobby Chat'])
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
            self.assertEqual(sources[-4:],[predecessor,'Hub Display Capture',name+' Living World',name+' Chat'])
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

    def test_redesigned_backing_and_foreground_keep_media_and_personal_placement(self):
        from scene_voice_switcher.layouts import SPIRIT_ART, foreground, artwork
        for name in SPIRIT_ART:
            data={'locations':{name:{'camera':[1000,350,300,420],'extra_personal':'kept'}}}
            layers=plan(name,data)['layers']
            self.assertEqual(layers[0]['settings']['file'],str(artwork(name)))
            self.assertTrue(layers[0]['configure'])
            self.assertTrue(artwork(name).is_file())
            if name != 'AuroraCampLobby':
                self.assertTrue(foreground(name).is_file())
                self.assertEqual(next(p for p in layers if p['source']==name+' Foreground')['settings']['file'],str(foreground(name)))
            self.assertEqual(data['locations'][name]['extra_personal'],'kept')

    def test_distinct_foregrounds_match_authored_camera_and_current_plate(self):
        from PIL import Image
        import hashlib
        from scene_voice_switcher.layouts import SPIRIT_ART, foreground, artwork, ART, defaults
        for name in SPIRIT_ART:
            if name == 'AuroraCampLobby':
                continue
            with Image.open(foreground(name)) as new, Image.open(artwork(name)) as plate:
                expected=Image.new('L',new.size,255)
                x,y,w,h=defaults(name)['camera']
                expected.paste(0,(x,y,x+w,y+h))
                self.assertEqual(expected.tobytes(),new.getchannel('A').tobytes())
                records=json.loads((foreground(name).parent/'distinct-layer-provenance.json').read_text())
                record=next(r for r in records if Path(r['output']).name==foreground(name).name)
                self.assertEqual(hashlib.sha256(artwork(name).read_bytes()).hexdigest(),record['plateSha256'])
                self.assertEqual(hashlib.sha256(new.convert('RGB').tobytes()).hexdigest(),record['rgbSha256'])
