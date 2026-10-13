"""Disposable command settings and admission regressions; never post to live chat."""
import json
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import Mock,patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'mini projects'))
from twitch_commands import settings,api
from twitch_commands.policy import match,render
from twitch_commands.service import Commands


def config():
    return dict(channel='test_channel',enabled=True,personal='keep me',commands=[
        dict(command='!discord',aliases=['!dc'],enabled=True,response='https://discord.gg/test',
             cooldown=30,permission='everyone',kind='text',unknown={'volume':'preserve'})])


def message(name='!discord',identity='m1',user='viewer',**extra):
    return dict(text=name,id=identity,user=user,user_id=user,channel='test_channel',
                sent_at=str(int(time.time()*1000)),**extra)


class CommandTests(unittest.TestCase):
    def setUp(self):
        self.folder=tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.path=Path(self.folder.name)/'commands.json'
        self.path.write_text(json.dumps(config()),encoding='utf-8')
        self.stop=threading.Event()
        self.sent=[]
        def reply(*args,**kwargs):self.sent.append((args,kwargs));return True
        self.clock=[10.]
        self.service=Commands(self.stop,reply,path=self.path,clock=lambda:self.clock[0])

    def test_aliases_share_cooldown_and_dedupe(self):
        self.assertTrue(self.service.receive(message('!DiScOrD extra')))
        self.assertFalse(self.service.receive(message('!dc','m2','other')))
        self.clock[0]+=31
        self.assertTrue(self.service.receive(message('!dc','m3','other')))
        self.clock[0]+=61
        self.assertFalse(self.service.receive(message('!dc','m3','other')))
        self.assertEqual(len(self.sent),2)

    def test_clip_only_admits_owner_or_real_mod_and_rejects_stale_duplicates(self):
        with patch('twitch_commands.clipping.request_clip', return_value=True) as request:
            self.assertFalse(self.service.receive(message('!clip')))
            self.assertFalse(self.service.receive(message('!clip', moderator='true')))
            stale = message('!clip', moderator=True); stale['sent_at'] = '1'
            self.assertFalse(self.service.receive(stale))
            foreign = message('!clip', moderator=True); foreign['channel'] = 'other'
            self.assertFalse(self.service.receive(foreign))
            self.assertTrue(self.service.receive(message('!CLIP', moderator=True)))
            self.assertFalse(self.service.receive(message('!clip', moderator=True)))
            self.assertTrue(self.service.receive(message('!clip', 'owner', 'test_channel')))
            self.assertEqual(request.call_count, 2)
            self.assertTrue(request.call_args.kwargs['reuse'])

    def test_clip_replies_only_after_confirmation_and_revokes_on_edit_or_stop(self):
        with patch('twitch_commands.clipping.request_clip', return_value=True) as request:
            self.service.receive(message('!clip', moderator=True))
        self.assertEqual(self.sent, [])
        completed = request.call_args.kwargs['on_complete']
        completed(dict(status='ready', message='Twitch clip ready (60s).', url='https://clips.twitch.tv/test'))
        self.assertEqual(self.sent[0][0][1], 'Clip saved! Twitch clip ready (60s). https://clips.twitch.tv/test')
        self.service.close()
        self.assertFalse(self.sent[0][1]['allowed']())
        completed(dict(status='ready', url='https://clips.twitch.tv/test'))
        self.assertEqual(len(self.sent), 1)

    def test_clip_failure_never_claims_success(self):
        with patch('twitch_commands.clipping.request_clip', return_value=True) as request:
            self.service.receive(message('!clip', moderator=True))
        request.call_args.kwargs['on_complete'](dict(status='error', url=''))
        self.assertIn('could not be confirmed', self.sent[0][0][1])
        self.assertNotIn('Clip saved!', self.sent[0][0][1])

    def test_short_clip_reply_explains_duration_and_links_the_single_clip(self):
        with patch('twitch_commands.clipping.request_clip', return_value=True) as request:
            self.service.receive(message('!clip', moderator=True))
        request.call_args.kwargs['on_complete'](dict(status='error',
            message='Twitch published only 30s of the requested 60s. No duplicate was created.',
            url='https://clips.twitch.tv/short'))
        self.assertIn('only 30s', self.sent[0][0][1])
        self.assertIn('https://clips.twitch.tv/short', self.sent[0][0][1])
        self.assertNotIn('Clip saved!', self.sent[0][0][1])

    def test_user_cooldown_is_longer(self):
        self.assertTrue(self.service.receive(message()))
        self.clock[0]+=31
        self.assertFalse(self.service.receive(message('!dc','m2')))
        self.clock[0]+=31
        self.assertTrue(self.service.receive(message('!dc','m3')))

    def test_disabled_foreign_stale_and_stopped_messages(self):
        m=message();m['channel']='other';self.assertFalse(self.service.receive(m))
        m=message();m['sent_at']='1';self.assertFalse(self.service.receive(m))
        m=message();m.pop('user_id');self.assertFalse(self.service.receive(m))
        self.stop.set();self.assertFalse(self.service.receive(message()))
        data=config();data['enabled']=False;self.assertIsNone(match(data,message()))

    def test_permission_uses_trusted_flags(self):
        data=config();data['commands'][0]['permission']='moderator'
        self.assertIsNone(match(data,message()))
        self.assertIsNone(match(data,message(moderator='true')))
        self.assertIsNotNone(match(data,message(moderator=True)))
        data['commands'][0]['permission']='owner'
        self.assertIsNone(match(data,message(moderator=True)))
        self.assertIsNotNone(match(data,message(user='test_channel')))

    def test_unknown_fields_survive_and_stale_editor_conflicts(self):
        old=settings.read(self.path)
        body=dict(revision=settings.revision(old),original='!discord',command={'response':'Updated'})
        result=settings.save(body,self.path,snapshot=lambda:None)
        self.assertEqual(result['personal'],'keep me')
        self.assertEqual(result['commands'][0]['unknown'],{'volume':'preserve'})
        self.assertEqual(result['commands'][0]['aliases'],['!dc'])
        with self.assertRaises(settings.Conflict):settings.save(body,self.path,snapshot=lambda:None)

    def test_reject_duplicate_reserved_and_injection_without_writes(self):
        original=self.path.read_bytes()
        for row in ({'command':'!stats'},{'aliases':['!discord']},{'response':'hello\n/ban viewer'},
                    {'response':'/ban viewer'},{'cooldown':True},{'enabled':'yes'}):
            body=dict(revision=settings.revision(settings.read(self.path)),original='!discord',command=row)
            with self.assertRaises(ValueError):settings.save(body,self.path,snapshot=lambda:None)
            self.assertEqual(original,self.path.read_bytes())

    def test_malformed_personal_data_preserved(self):
        self.path.write_text('{broken',encoding='utf-8')
        with self.assertRaises(ValueError):settings.save({'enabled':True},self.path,snapshot=lambda:None)
        self.assertEqual(self.path.read_text(),'{broken')

    def test_queue_guard_invalidated_by_edit_close_or_stop(self):
        self.assertTrue(self.service.receive(message()))
        allowed=self.sent[0][1]['allowed'];self.assertTrue(allowed())
        # Test service edit with a disposable snapshot owner.
        from unittest.mock import patch
        with patch.object(settings.SettingsBackups,'snapshot'):
            self.service.save(dict(revision=self.service.snapshot()['revision'],enabled=False))
        self.assertFalse(allowed())
        self.assertFalse(self.service.receive(message('!dc','m2')))
        self.service.close();self.assertFalse(allowed())

    def test_reminder_settings_preserve_catalog_and_revoke_pending_message(self):
        original = self.service.snapshot()['commands']
        with patch.object(settings.SettingsBackups,'snapshot'):
            self.service.save(dict(revision=self.service.snapshot()['revision'],announcements_enabled=True))
        self.assertEqual(self.service.snapshot()['commands'], original)
        self.service.announcements.send = Mock(return_value=True)
        with patch('twitch_commands.service.runtime_ready',return_value=True), patch('twitch_commands.service.clips_available',return_value=False):
            self.service.tick()
            self.clock[0] = self.service.announcements.due
            self.assertTrue(self.service.tick())
            guard = self.service.announcements.send.call_args.kwargs['allowed']
            self.assertTrue(guard())
            with patch.object(settings.SettingsBackups,'snapshot'):
                self.service.save(dict(revision=self.service.snapshot()['revision'],announcements_enabled=False))
            self.assertFalse(guard())
        self.assertIsNone(self.service.snapshot()['announcements']['next_in_seconds'])

    def test_failed_admission_does_not_consume_cooldown(self):
        self.service.reply=lambda *a,**k:False
        self.assertFalse(self.service.receive(message()))
        self.service.reply=lambda *a,**k:True
        self.assertTrue(self.service.receive(message('!dc','m2')))

    def test_preview_never_sends(self):
        api.register(self.service)
        self.addCleanup(api.register,None)
        self.assertEqual(api.preview({'text':'!dc'})['response'],'https://discord.gg/test')
        self.assertEqual(self.sent,[])

    def test_index_pages_and_random_response(self):
        data=config();data['commands']*=40
        result=render({'kind':'index'},data,message('!commands 2'))
        self.assertIn('2/5',result);self.assertLessEqual(len(result),400)
        self.assertEqual(render({'kind':'8ball'},config(),message(),choose=lambda values:values[0]),'The spirits approve.')
        data['commands']=[{**config()['commands'][0],'command':'!'+str(i).zfill(32)} for i in range(300)]
        self.assertLessEqual(len(render({'kind':'index'},data,message('!commands 38'))),400)

    def test_http_adapter_rejects_remote_origin_and_preserves_conflicts(self):
        from hub_ui.routes.twitch_commands import TwitchCommandRoutes
        route=TwitchCommandRoutes()
        route.server=Mock(server_port=7420)
        route.client_address=('127.0.0.1',12345)
        route.headers={'Host':'localhost:7420','Origin':'http://evil.test','Content-Length':'2'}
        route._json=Mock();route._err=Mock();route._body=Mock(return_value={})
        route._post_twitch_commands('/api/twitch-commands/preview')
        route._err.assert_called_once_with(403,'Open chat commands from this Hub.')
        route._body.assert_not_called()
        route.headers['Origin']='http://localhost:7420';route._err.reset_mock()
        api.register(self.service);self.addCleanup(api.register,None)
        route._body.return_value={'text':'!dc'}
        route._post_twitch_commands('/api/twitch-commands/preview')
        self.assertEqual(route._json.call_args.args[1]['response'],'https://discord.gg/test')
        self.assertEqual(self.sent,[])
        route._body.return_value={'revision':'stale','enabled':False}
        route._post_twitch_commands('/api/twitch-commands/settings')
        self.assertEqual(route._err.call_args.args[0],409)
        route.headers['Content-Length']='99999';route._err.reset_mock()
        route._post_twitch_commands('/api/twitch-commands/preview')
        self.assertEqual(route._err.call_args.args[0],400)


if __name__=='__main__':unittest.main()
