"""Manual effects target only the actual installed living lobby."""
import unittest
from unittest.mock import Mock, patch
from scene_voice_switcher import effects, api


class LobbyEffectTests(unittest.TestCase):
    def test_catalog_and_envelope_are_world_specific(self):
        rows=effects.catalog('ForgeLobby')
        self.assertEqual(rows['world'],'forge');self.assertGreater(len(rows['actions']),3)
        cue=effects.envelope('ForgeLobby',rows['actions'][0]['id'])
        self.assertEqual(cue['source'],'ForgeLobby');self.assertEqual(cue['world'],'forge')
        self.assertIn('issuedAt',cue)
        with self.assertRaises(ValueError):effects.envelope('SanctuaryLobby','not-an-effect')

    def test_no_catalog_for_unanimated_lobby(self):
        self.assertEqual(effects.catalog('Spirit Afterparty')['actions'],[])

    def test_stale_world_is_rejected_before_delivery(self):
        with patch('obs.get_obs',return_value=Mock()), \
             patch.object(api,'_discover_lobbies',return_value=['ForgeLobby','SanctuaryLobby']), \
             patch.object(api,'current_lobby',return_value='SanctuaryLobby'):
            with self.assertRaisesRegex(ValueError,'no longer on screen'):
                api.lobby_effect('ForgeLobby',effects.catalog('ForgeLobby')['actions'][0]['id'])

    def test_live_world_requires_its_installed_layer(self):
        action=effects.catalog('ForgeLobby')['actions'][0]['id']
        with patch('obs.get_obs',return_value=Mock()), \
             patch.object(api,'_discover_lobbies',return_value=['ForgeLobby']), \
             patch.object(api,'current_lobby',return_value='ForgeLobby'), \
             patch('obs.list_sources',return_value={}) as sources:
            with self.assertRaisesRegex(ValueError,'not installed'):api.lobby_effect('ForgeLobby',action)
            sources.return_value={'ForgeLobby Living World':4}
            self.assertEqual(api.lobby_effect('ForgeLobby',action)['action'],action)

    def test_next_lobby_avoids_current_and_preserves_fixed_preference(self):
        saved={'selection':{'mode':'fixed','source':'ForgeLobby'},'locations':{'Spirit Afterparty':{'rotation':False}}}
        with patch('obs.get_obs',return_value=Mock()), \
             patch.object(api,'_discover_lobbies',return_value=['ForgeLobby','SanctuaryLobby','Spirit Afterparty']), \
             patch.object(api,'current_lobby',return_value='ForgeLobby'), \
             patch.object(api.settings,'read',return_value=saved), \
             patch.object(api,'select_stage',return_value={'ok':True}) as show:
            api.next_lobby();show.assert_called_once_with('lobby','SanctuaryLobby')
        self.assertEqual(saved['selection'],{'mode':'fixed','source':'ForgeLobby'})

    def test_other_scenes_include_only_installed_presentations(self):
        client=Mock()
        client.get_current_program_scene.return_value.current_program_scene_name='Test'
        client.get_scene_item_list.return_value.scene_items=[]
        with patch('obs.get_obs',return_value=client), \
             patch('obs.list_scenes',return_value=['Test','Spirit Signoff','Internal Media Stage']), \
             patch.object(api,'_discover_lobbies',return_value=[]), \
             patch.object(api.settings,'selection',return_value={}), \
             patch.object(api,'screen_snapshot',return_value={}):
            self.assertEqual(api.locations()['other_scenes'],[{'scene':'Spirit Signoff','label':'Signoff'}])


if __name__=='__main__':unittest.main()
