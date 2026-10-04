"""Command policy and bounded delivery regressions; no live Twitch writes."""
import copy
import os
import threading
import time
import unittest
from unittest.mock import Mock, patch
from tools import test_league_stats as fixtures
from league_stats import commands, chat_replies
from lib.twitch_chat_replies import ReplySender, clean
from lib.twitch_chat_session import ChatSessions
from twitch_celebrations.twitch import Twitch, AUTH_SCOPES, SCOPES


class CommandReplies(unittest.TestCase):
    setUp=fixtures.TrackerTests.setUp
    new_tracker=fixtures.TrackerTests.new_tracker
    advance=fixtures.TrackerTests.advance

    def ingest(self):
        if self.tracker.current is None:
            self.advance(600)  # Game starts within the saved session, rather than before it.
        fixtures.TrackerTests.ingest(self)

    def message(self,text,user='viewer',identity='message',moderator=False):
        self.tracker.enqueue_chat(dict(channel='owner',user=user,id=identity,text=text,moderator=moderator))
        self.tracker.drain_chat()

    def test_commands_threaded_once_and_current_session_not_dashboard_period(self):
        self.ingest()
        reply=self.tracker.reply=Mock()
        self.message('!stats cs')
        self.assertEqual(reply.call_count,1)
        self.assertEqual(reply.call_args.args[::2],('owner','message'))
        self.assertIn('🌾 Session CS · 80 total',reply.call_args.args[1])
        self.message('!stats cs')
        self.advance(11);self.message('!stats kda',identity='second')
        self.assertEqual(reply.call_count,1,'Same viewer must wait a minute')
        self.message('!stats kda',user='another',identity='third')
        self.assertEqual(reply.call_count,2)

    def test_help_is_bounded_and_does_not_replace_overlay(self):
        self.tracker.reply=Mock()
        self.message('!stats')
        self.assertIn('📖 Stats →',self.tracker.reply.call_args.args[1])
        self.assertLess(len(self.tracker.reply.call_args.args[1]),400)
        self.assertIsNone(self.tracker.community.snapshot())
        self.assertEqual(commands.parse('!stats help'),('spotlight','help'))

    def test_helpers_confirm_only_success_and_can_undo(self):
        self.ingest();reply=self.tracker.reply=Mock()
        self.message('!cannon')
        reply.assert_not_called()
        self.message('!cannon',user='trusted',identity='one',moderator=True)
        self.assertIn('✅ Cannon miss +1 · This game: 1',reply.call_args.args[1])
        self.message('!melee',user='owner',identity='two')
        self.assertEqual(reply.call_count,1,'Cooldown failures stay quiet')
        self.message('!statundo',user='trusted',identity='undo',moderator=True)
        self.assertIn('↩️ Last report undone',reply.call_args.args[1])
        self.assertEqual(self.tracker.current['metrics']['missed_cannon'],0)

    def test_disable_cancels_queued_reply_without_disabling_overlay(self):
        self.ingest();reply=self.tracker.reply=Mock()
        self.message('!stats cs')
        allowed=reply.call_args.kwargs['allowed']
        self.assertTrue(allowed())
        self.tracker.settings['chat_replies']=False
        self.assertFalse(allowed())
        self.advance(11);self.message('!stats kda',user='other',identity='two')
        self.assertEqual(reply.call_count,1)
        self.assertEqual(self.tracker.community.snapshot()['topic'],'kda')

    def test_stale_blocked_and_duplicate_reports_never_reply(self):
        self.ingest();reply=self.tracker.reply=Mock()
        self.tracker.settings['blocked_helpers']=['blocked']
        self.message('!stats cs',user='blocked')
        self.tracker.enqueue_chat(dict(channel='owner',user='owner',id='stale',text='!cannon'))
        self.advance(6);self.tracker.drain_chat()
        reply.assert_not_called()

    def test_previews_preserve_unknown_and_do_not_write(self):
        reply=self.tracker.reply=Mock()
        previews=self.tracker.snapshot()['reply_previews']
        self.assertEqual(len(previews),20)
        self.assertTrue(all('\n' not in p['text'] and len(p['text'])<400 for p in previews))
        self.assertIn('No games tracked yet',previews[0]['text'])
        self.ingest()
        misses=next(p for p in self.tracker.snapshot()['reply_previews'] if p['topic']=='damage')
        self.assertIn('unknown',misses['text'])
        reply.assert_not_called()


