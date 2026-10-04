"""Observation is bounded, private, disposable, and does not change dispatch."""
import json
import os
import subprocess
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

import events
from lib.workflow_map.catalog import WorkflowCatalog
from lib.workflow_map.journal import WorkflowJournal
from lib.workflow_map.source import proof,event_facts,application_sources,owner_fingerprints,safe_source,owner_for
from lib.workflow_map.validation import validate_manifest

ROOT=Path(__file__).resolve().parents[1]


class WorkflowMapTests(unittest.TestCase):
    def test_living_world_distribution_keeps_its_canonical_owners(self):
        self.assertEqual(owner_for('hub_ui/app/lobby-motion/stage.js'),'scene_voice_switcher')
        self.assertEqual(owner_for('hub_ui/app/lobby-motion/shared/world-motion.js'),'browser_effects')
        self.assertEqual(owner_for('hub_ui/app/js/pages/scene-switcher.js'),'hub')

    def test_installed_module_junction_proofs_reject_other_external_paths(self):
        def link(directory,target):
            if os.name=='nt':
                subprocess.run(['cmd','/c','mklink','/J',str(directory),str(target)],
                               check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
            else:
                directory.symlink_to(target,target_is_directory=True)
        with tempfile.TemporaryDirectory() as folder:
            base=Path(folder);root=base/'checkout';(root/'mini projects').mkdir(parents=True)
            local=base/'local';installed=local/'StreamingHub/feature-packages/love_me';installed.mkdir(parents=True)
            (installed/'main.py').write_text('def run():\n    return 1\n')
            link(root/'mini projects/love_me',installed)
            outside=base/'unrelated';outside.mkdir();(outside/'main.py').write_text('raise RuntimeError("Never import")')
            link(installed/'escape',outside);link(root/'lib',outside)
            link(root/'mini projects/soundboard',outside)
            with patch.dict(os.environ,{'LOCALAPPDATA':str(local)}):
                ref={'path':'mini projects/love_me/main.py','symbol':'run'}
                self.assertEqual(safe_source(root,ref['path']),installed/'main.py')
                self.assertIn('current_hash',proof(root,ref))
                for path in ['mini projects/love_me/escape/main.py','mini projects/soundboard/main.py',
                             'lib/main.py','../unrelated/main.py',str(installed/'main.py')]:
                    with self.assertRaises(ValueError,msg=path):safe_source(root,path)

    def test_observer_failure_does_not_stop_business_or_nested_fanout(self):
        records,called=[],[]
        token=events.observe(records.append)
        bad=events.observe(lambda record:1/0)
        def handler(data):called.append(data['text']);events.emit('workflow.test.child')
        def failed(data):raise RuntimeError('fixture')
        events.subscribe('workflow.test.parent',handler);events.subscribe('workflow.test.parent',failed)
        try:
            events.emit('workflow.test.parent',text='PRIVATE',token='PRIVATE',requester='soundboard')
        finally:
            events.unsubscribe('workflow.test.parent',handler);events.unsubscribe('workflow.test.parent',failed)
            events.unobserve(token);events.unobserve(bad)
        self.assertEqual(called,['PRIVATE'])
        parent=next(r for r in records if r['event']=='workflow.test.parent' and r['phase']=='emitted')
        child=next(r for r in records if r['event']=='workflow.test.child')
        self.assertEqual(child['parent'],parent['dispatch'])
        self.assertEqual(len(parent['listeners']),2)
        self.assertTrue(any(r['phase']=='failed' for r in records))
        self.assertNotIn('PRIVATE',json.dumps(records))

    def test_history_persists_without_browser_and_releases_observer(self):
        with tempfile.TemporaryDirectory() as folder:
            journal=WorkflowJournal(folder)
            with journal.observe():
                events.inspect_event('workflow.fixture',owner='soundboard',phase='started',transcript='PRIVATE',token='SECRET')
                journal.sample({'scene':{'scene':'Test','temporary_owner':'instant_replay'},
                    'playback':{'soundboard':{'allowed':False,'ready':True}},
                    'pauses':{'specific_song':{'claims':1,'owners':[{'owner':'soundboard','kind':'playback'}]}},
                    'projects':[{'name':'soundboard','is_active':True}]})
            self.assertFalse(journal.recording)
            history=journal.history(query='workflow.fixture')['records']
            self.assertEqual(len(history),1)
            self.assertEqual(history[0]['phase'],'started')
            self.assertNotIn('PRIVATE',json.dumps(history));self.assertNotIn('SECRET',json.dumps(history))
            state=next(r for r in journal.history()['records'] if r['event']=='runtime.state')
            self.assertFalse(state['playback']['soundboard']['allowed'])
            self.assertEqual(state['pauses']['specific_song']['owners'][0]['owner'],'soundboard')
            count=len(journal.history()['records']);events.inspect_event('workflow.fixture',owner='hub')
            self.assertEqual(len(journal.history()['records']),count)

    def test_queue_overflow_never_blocks_producer(self):
        journal=WorkflowJournal(capacity=1)
        journal.capture({'event':'one'});journal.capture({'event':'two'})
        self.assertEqual(journal.dropped,1)

    def test_history_paging_and_literal_search(self):
        with tempfile.TemporaryDirectory() as folder:
            journal=WorkflowJournal(folder)
            with journal.observe():
                for i in range(12):journal.capture({'event':f'flow_{i}','owner':'hub'})
            first=journal.history(limit=5);second=journal.history(limit=5,before=first['next'])
            self.assertTrue(first['next']);self.assertFalse({r['id'] for r in first['records']}&{r['id'] for r in second['records']})
            self.assertEqual(len(journal.history(query='flow_1')['records']),3)
            self.assertEqual(journal.history(query='%')['records'],[])

    def test_catalog_tracks_settings_and_flags_behavior_changes(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'lib/example').mkdir(parents=True)
            source=root/'events.py';source.write_text('def act():\n    return 1\n')
            ref={'path':'events.py','symbol':'act'};ref['hash']=proof(root,ref)['current_hash']
            config=root/'config.json';config.write_text('{"enabled":true}')
            manifest={'module':{'id':'example','label':'Example','group':'Inputs'},'flows':[{'id':'example.act','label':'Act','topic':'Example',
              'trigger':{'kind':'control'},'steps':[{'id':'a','owner':'example','label':'Gate','kind':'gate','setting':{'path':'config.json','key':'enabled'}}],
              'edges':[],'evidence':[ref],'owner_hashes':{'hub':owner_fingerprints(root,application_sources(root))['hub']}}]}
            path=root/'lib/example/workflows.json';path.write_text(json.dumps(manifest))
            catalog=WorkflowCatalog(root);first=catalog.snapshot();self.assertEqual(first['review_count'],0)
            config.write_text('{"enabled":false}');catalog._checked=0;catalog.snapshot();catalog._checked=0
            second=catalog.snapshot();self.assertFalse(second['flows'][0]['steps'][0]['configured'])
            helper=root/'lib/helper.py';helper.write_text('def helper():\n    return 3\n');catalog._checked=0
            changed_helper=catalog.snapshot()
            self.assertEqual(changed_helper['flows'][0]['proofs'][0]['status'],'verified')
            self.assertEqual(changed_helper['flows'][0]['changed_owners'],['hub'])
            source.write_text('def act():\n    return 2\n');catalog._checked=0
            changed=catalog.snapshot();self.assertEqual(changed['review_count'],1)
            self.assertNotEqual(first['revision'],changed['revision'])
            with self.assertRaises(ValueError):catalog.source_excerpt('../secret.py','act')
            path.write_text('{broken');catalog._checked=0;self.assertTrue(catalog.snapshot()['issues'])
            self.assertEqual(path.read_text(),'{broken')

    def test_source_facts_do_not_import_feature_code(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);path=root/'events.py'
            path.write_text("raise RuntimeError('Never import')\nimport events as bus\nfrom events import inspect_event\ndef f():\n    bus.emit('new.event')\n    inspect_event('new.decision')\n")
            facts=event_facts(root,path)
            self.assertEqual({(f['event'],f['kind']) for f in facts},{('new.event','emit'),('new.decision','observe')})

    def test_checkout_coverage_and_manifest_contract(self):
        from lib.project_registry import SUPPORTED_RUNTIME_PROJECTS
        data=WorkflowCatalog(ROOT).snapshot()
        self.assertFalse(data['issues'])
        self.assertTrue(set(SUPPORTED_RUNTIME_PROJECTS)<={m['id'] for m in data['modules']})
        for path in WorkflowCatalog(ROOT).manifests():validate_manifest(json.loads(path.read_text(encoding='utf-8-sig')))


if __name__=='__main__':unittest.main()
