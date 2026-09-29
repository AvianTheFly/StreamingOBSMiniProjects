"""Expanded catalog contracts: honest signals, settings migration and ending shows."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from .engine import Engine, defaults
from .production import ProductionDirector, ProductionSettings
from .production.config import DEFAULTS, validate
from .production.catalog import CATALOG, manifest, show_for
from .test_engine import snapshot, event


class BorderCatalogTests(unittest.TestCase):
    def setUp(self):
        self.now=[0];self.settings=copy.deepcopy(DEFAULTS);self.settings['enabled']=True
        self.director=ProductionDirector(self.settings,lambda:self.now[0])

    def test_every_builtin_has_a_bounded_preview_and_valid_category(self):
        self.assertEqual(set(CATALOG),set(defaults()['events']))
        for key in CATALOG:
            self.director.preview(key);show=self.director.snapshot()['effect']
            self.assertTrue(.6<=show['duration']<=5,key)
            self.assertIn(show['theme'],{'earth','fire','water','air','hextech','chemtech','elder','gold','void','blood','mint','cyan','ash','arcane'})
        self.assertEqual(len(manifest(self.settings)),58)

    def test_common_events_have_cooldowns_and_major_plays_bypass_minor_spacing(self):
        emit=lambda key:[{'key':key,'confidence':'observed'}]
        self.director.ingest(snapshot(),emit('kill'));first=self.director.snapshot()['effect']['id']
        self.now[0]=.2;self.director.ingest(snapshot(),emit('kill'))
        self.assertEqual(self.director.snapshot()['effect']['id'],first)
        self.now[0]=.3;self.director.ingest(snapshot(),emit('baron'))
        self.assertEqual(self.director.snapshot()['effect']['kind'],'void')
        self.now[0]=5;self.director.ingest(snapshot(),emit('kill'))
        self.assertEqual(self.director.snapshot()['effect']['key'],'kill')
        self.assertLessEqual(len(self.director.history),40)

    def test_end_animation_survives_cumulative_gameend_without_replay(self):
        engine=Engine({**defaults(),'overlay_enabled':False},lambda:self.now[0],self.settings)
        engine.ingest(snapshot())
        data=snapshot(101,[event(1,'GameEnd',101,Result='Win')]);engine.ingest(data)
        show=engine.production.snapshot()['effect'];self.assertEqual(show['key'],'victory')
        self.now[0]=1;engine.ingest(data)
        self.assertEqual(engine.production.snapshot()['effect']['id'],show['id'])
        self.now[0]=6;engine.ingest(data);self.assertIsNone(engine.production.snapshot()['effect'])
        engine.ingest(data,baseline=True);self.assertIsNone(engine.production.snapshot()['effect'])

    def test_real_game_start_can_show_but_joining_history_is_silent(self):
        engine=Engine(clock=lambda:self.now[0],production_settings=self.settings)
        engine.ingest(snapshot(1,[event(0,'GameStart',0)]))
        self.assertEqual(engine.production.snapshot()['effect']['key'],'game_start')
        other=Engine(production_settings=self.settings)
        other.ingest(snapshot(100,[event(0,'GameStart',0)]));self.assertIsNone(other.production.snapshot()['effect'])

    def test_signals_are_opt_in_and_keep_their_uncertainty(self):
        candidate={'key':'possible_combat','confidence':'possible'}
        self.director.ingest(snapshot(),[candidate]);self.assertIsNone(self.director.snapshot()['effect'])
        self.director.configure({**self.settings,'inferred':True});self.director.ingest(snapshot(),[candidate])
        self.assertEqual(self.director.snapshot()['effect']['confidence'],'possible')
        self.assertIn('SIGNAL',self.director.snapshot()['effect']['title'])

    def test_per_event_controls_categories_custom_rules_and_preview(self):
        settings={**self.settings,'combat':False,'event_options':{'kill':{'enabled':True,'intensity':.4,'duration':.8}}}
        self.assertIsNone(show_for({'key':'kill'},settings))
        show=show_for({'key':'kill'},settings,preview=True)
        self.assertEqual(show['intensity'],.4);self.assertEqual(show['duration'],.8)
        settings['combat']=True;settings['event_options']['kill']['enabled']=False
        self.assertIsNone(show_for({'key':'kill'},settings))
        key='custom_123';self.assertIsNone(show_for({'key':key},settings))
        settings['event_options'][key]={'enabled':True}
        self.assertEqual(show_for({'key':key,'title':'My health rule'},settings)['title'],'My health rule')

    def test_old_settings_keep_latest_values_and_new_controls_are_independent(self):
        with tempfile.TemporaryDirectory() as folder,patch('lib.settings_backups.SettingsBackups.snapshot'):
            path=Path(folder)/'production.json';path.write_text(json.dumps({'revision':8,'enabled':True,'opacity':.55,'edge_width':40,'burst_seconds':1.5,'spacing_seconds':7}))
            store=ProductionSettings(path);loaded=store.load()
            self.assertEqual(loaded['opacity'],.55);self.assertEqual(loaded['spacing_seconds'],7)
            self.assertFalse(loaded['inferred']);self.assertTrue(loaded['survival'])
            saved=store.save(loaded,{'revision':8,'settings':{'event_options':{'kill':{'duration':.8}}}})
            self.assertEqual(saved['opacity'],.55);self.assertEqual(store.load(),saved)
        for options in [{'unknown':{}},{'kill':{'enabled':'yes'}},{'kill':{'duration':float('nan')}},{'kill':{'intensity':3}},{'kill':{'code':'run'}}]:
            with self.assertRaises(ValueError):validate({**self.settings,'event_options':options})


if __name__=='__main__':unittest.main()