class DeliveryTests(unittest.TestCase):
    def setUp(self):
        self.stop=threading.Event();self.sessions=ChatSessions();self.owner=object()
        self.channel='owner';self.now=100
        self.auth=Mock(return_value=dict(token='secret',client_id='client',broadcaster_id='123',sender_id='123'))
        self.sessions.register(self.owner,authorize=self.auth,status=lambda channel:dict(ready=channel=='owner',message='Ready'),stop=self.stop)
        self.post=Mock(return_value=Mock(status_code=200,json=Mock(return_value={'data':[{'is_sent':True}]})))
        self.sender=ReplySender(self.stop,lambda:self.channel,sessions=self.sessions,post=self.post,clock=lambda:self.now)

    def queue(self,allowed=lambda:True):
        self.assertTrue(self.sender.enqueue('owner','🌾 Stats\r\nHELLO','parent-id',allowed=allowed))
        return self.sender.inbox.get_nowait()

    def test_native_reply_payload_single_line_and_success(self):
        self.sender.deliver(self.queue())
        payload=self.post.call_args.kwargs['json']
        self.assertEqual(payload['message'],'🌾 Stats HELLO')
        self.assertEqual(payload['reply_parent_message_id'],'parent-id')
        self.assertNotIn('for_source_only',payload,'User tokens cannot set this field')
        self.assertEqual(self.post.call_args.kwargs['timeout'],3)
        self.assertTrue(self.sender.snapshot()['last']['sent'])
        self.assertNotIn('secret',str(self.sender.snapshot()))

    def test_stale_channel_session_stop_and_disable_drop(self):
        for reason in ('expiry','channel','session','stop','disable'):
            with self.subTest(reason=reason):
                self.setUp();enabled=[True];item=self.queue(allowed=lambda:enabled[0])
                if reason=='expiry':self.now+=16
                if reason=='channel':self.channel='other'
                if reason=='session':self.sessions.unregister(self.owner)
                if reason=='stop':self.stop.set()
                if reason=='disable':enabled[0]=False
                self.sender.deliver(item);self.post.assert_not_called()

    def test_rechecks_after_token_refresh(self):
        item=self.queue()
        def authorization(channel):
            self.stop.set();return dict(token='secret')
        self.auth.side_effect=authorization
        self.sender.deliver(item);self.post.assert_not_called()

    def test_moderation_rate_limits_and_uncertain_writes_are_not_retried(self):
        self.post.return_value.json.return_value={'data':[{'is_sent':False}]}
        self.sender.deliver(self.queue());self.assertFalse(self.sender.snapshot()['last']['sent'])
        self.post.return_value.status_code=429
        self.sender.deliver(self.queue());self.assertEqual(self.sender.next_send,130)
        self.post.side_effect=RuntimeError('secret')
        self.sender.deliver(self.queue());self.assertNotIn('secret',str(self.sender.snapshot()))
        self.assertEqual(self.post.call_count,3)

    def test_bounded_queue_and_invalid_targets(self):
        self.assertFalse(self.sender.enqueue('other','Stats','id',allowed=lambda:True))
        self.assertFalse(self.sender.enqueue('owner','Stats','\r\nraw',allowed=lambda:True))
        for _ in range(32):self.assertTrue(self.sender.enqueue('owner','Stats','id',allowed=lambda:True))
        self.assertFalse(self.sender.enqueue('owner','Stats','id',allowed=lambda:True))
        self.assertEqual(len(clean('x'*1000)),400)


class AuthorizationTests(unittest.TestCase):
    def owner(self):
        t=Twitch.__new__(Twitch);t.lock=threading.RLock();t.stop=threading.Event()
        t.tokens={'access_token':'secret','expires_at':time.time()+600};t.last_validated=time.monotonic()
        t.chat_identity=dict(login='owner',user_id='123',client_id='client',token='secret',scopes=['user:write:chat'])
        return t

    def test_chat_permission_optional_for_existing_celebrations(self):
        self.assertIn('user:write:chat',AUTH_SCOPES.split())
        self.assertNotIn('user:write:chat',SCOPES.split())
        t=self.owner();self.assertTrue(t.chat_status('owner')['ready'])
        self.assertFalse(t.chat_status('other')['ready'])
        self.assertEqual(t.chat_authorization('owner')['sender_id'],'123')
        t.chat_identity['scopes']=[]
        with self.assertRaises(ValueError):t.chat_authorization('owner')

    def test_failed_validation_clears_authorization(self):
        t=self.owner()
        with patch('twitch_celebrations.twitch.requests.get',side_effect=OSError('offline')):
            with self.assertRaises(OSError):t.validate_token('secret')
        self.assertFalse(t.chat_status('owner')['ready'])

    def test_expired_or_changed_token_requires_validated_identity(self):
        t=self.owner();t.last_validated-=3301
        self.assertFalse(t.chat_status('owner')['ready'])
        t=self.owner();t.tokens['access_token']='replacement'
        self.assertFalse(t.chat_status('owner')['ready'])


class ProviderLifetimeTests(unittest.TestCase):
    def test_partial_startup_unregisters_providers_and_closes_server(self):
        from twitch_celebrations import main
        from lib.twitch_chat_session import chat_sessions
        from lib.twitch_clip_session import clip_sessions
        for failed_thread in (0,1):
            with self.subTest(failed_thread=failed_thread):
                service=Mock();service.twitch.stop=threading.Event();service.twitch.socket=None
                server=Mock();threads=[Mock(),Mock()]
                threads[0].is_alive.return_value=failed_thread==1
                threads[failed_thread].start.side_effect=RuntimeError('Startup failed')
                with patch.object(main,'Service',return_value=service),patch.object(main,'ThreadingHTTPServer',return_value=server),patch.object(main.threading,'Thread',side_effect=threads):
                    with self.assertRaisesRegex(RuntimeError,'Startup failed'):
                        main.run(None,service.twitch.stop)
                self.assertIsNone(chat_sessions.get())
                self.assertIsNone(clip_sessions.get())
                server.server_close.assert_called_once()
                self.assertEqual(server.shutdown.call_count,failed_thread)


if __name__=='__main__':unittest.main()
