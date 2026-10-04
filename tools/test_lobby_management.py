"""Personal settings, replacement discovery and persistent native lobby layers."""
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch
from lib.paths import ensure_import_paths
ensure_import_paths()
from scene_voice_switcher import inventory, layouts, presentation, settings
from lib.coordination.lobbies import LobbyCatalog
from lib.display_capture import CAPTURE_SCENE

class LobbyManagementTests(unittest.TestCase):
    def test_specific_voice_names_win_over_common_spirit_alias(self):
        from scene_voice_switcher.commands import _match_lobbies_source
        names={'Spirit Afterparty':['spirit','afterparty','spirit afterparty'],
               'SpiritRailLobby':['spirit','railway','spirit railway'],
               'SpiritArcadeLobby':['spirit','arcade','spirit arcade']}
        for text,expected in [('spirit arcade','SpiritArcadeLobby'),
                              ('take us to spirit railway','SpiritRailLobby'),
                              ('afterparty','Spirit Afterparty')]:
            self.assertEqual(_match_lobbies_source(text,names),expected)
        self.assertIsNone(_match_lobbies_source('spirit',names))

    def test_passage_installation_only_adds_its_script_and_keeps_personal_choices(self):
        from scene_voice_switcher.passage_installation import patch_collection
        original={'sources':[{'name':'Camera','settings':{'personal':17}}],
            'current_transition':'My transition','modules':{'other':'keep','scripts-tool':[
                {'path':'C:/personal.lua','settings':{'volume':.37}}]}}
        installed=patch_collection(original,'C:/passages.lua')
        self.assertEqual(installed['sources'],original['sources'])
        self.assertEqual(installed['current_transition'],'My transition')
        self.assertEqual(installed['modules']['scripts-tool'][0],original['modules']['scripts-tool'][0])
        installed['modules']['scripts-tool'][1]['settings']['style']='embers'
        self.assertEqual(patch_collection(installed,'C:/passages.lua'),installed)
        self.assertEqual(len(original['modules']['scripts-tool']),1)

    def setUp(self):
        self.folder=tempfile.TemporaryDirectory(); self.addCleanup(self.folder.cleanup)
        self.path=Path(self.folder.name)/'preferences.json'

    def test_passage_upgrade_covers_new_worlds_without_replacing_personal_settings(self):
        from scene_voice_switcher.passage_installation import patch_collection
        saved={'modules':{'scripts-tool':[{'path':'C:/passages.lua','settings':{
            'locations':'PersonalLobby|ForgeLobby','style':'gates','duration':1200,
            'personal_extension':{'keep':9}}}]}}
        updated=patch_collection(saved,'C:/passages.lua')
        settings=updated['modules']['scripts-tool'][0]['settings']
        self.assertEqual(settings['style'],'gates');self.assertEqual(settings['duration'],1200)
        self.assertEqual(settings['personal_extension'],{'keep':9})
        self.assertTrue(settings['locations'].startswith('PersonalLobby|ForgeLobby|'))
        self.assertEqual(set(settings['locations'].split('|')),{'PersonalLobby',*layouts.LAYOUTS})
        self.assertEqual(saved['modules']['scripts-tool'][0]['settings']['locations'],'PersonalLobby|ForgeLobby')
        self.assertEqual(patch_collection(updated,'C:/passages.lua'),updated)
        saved['modules']['scripts-tool'][0]['settings']['locations']={'malformed':'preserve'}
        with self.assertRaises(ValueError):patch_collection(saved,'C:/passages.lua')
        self.assertEqual(saved['modules']['scripts-tool'][0]['settings']['locations'],{'malformed':'preserve'})

    def test_rotation_and_layout_edits_keep_unknown_personal_data(self):
        self.path.write_text(json.dumps({'future':{'keep':7},'locations':{
            'ForgeLobby':{'personal_note':'leave me','chat':[10,20,300,400]}}}))
        saved=settings.save('ForgeLobby',{'rotation':False,'camera':[100,200,400,500]},
                            ['ForgeLobby','ReefLobby'],path=self.path)
        self.assertEqual(saved['future'],{'keep':7})
        self.assertEqual(saved['locations']['ForgeLobby']['personal_note'],'leave me')
        self.assertEqual(saved['locations']['ForgeLobby']['chat'],[10,20,300,400])
        self.assertEqual(settings.rotation(['ForgeLobby','ReefLobby'],saved),['ReefLobby'])

    def test_last_rotation_location_cannot_be_removed_or_invalid_rect_written(self):
        self.path.write_text('{"locations": {}, "personal": 42}')
        original=self.path.read_bytes()
        for changes in ({'rotation':False},{'camera':[0,0,2000,100]},
                        {'chat':[0,0,float('nan'),400]},{'screen':[True,0,100,100]}):
            with self.assertRaises(ValueError):
                settings.save('ForgeLobby',changes,['ForgeLobby'],path=self.path)
            self.assertEqual(self.path.read_bytes(),original)

    def test_malformed_preferences_are_never_replaced(self):
        self.path.write_text('{ my personal data')
        with self.assertRaises(ValueError):
            settings.save('ForgeLobby',{'rotation':True},['ForgeLobby'],path=self.path)
        self.assertEqual(self.path.read_text(),'{ my personal data')

    def test_original_lobbies_remain_fallback_until_replacement_is_installed(self):
        client=Mock()
        rows=[{'sourceName':name} for name in ('TavernLobby','FutureLobby','ForgeLobby')]
        client.get_scene_item_list.return_value=SimpleNamespace(scene_items=rows)
        with patch.object(inventory.obs,'get_obs',return_value=client):
            self.assertIn('TavernLobby',inventory._discover_lobbies())
            rows.append({'sourceName':'TavernWorldLobby'})
            discovered=inventory._discover_lobbies()
        self.assertNotIn('TavernLobby',discovered)
        self.assertIn('tavern lobby',discovered['TavernWorldLobby'])
        self.assertEqual(layouts.canonical('TavernLobby',discovered),'TavernWorldLobby')
        self.assertEqual(layouts.canonical('FutureLobby',discovered),'FutureLobby')

    def test_rotation_catalog_hides_disabled_and_original_presentations(self):
        catalog=LobbyCatalog()
        data={'locations':{'ForgeLobby':{'rotation':False}}}
        with patch.object(inventory,'lobby_catalog',catalog), patch.object(settings,'read',return_value=data):
            inventory.publish_inventory({'ForgeLobby':[],'TavernWorldLobby':[]})
        candidates,excluded=catalog.snapshot('Lobbies')
        self.assertEqual(candidates,('TavernWorldLobby',))
        self.assertIn('ForgeLobby',excluded); self.assertIn('TavernLobby',excluded)

    def test_slow_manual_lobby_lookup_cannot_overwrite_a_newer_scene_choice(self):
        from scene_voice_switcher import api, routing
        from lib.coordination.scenes import SceneDirector
        from tools.test_lobby_workflows import WorldOBS
        client=WorldOBS(); director=SceneDirector(lambda:client)
        def discover():
            director.request('Draft',owner='user',automatic=False)
            return {'ForgeLobby':[]}
        with patch.object(api,'scene_director',director),patch.object(routing,'scene_director',director), \
             patch.object(api,'_discover_lobbies',side_effect=discover),patch.object(api,'publish_inventory'), \
             patch.object(settings,'read',return_value={}):
            with self.assertRaisesRegex(ValueError,'superseded'): api.select_lobby('ForgeLobby')
        self.assertEqual(client.writes,[('scene','Draft')])

    def test_deferred_return_uses_rotation_at_acceptance_not_at_request(self):
        from scene_voice_switcher import routing
        from lib.coordination.scenes import SceneDirector
        from tools.test_lobby_workflows import WorldOBS
        client=WorldOBS(); director=SceneDirector(lambda:client)
        data={'locations':{'TavernLobby':{'rotation':False}}}
        lease=director.reserve('replay','InstantReplay','Test'); director.activate(lease)
        with patch.object(routing,'scene_director',director),patch.object(settings,'read',side_effect=lambda:data):
            applied,_=routing.show_lobby({'TavernLobby':[],'ForgeLobby':[],'StormCoastLobby':[]},automatic=True)
            self.assertFalse(applied)
            data['locations']['ForgeLobby']={'rotation':False}
            director.finish(lease)
        self.assertEqual(client.selected(),['StormCoastLobby'])

    def test_repair_reuses_camera_preserves_unknown_items_and_browser_is_native_size(self):
        art=Path(self.folder.name)
        for layer in ('base','foreground-cutout'):(art/f'forge-{layer}.png').write_bytes(b'art')
        names=('ForgeLobby Base',CAPTURE_SCENE,'FaceCamWithProps','ForgeLobby Foreground',
               'ForgeLobby Chat','Hub Lobby Chat','personal_overlay','ForgeLobby Living World')
        rows=[{'sourceName':n,'sceneItemId':i,'sceneItemEnabled':False} for i,n in enumerate(names)]
        client=Mock()
        client.get_scene_item_list.side_effect=lambda name: SimpleNamespace(scene_items=rows if name=='ForgeLobby' else [])
        spec={'screen':[100,200,600,300],'camera':[800,300,400,500],'chat':[1500,200,300,500],'rotation':True}
        with patch.object(presentation,'ART',art),patch.object(settings,'location',return_value=spec):
            presentation.restore(client,'ForgeLobby')
        browser=client.set_input_settings.call_args.args
        self.assertEqual(browser[0],'ForgeLobby Chat')
        self.assertEqual((browser[1]['width'],browser[1]['height']),(300,500))
        self.assertIn('?lobby=1',browser[1]['url'])
        self.assertNotIn(6,[call.args[1] for call in client.set_scene_item_transform.call_args_list])
        self.assertNotIn(6,[call.args[1] for call in client.set_scene_item_enabled.call_args_list])
        client.create_source_filter.assert_not_called(); client.set_current_program_scene.assert_not_called()
        cam=next(c.args[2] for c in client.set_scene_item_transform.call_args_list if c.args[1]==2)
        self.assertEqual(cam['boundsType'],'OBS_BOUNDS_SCALE_OUTER'); self.assertTrue(cam['cropToBounds'])

if __name__=='__main__': unittest.main()
