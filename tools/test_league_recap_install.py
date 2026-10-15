"""Automatic recap shares the media frame; reruns retain the retired placement."""
import copy
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from league_stats.obs_presentation import install, SOURCE, SCENE, URL
from lib.display_capture import CAPTURE_SCENE


class Client:
    def __init__(self):
        self.inputs={SOURCE+' Auto':dict(url=URL+'?stream=1',width=960,height=540),
                     SOURCE+' Review':dict(url=URL,width=960,height=540)}
        self.rows={'Lobbies':[self.item(SOURCE+' Auto',0,dict(positionX=591,positionY=305,scaleX=.9))],
                   CAPTURE_SCENE:[self.item('Udyr',0),self.item('Other display',1)],
                   SCENE:[self.item(SOURCE+' Review',0,dict(positionX=11,positionY=22,scaleX=2))]}
        self.writes=[]

    def item(self,name,index,transform=None):
        return dict(sourceName=name,sceneItemId=index+1,sceneItemIndex=index,
                    sceneItemEnabled=True,sceneItemLocked=True,sceneItemTransform=transform or {})

    def get_scene_list(self):
        return SimpleNamespace(scenes=[dict(sceneName=name) for name in self.rows])

    def send(self,command,body,raw):
        if command=='GetInputList':
            return dict(inputs=[dict(inputName=name,inputKind='browser_source') for name in self.inputs])
        if command=='GetInputSettings':return dict(inputSettings=copy.deepcopy(self.inputs[body['inputName']]))
        if command=='GetSceneItemList':return dict(sceneItems=copy.deepcopy(self.rows[body['sceneName']]))
        self.writes.append((command,body))
        rows=self.rows[body['sceneName']]
        if command=='CreateSceneItem':rows.append(self.item(body['sourceName'],len(rows)));return {}
        item=next(row for row in rows if row['sceneItemId']==body['sceneItemId'])
        field={'SetSceneItemTransform':'sceneItemTransform','SetSceneItemEnabled':'sceneItemEnabled',
               'SetSceneItemLocked':'sceneItemLocked','SetSceneItemIndex':'sceneItemIndex'}[command]
        item[field]=copy.deepcopy(body[field]);return {}


class InstallTests(unittest.TestCase):
    def test_nested_recap_tracks_every_parent_frame_and_reinstall_is_idempotent(self):
        client=Client()
        original=copy.deepcopy(client.rows['Lobbies'][0]['sceneItemTransform'])
        review=copy.deepcopy(client.rows[SCENE])
        with patch('league_stats.obs_presentation.SettingsBackups') as backup:
            result=install(client,'Lobbies')
            backup.return_value.snapshot.assert_called_once()
            nested=client.rows[CAPTURE_SCENE][-1]
            self.assertEqual(result['automatic_scene'],CAPTURE_SCENE)
            self.assertEqual(nested['sceneItemTransform']['boundsWidth'],1920)
            self.assertEqual(nested['sceneItemTransform']['boundsHeight'],1080)
            self.assertEqual(nested['sceneItemTransform']['positionX'],0)
            self.assertTrue(nested['sceneItemEnabled'])
            self.assertFalse(client.rows['Lobbies'][0]['sceneItemEnabled'])
            self.assertEqual(client.rows['Lobbies'][0]['sceneItemTransform'],original)
            self.assertEqual(client.rows[SCENE],review)
            writes=len(client.writes)
            install(client,'Lobbies')
            self.assertEqual(len(client.writes),writes)
