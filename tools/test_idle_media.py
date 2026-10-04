"""Offline regressions for source dormancy; no OBS or media is launched."""
import copy
import unittest
from unittest.mock import patch

from obs import media as interaction
from tools.repair_idle_obs_media import repair_idle_sources


class IdleMediaTests(unittest.TestCase):
    def source(self, name):
        return dict(id='ffmpeg_source', name=name, uuid=name + '-uuid',
                    volume=0.37, filters=[{'name': 'my filter'}],
                    settings=dict(local_file='personal.mp4', restart_on_activate=False,
                                  close_when_inactive=False, speed_percent=90))

    def test_only_idle_flags_change_and_repair_is_idempotent(self):
        source = self.source('hidden')
        collection = {'sources': [source], 'groups': []}
        expected = copy.deepcopy(collection)
        expected['sources'][0]['settings'].update(restart_on_activate=True, close_when_inactive=True)
        self.assertEqual(repair_idle_sources(collection), ['hidden'])
        self.assertEqual(collection, expected)
        self.assertEqual(repair_idle_sources(collection), [])

    def test_visible_references_in_scenes_groups_and_projectors_are_preserved(self):
        sources = [self.source(name) for name in ('scene', 'group', 'projector', 'unknown')]
        collection = dict(sources=sources + [dict(settings=dict(items=[
            dict(name='scene', visible=True), dict(name='unknown')]))],
            groups=[dict(settings=dict(items=[dict(source_uuid='group-uuid', visible=True)]))],
            saved_projectors=[dict(name='projector')])
        original = copy.deepcopy(collection)
        self.assertEqual(repair_idle_sources(collection), [])
        self.assertEqual(collection, original)

    def test_hidden_references_eligible_but_network_and_browser_are_not(self):
        hidden, network, browser = [self.source(name) for name in ('hidden', 'network', 'browser')]
        network['settings']['is_local_file'] = False
        browser['id'] = 'browser_source'
        collection = dict(sources=[hidden, network, browser], groups=[dict(id='group', settings=dict(items=[
            dict(name='hidden', visible=False)]))])
        self.assertEqual(repair_idle_sources(collection), ['hidden'])
        self.assertFalse(network['settings']['restart_on_activate'])
        self.assertFalse(browser['settings']['restart_on_activate'])

    def test_filter_and_source_mirror_dependencies_are_preserved(self):
        collection = dict(sources=[self.source('texture'), self.source('mirror'), dict(
            id='custom_source', settings={'source': 'mirror'},
            filters=[{'settings': {'texture_source': 'texture'}}])])
        original = copy.deepcopy(collection)
        self.assertEqual(repair_idle_sources(collection), [])
        self.assertEqual(collection, original)

    def test_parking_always_stops_and_hides_even_if_settings_fail(self):
        with patch.object(interaction, 'configure_media_source_properties', side_effect=RuntimeError), \
             patch.object(interaction, 'stop_media') as stop, \
             patch.object(interaction, 'hide_source') as hide:
            with self.assertRaises(RuntimeError):
                interaction.park_media_source('scene', 'player')
            stop.assert_called_once_with('player')
            hide.assert_called_once_with('scene', 'player')

    def test_parking_uses_both_idle_flags_without_overwriting_user_settings(self):
        with patch.object(interaction, 'configure_media_source_properties') as configure, \
             patch.object(interaction, 'stop_media'), patch.object(interaction, 'hide_source'):
            interaction.park_media_source('scene', 'player')
        configure.assert_called_once_with('player', restart_on_activate=True, close_when_inactive=True)


if __name__ == '__main__':
    unittest.main()
