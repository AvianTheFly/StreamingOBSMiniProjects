"""Published layout repair across manual/native/automatic entries and stale intent."""
import copy
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from lib.coordination.lobbies import LobbyCatalog, prepare_lobby
from lib.coordination.lobby_layout import apply_layout
from lib.coordination.scenes import SceneDirector


class LayerOBS:
    def __init__(self):
        self.scene='Test'; self.writes=[]
        self.rows={'Lobbies':[
            dict(sourceName='WorldLobby',sceneItemId=1,sceneItemEnabled=False),
            dict(sourceName='OtherLobby',sceneItemId=2,sceneItemEnabled=True),
            dict(sourceName='Personal alert',sceneItemId=3,sceneItemEnabled=True)],
            'WorldLobby':[
            dict(sourceName='World art',sceneItemId=4,sceneItemEnabled=True,sceneItemLocked=True,sceneItemTransform={'positionX':0}),
            dict(sourceName='Host',sceneItemId=5,sceneItemEnabled=False,sceneItemLocked=False,sceneItemTransform={'positionX':999}),
            dict(sourceName='Personal overlay',sceneItemId=6,sceneItemEnabled=True)]}
        self.inputs={'World art':{'file':'C:/personal-art.png'},'Chat':{'css':'personal','url':'old','width':1}}
    def get_scene_item_list(self,name):return SimpleNamespace(scene_items=copy.deepcopy(self.rows[name]))
    def get_input_list(self):return SimpleNamespace(inputs=[dict(inputName=n) for n in self.inputs])
    def get_scene_list(self):return SimpleNamespace(scenes=[dict(sceneName=n) for n in ['Host',*self.rows]])
    def get_input_settings(self,name):return SimpleNamespace(input_settings=copy.deepcopy(self.inputs[name]))
    def get_current_program_scene(self):return SimpleNamespace(current_program_scene_name=self.scene)
    def set_current_program_scene(self,name):self.scene=name;self.writes.append(('scene',name))
    def create_scene_item(self,owner,source,enabled):
        identifier=50+len(self.rows[owner]);self.rows[owner].append(dict(sourceName=source,sceneItemId=identifier,sceneItemEnabled=enabled));self.writes.append(('create',owner,source));return SimpleNamespace(scene_item_id=identifier)
    def find(self,owner,identifier):return next(r for r in self.rows[owner] if r['sceneItemId']==identifier)
    def set_scene_item_transform(self,owner,identifier,value):self.find(owner,identifier)['sceneItemTransform']=copy.deepcopy(value);self.writes.append(('transform',owner,identifier))
    def set_scene_item_enabled(self,owner,identifier,value):self.find(owner,identifier)['sceneItemEnabled']=value;self.writes.append(('enabled',owner,identifier,value))
    def set_scene_item_locked(self,owner,identifier,value):self.find(owner,identifier)['sceneItemLocked']=value;self.writes.append(('locked',owner,identifier))
    def set_scene_item_index(self,owner,identifier,index):row=self.find(owner,identifier);self.rows[owner].remove(row);self.rows[owner].insert(index,row);self.writes.append(('index',owner,identifier))
    def set_input_settings(self,name,value,overlay):self.inputs[name].update(value);self.writes.append(('settings',name,value))


