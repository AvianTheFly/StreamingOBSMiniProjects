"""Collection migration and group transport preserve independent user state."""
import copy
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from obs.containers import container_items
from obsws_python.error import OBSSDKRequestError
from tools.organize_obs_collection import reorganize
from tools.test_lobby_layout import LayerOBS
from lib.coordination.lobbies import LobbyCatalog
from lib.coordination.scenes import SceneDirector


def source(name, kind='scene', children=()):
    return dict(name=name, uuid=name+'-uuid', id=kind, versioned_id=kind,
                settings={'items':[dict(name=n, source_uuid=n+'-uuid', id=i,
                                       visible=True, pos={'x':15+i,'y':20},
                                       crop_left=7, private_settings={'personal':'yes'})
                                   for i,n in enumerate(children)], 'id_counter':50},
                filters=[{'name':'personal mask','enabled':True,'settings':{'strength':.7}}],
                volume=.42, hotkeys={'OBSBasic.SelectScene':[]}, personal={'keep':True})


def collection():
    rows=[source('Lobbies',children=('ReefLobby','ForgeLobby','Personal overlay')),
          source('ScreenCaptureMAPHUD',children=('LeagueHUD2',)),
          source('Test',children=('ScreenCaptureMAPHUD',)),
          source('ReefLobby',children=('Reef art',)),
          source('ForgeLobby',children=('Forge art',)),
          source('LeagueHUD2',children=('teammatehud2',)),
          source('teammatehud2','monitor_capture'),
          source('Hub Spirit QA 123 0',children=('Hub Spirit QA 123 0 color',)),
          source('Hub Spirit QA 123 0 color','color_source'),
          source('Personal QA scene')]
    return dict(name='personal',sources=rows,groups=[],resolution={'x':1920,'y':1080},
                scene_order=[{'name':r['name']} for r in rows if r['id']=='scene'],
                current_scene='LeagueHUD2',current_program_scene='LeagueHUD2',
                transitions=[{'custom':'keep'}],private={'keep':12})


class OrganizationTests(unittest.TestCase):
    def test_migration_is_detached_lossless_and_idempotent(self):
        original=collection(); before=copy.deepcopy(original)
        candidate,report=reorganize(original)
        self.assertEqual(original,before)
        self.assertEqual(set(report['converted_groups']),{'ReefLobby','ForgeLobby','LeagueHUD2'})
        for group in candidate['groups']:
            expected=copy.deepcopy(next(s for s in original['sources'] if s['name']==group['name']))
            expected.update(id='group',versioned_id='group')
            expected['settings'].update(custom_size=True,cx=1920,cy=1080)
            self.assertEqual(group,expected)
        self.assertEqual(candidate['current_program_scene'],'ScreenCaptureMAPHUD')
        self.assertIn('Personal QA scene',[s['name'] for s in candidate['sources']])
        self.assertEqual(candidate['transitions'],original['transitions'])
        again,report=reorganize(candidate)
        self.assertEqual(again,candidate);self.assertEqual(report['converted_groups'],[])

    def test_nesting_and_bound_scene_hotkeys_reject_before_mutation(self):
        for change in ('nesting','hotkey'):
            d=collection()
            if change=='nesting':d['groups']=[source('Other','group',('ReefLobby',))]
            else:d['sources'][3]['hotkeys']['OBSBasic.SelectScene']=[{'key':'OBS_KEY_F1'}]
            before=copy.deepcopy(d)
            with self.assertRaises(ValueError):reorganize(d)
            self.assertEqual(d,before)

    def test_only_matching_unfiltered_monitor_links_are_shared(self):
        d=collection(); old=source('teammatehud1','monitor_capture')
        shared=next(s for s in d['sources'] if s['name']=='teammatehud2')
        for s in (old,shared):s['settings']['monitor_id']='one-monitor';s['filters']=[]
        d['sources'].append(old)
        hud=next(s for s in d['sources'] if s['name']=='LeagueHUD2')
        hud['settings']['items'][0].update(name='teammatehud1',source_uuid=old['uuid'])
        before=copy.deepcopy(old)
        result,report=reorganize(d)
        item=next(g for g in result['groups'] if g['name']=='LeagueHUD2')['settings']['items'][0]
        self.assertEqual(item['name'],'teammatehud2');self.assertEqual(item['crop_left'],7)
        self.assertEqual(next(s for s in result['sources'] if s['name']=='teammatehud1'),before)
        self.assertEqual(len(report['shared_capture_links']),1)
        retired=next(g for g in result['groups'] if g['name']=='Retired HUD captures')
        self.assertFalse(retired['settings']['items'][0]['visible'])
        self.assertEqual(retired['settings']['items'][0]['name'],'teammatehud1')
        repeated,_=reorganize(result)
        self.assertEqual(repeated,result)
        old['filters']=[{'enabled':True,'name':'personal'}]
        _,report=reorganize(d);self.assertEqual(report['shared_capture_links'],[])

    def test_group_adapter_does_not_swallow_missing_or_transport_errors(self):
        client=Mock();client.get_scene_item_list.side_effect=OBSSDKRequestError('GetSceneItemList',602,'group')
        response=SimpleNamespace(scene_items=[{'sourceName':'one capture'}])
        client.get_group_scene_item_list.return_value=response
        self.assertIs(container_items(client,'World'),response)
        for error in (OBSSDKRequestError('GetSceneItemList',600,'missing'),ConnectionError()):
            client.reset_mock();client.get_scene_item_list.side_effect=error
            with self.assertRaises(type(error)):container_items(client,'World')
            client.get_group_scene_item_list.assert_not_called()

    def test_saved_group_destination_resolves_only_after_intent_acceptance(self):
        client=LayerOBS()
        client.get_scene_list=lambda:SimpleNamespace(scenes=[{'sceneName':'Host'},{'sceneName':'Lobbies'}])
        catalog=LobbyCatalog()
        catalog.publish('feature','Lobbies',['WorldLobby','OtherLobby'],
                        layouts={'WorldLobby':{'layers':[]}})
        director=SceneDirector(lambda:client)
        with patch('lib.coordination.lobbies.lobby_catalog',catalog):
            stale=director.snapshot()['manual_revision']
            director.request('Manual',owner='user',automatic=False)
            before=copy.deepcopy(client.writes)
            self.assertFalse(director.request('WorldLobby',owner='old',expected_manual_revision=stale))
            self.assertEqual(client.writes,before)
            lease=director.reserve('replay','Replay','Test');director.activate(lease)
            before=copy.deepcopy(client.writes)
            self.assertFalse(director.request('WorldLobby',owner='return',defer=True))
            self.assertEqual(client.writes,before)
            director.finish(lease)
            self.assertEqual(client.scene,'Lobbies')
            self.assertTrue(client.find('Lobbies',1)['sceneItemEnabled'])
            self.assertFalse(client.find('Lobbies',2)['sceneItemEnabled'])


if __name__=='__main__':unittest.main()
