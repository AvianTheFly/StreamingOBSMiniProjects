"""Fake-clock automatic chat regressions, with disposable catalogs and no network."""
import json
from pathlib import Path
import random
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'mini projects'))
from twitch_commands import joke_catalog, settings
from twitch_commands.jokes import Jokes, PREFIX


class JokeTests(unittest.TestCase):
    def setUp(self):
        self.folder=tempfile.TemporaryDirectory();self.addCleanup(self.folder.cleanup)
        self.catalog=Path(self.folder.name)/'jokes.json'
        self.history=Path(self.folder.name)/'history.json'
        self.catalog.write_text(json.dumps(dict(enabled=True,personal='keep',jokes=[
            dict(id=str(i),text='Test joke '+str(i)) for i in range(4)])),encoding='utf-8')
        self.config=dict(channel='owner',enabled=True,revision='one')
        self.chat=dict(channel='owner',connected=True,delivery=dict(ready=True))
        self.now=0.;self.live=True;self.stop=threading.Event();self.sent=[]
        self.service=self.make()

    def make(self):
        return Jokes(self.stop,lambda:self.config,self.send,lambda:self.chat,
                     live=lambda:self.live,catalog=self.catalog,history=self.history,
                     clock=lambda:self.now,rng=random.Random(18))

    def send(self,channel,text,*,allowed):
        if not allowed():return False
        self.sent.append((channel,text,allowed));return True

    def advance(self,seconds):
        target=self.now+seconds
        while self.now<target:
            self.now=min(target,self.now+15);self.service.tick()

    def due(self):
        self.service.tick()
        self.advance(self.service.due-self.now)

    def test_first_message_waits_and_each_interval_is_random_and_bounded(self):
        self.service.tick();first=self.service.due
        self.assertTrue(1200<=first<=2400);self.assertFalse(self.sent)
        self.advance(first-1);self.assertFalse(self.sent)
        self.advance(1);self.assertEqual(len(self.sent),1)
        self.assertTrue(self.sent[0][1].startswith(PREFIX))
        second=self.service.due-self.now
        self.assertTrue(1200<=second<=2400);self.assertNotEqual(first,second)
        self.advance(second);self.assertEqual(len(self.sent),2)

    def test_no_repeats_across_restart_or_at_cycle_boundary(self):
        self.due();self.service.close();self.service=self.make()
        for _ in range(3):self.due()
        texts=[s[1] for s in self.sent]
        self.assertEqual(len(set(texts)),4)
        self.due();self.assertNotEqual(self.sent[-1][1],self.sent[-2][1])

    def test_offline_disconnect_channel_edit_and_stop_revoke_queued_joke(self):
        self.due();guard=self.sent[-1][2];self.assertTrue(guard())
        self.live=False;self.assertFalse(guard());self.service.tick();self.assertIsNone(self.service.due)
        self.live=True;self.service.tick();self.assertGreaterEqual(self.service.due-self.now,1200)
        self.assertFalse(guard(),'A new live interval must not revive old queued intent')
        self.chat['connected']=False;self.assertFalse(guard())
        self.chat['connected']=True;self.config['channel']='other';self.assertFalse(guard())
        self.config['channel']='owner';self.config['revision']='two';self.assertFalse(guard())
        self.config['revision']='one';self.stop.set();self.assertFalse(guard())

    def test_sleep_does_not_catch_up(self):
        self.service.tick();self.now+=10000;self.service.tick()
        self.assertFalse(self.sent);self.assertGreaterEqual(self.service.due-self.now,1200)

    def test_failed_admission_waits_full_interval_and_does_not_repeat(self):
        self.service.send=lambda *a,**k:False
        self.due();first=json.loads(self.history.read_text())['last']
        self.service.send=self.send;self.service.tick();self.assertFalse(self.sent)
        self.due();self.assertNotEqual(json.loads(self.history.read_text())['last'],first)

    def test_toggle_preserves_personal_data_and_invalidates_queued_intent(self):
        self.due();guard=self.sent[-1][2]
        original=self.service.snapshot()
        with patch('twitch_commands.jokes.SettingsBackups.snapshot'):
            result=self.service.save(dict(revision=original['revision'],enabled=False))
        self.assertFalse(result['enabled']);self.assertFalse(guard())
        self.assertEqual(json.loads(self.catalog.read_text())['personal'],'keep')
        with self.assertRaises(settings.Conflict):
            self.service.save(dict(revision=original['revision'],enabled=True))

    def test_malformed_catalog_and_history_fail_closed_without_replacement(self):
        self.catalog.write_text('{broken',encoding='utf-8');service=self.make();service.tick()
        self.assertTrue(service.snapshot()['message']);self.assertFalse(self.sent)
        self.assertEqual(self.catalog.read_text(),'{broken')
        self.history.write_text('{broken',encoding='utf-8');self.due()
        self.assertFalse(self.sent);self.assertEqual(self.history.read_text(),'{broken')
        self.assertIsNone(self.service.due)

    def test_history_preserves_unknown_fields(self):
        self.history.write_text(json.dumps(dict(used=[],personal={'keep':1})))
        self.due();self.assertEqual(json.loads(self.history.read_text())['personal'],{'keep':1})

    def test_close_revokes_and_ui_preview_never_sends(self):
        snapshot=self.service.snapshot();self.assertEqual(len(snapshot['catalog']),4)
        self.assertFalse(self.sent);self.due();guard=self.sent[-1][2]
        self.service.close();self.assertFalse(guard());self.advance(3000)
        self.assertEqual(len(self.sent),1)

    def test_auth_missing_and_master_off_never_arm(self):
        self.chat['delivery']['ready']=False;self.service.tick();self.assertIsNone(self.service.due)
        self.chat['delivery']['ready']=True;self.config['enabled']=False
        self.service.tick();self.assertIsNone(self.service.due)


if __name__=='__main__':unittest.main()