class LobbyLayoutTests(unittest.TestCase):
    def setUp(self):
        self.client=LayerOBS()
        self.plan={'layers':[
            dict(source='World art',kind='image_source',settings={'file':'C:/default-art.png'},transform={'positionX':0}),
            dict(source='Host',transform={'positionX':10}),
            dict(source='Chat',kind='browser_source',configure=True,settings={'url':'local','width':300},transform={'positionX':100})]}
        self.catalog=LobbyCatalog();self.catalog.publish('feature','Lobbies',['WorldLobby','OtherLobby'],layouts={'WorldLobby':self.plan})
        patcher=patch('lib.coordination.lobbies.lobby_catalog',self.catalog);patcher.start();self.addCleanup(patcher.stop)
        patcher=patch('lib.coordination.lobby_layout.SettingsBackups');self.backups=patcher.start();self.addCleanup(patcher.stop)

    def test_repair_is_idempotent_preserves_personal_art_css_and_unowned_layers(self):
        original=copy.deepcopy(self.client.rows['WorldLobby'][-1])
        self.assertTrue(apply_layout(self.client,'WorldLobby',self.plan))
        self.assertEqual(self.client.inputs['World art']['file'],'C:/personal-art.png')
        self.assertEqual(self.client.inputs['Chat']['css'],'personal')
        self.assertEqual(self.client.rows['WorldLobby'][2],original)
        before=list(self.client.writes)
        self.assertFalse(apply_layout(self.client,'WorldLobby',self.plan))
        self.assertEqual(self.client.writes,before)
        self.backups.return_value.snapshot.assert_called_once()

    def test_catalog_publication_and_reads_are_detached_complete_generations(self):
        self.plan['layers'][1]['transform']['positionX']=999
        snapshot=self.catalog.layout('WorldLobby');self.assertEqual(snapshot['layers'][1]['transform']['positionX'],10)
        snapshot['layers'].clear();self.assertEqual(len(self.catalog.layout('WorldLobby')['layers']),3)
        self.catalog.publish('feature','Lobbies',['OtherLobby'])
        self.assertIsNone(self.catalog.layout('WorldLobby'))

    def test_missing_required_camera_rejects_before_visibility_or_scene_write(self):
        self.plan['layers'][1]['source']='Missing Camera'
        self.client.rows['WorldLobby']=[self.client.rows['WorldLobby'][0]]
        self.catalog.publish('feature','Lobbies',['WorldLobby'],layouts={'WorldLobby':self.plan})
        with self.assertRaisesRegex(ValueError,'Missing Camera'):
            prepare_lobby(self.client,'Lobbies',['WorldLobby'],selected='WorldLobby')
        self.assertEqual(self.client.writes,[])

    def test_automatic_entry_prepares_host_before_location_or_scene_appears(self):
        director=SceneDirector(lambda:self.client)
        director.request('Lobbies',owner='league',prepare=lambda c:prepare_lobby(c,'Lobbies',['WorldLobby'],selected='WorldLobby'))
        host=self.client.writes.index(('enabled','WorldLobby',5,True))
        visible=self.client.writes.index(('enabled','Lobbies',1,True))
        scene=self.client.writes.index(('scene','Lobbies'))
        self.assertLess(host,visible);self.assertLess(visible,scene)
        self.assertTrue(self.client.rows['Lobbies'][-1]['sceneItemEnabled'])

    def test_stale_and_deferred_entries_do_not_repair_before_acceptance(self):
        director=SceneDirector(lambda:self.client)
        revision=director.snapshot()['manual_revision']
        director.request('Manual',owner='user',automatic=False)
        before=list(self.client.writes)
        self.assertFalse(director.request('WorldLobby',owner='old',expected_manual_revision=revision))
        self.assertEqual(self.client.writes,before)
        lease=director.reserve('replay','Replay','Test');director.activate(lease)
        before=list(self.client.writes)
        self.assertFalse(director.request('WorldLobby',owner='return',defer=True))
        self.assertEqual(self.client.writes,before)
        director.finish(lease)
        self.assertTrue(self.client.find('WorldLobby',5)['sceneItemEnabled'])

    def test_direct_scene_and_native_observation_repair_without_competing_scene_write(self):
        director=SceneDirector(lambda:self.client)
        director.request('WorldLobby',owner='user',automatic=False)
        self.client.find('WorldLobby',5)['sceneItemEnabled']=False
        before=len([r for r in self.client.writes if r[0]=='scene'])
        director.observe('WorldLobby')
        self.assertTrue(self.client.find('WorldLobby',5)['sceneItemEnabled'])
        self.assertEqual(len([r for r in self.client.writes if r[0]=='scene']),before)


if __name__=='__main__':unittest.main()
