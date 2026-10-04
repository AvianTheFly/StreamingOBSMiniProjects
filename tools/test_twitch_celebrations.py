"""Focused behavior and loopback API tests. No Twitch or OBS access."""
import json
import os
from pathlib import Path
import random
import sys
import threading
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import patch
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
sys.path.insert(0,str(ROOT/'mini projects'))
from twitch_celebrations.engine import Engine
from twitch_celebrations.twitch import Twitch
from twitch_celebrations.main import Service
from twitch_celebrations.http_server import handler


class EngineTests(unittest.TestCase):
    def setUp(self):
        self.now=0
        self.e=Engine(clock=lambda:self.now,rng=random.Random(4))

    def test_raid_priority_and_duplicate(self):
        self.e.submit('follow','friend',event_id='1')
        self.e.submit('raid','raider',42,event_id='2')
        self.assertFalse(self.e.submit('raid','raider',42,event_id='2'))
        self.assertEqual(self.e.snapshot()['kind'],'raid')
        self.now=17
        self.assertEqual(self.e.snapshot()['kind'],'follow')

    def test_follow_burst_bounded_and_stale(self):
        for i in range(100): self.e.submit('follow','friend',event_id=str(i))
        self.assertEqual(len(self.e.queue),1)
        self.now=46
        self.assertIsNone(self.e.snapshot())

    def test_shuffle_and_pause(self):
        values=[self.e.theme() for _ in range(20)]
        for i in range(0,20,4): self.assertEqual(len(set(values[i:i+4])),4)
        self.assertTrue(all(a!=b for a,b in zip(values,values[1:])))
        self.e.paused=True
        self.assertFalse(self.e.submit('raid','hi'))

    def test_preview_status_does_not_consume_live_queue(self):
        self.e.submit('raid','hi')
        self.assertIsNone(self.e.snapshot(ready=False))
        self.assertEqual(len(self.e.queue),1)

    def test_raid_can_enter_full_queue(self):
        for i in range(8): self.e.submit('cheer','a')
        self.assertTrue(self.e.submit('raid','b'))
        self.assertEqual(len(self.e.queue),8)
        self.assertEqual(self.e.snapshot()['name'],'b')

    def test_raid_expires_at_eight_seconds(self):
        self.e.submit('raid','Eight second party',42)
        self.assertEqual(self.e.snapshot()['duration'],8)
        self.now=7.99
        self.assertIsNotNone(self.e.snapshot())
        self.now=8
        self.assertIsNone(self.e.snapshot())

    def test_subs_are_prioritized_and_can_enter_a_full_lower_priority_queue(self):
        for i in range(8):self.e.submit('cheer','Hype')
        self.assertTrue(self.e.submit('subscribe','Supporter'))
        self.assertEqual(len(self.e.queue),8)
        self.e.submit('raid','Raiding crew')
        self.assertEqual(self.e.snapshot()['kind'],'raid')
        self.now=8
        self.assertEqual(self.e.snapshot()['kind'],'subscribe')
        self.now=11.8
        self.assertEqual(self.e.snapshot()['kind'],'cheer')

    def test_supporter_expiry_matches_short_contract(self):
        for kind,duration in [('subscribe',3.8),('gift',3.8),('follow',2.2)]:
            self.now=0;self.e.clear();self.e.submit(kind,'Friend')
            self.assertEqual(self.e.snapshot()['duration'],duration)
            self.now=duration-.01;self.assertIsNotNone(self.e.snapshot())
            self.now=duration;self.assertIsNone(self.e.snapshot())

    def test_notification_channel_and_gifts(self):
        received=[]
        twitch=object.__new__(Twitch)
        twitch.receive=lambda *args: received.append(args)
        msg={'metadata':{'subscription_type':'channel.raid','message_id':'a'},'payload':{'event':{'to_broadcaster_user_id':'123','from_broadcaster_user_name':'Friend','viewers':42}}}
        with patch.dict(os.environ,{'TWITCH_BROADCASTER_ID':'123'}):
            twitch.notification(msg)
            self.assertEqual(received[0],('raid','Friend',42,'a'))
            msg['payload']['event']['to_broadcaster_user_id']='other'
            twitch.notification(msg)
            self.assertEqual(len(received),1)
            msg['metadata']['subscription_type']='channel.subscribe'
            msg['payload']['event']={'broadcaster_user_id':'123','is_gift':True}
            twitch.notification(msg)
            self.assertEqual(len(received),1)


class HTTPTests(unittest.TestCase):
    def test_api_csrf_host_and_media_paths(self):
        service=Service(threading.Event())
        server=ThreadingHTTPServer(('127.0.0.1',0),handler(service,ROOT/'mini projects/twitch_celebrations',0))
        port=server.server_port
        server.RequestHandlerClass=handler(service,ROOT/'mini projects/twitch_celebrations',port)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        url=f'http://127.0.0.1:{port}'
        try:
            with urlopen(url+'/') as r: self.assertIn(b'Let the spirits celebrate',r.read())
            # Approved follower sprites belong to celebrations. Transition-art
            # cleanup must not remove their dependencies or break readiness.
            for name in ('bear-attack.png','turtle.png','ram-charge.png','phoenix-hero.png'):
                with urlopen(url+'/spirit/assets/'+name) as r:
                    self.assertEqual(r.read(),(ROOT/'mini projects/twitch_celebrations/spirit_assets'/name).read_bytes())
            with self.assertRaises(HTTPError) as missing:
                urlopen(url+'/spirit/assets/../settings.json')
            self.assertEqual(missing.exception.code,404)
            request=Request(url+'/api/test',data=b'{"kind":"raid"}',headers={'Content-Type':'application/json'})
            with self.assertRaises(HTTPError) as exc:urlopen(request)
            self.assertEqual(exc.exception.code,403)
            request.add_header('X-Hub-CSRF',service.csrf)
            with urlopen(request) as r:self.assertTrue(json.load(r)['ok'])
            with urlopen(url+'/api/state') as r:self.assertIsNone(json.load(r)['active'])
            with urlopen(url+'/api/overlay') as r:self.assertEqual(json.load(r)['active']['kind'],'raid')
            self.assertIsNone(service.asset('../settings.json'))
            self.assertIsNone(service.asset('crab.wav','visual'))
        finally:
            server.shutdown();server.server_close();thread.join()


class TransportTests(unittest.TestCase):
    def test_incoming_raid_and_partial_permissions(self):
        from unittest.mock import Mock
        twitch=Twitch(threading.Event(),lambda *args:None)
        ok=Mock(status_code=202);denied=Mock(status_code=403)
        with patch.dict(os.environ,{'TWITCH_BROADCASTER_ID':'123','TWITCH_CLIENT_ID':'client'}), \
             patch('twitch_celebrations.twitch.requests.post',side_effect=[ok,denied,denied,denied,denied,denied]) as request:
            twitch.subscribe('session','token')
        raid=request.call_args_list[0].kwargs['json']
        self.assertEqual(raid['condition'],{'to_broadcaster_user_id':'123'})
        self.assertEqual(raid['transport'],{'method':'websocket','session_id':'session'})
        self.assertTrue(twitch.subscriptions['raid']['enabled'])
        self.assertFalse(twitch.subscriptions['follow']['enabled'])
        self.assertFalse(twitch.subscriptions['resub']['enabled'])

    def test_resub_details_and_anonymous_gifts_normalize_without_duplicate_gift_subs(self):
        from unittest.mock import Mock
        receive=Mock();twitch=Twitch(threading.Event(),receive)
        msg={'metadata':{'subscription_type':'channel.subscription.message','message_id':'resub1'},
             'payload':{'event':{'broadcaster_user_id':'123','user_name':'Loyal Friend','tier':'3000',
                                'cumulative_months':18,'streak_months':None,'message':{'text':'Love this crew <3'}}}}
        with patch.dict(os.environ,{'TWITCH_BROADCASTER_ID':'123'}):
            twitch.notification(msg)
            args,kwargs=receive.call_args
            self.assertEqual(args,('subscribe','Loyal Friend',1,'resub1'))
            self.assertEqual(kwargs['details'],dict(tier='3000',months=18,streak=None,message='Love this crew <3',renewal=True))
            msg['metadata']['subscription_type']='channel.subscription.gift'
            msg['payload']['event']=dict(broadcaster_user_id='123',user_name='Ignore for anonymity',is_anonymous=True,total=5,tier='2000')
            twitch.notification(msg)
            self.assertEqual(receive.call_args.args[:3],('gift','Anonymous legend',5))

    def test_personal_subscription_contract_and_shorter_followers(self):
        e=Engine(clock=lambda:0)
        e.submit('follow','New friend')
        e.submit('subscribe','Supporter',event_id='sub1',details={'tier':'2000','months':18,'streak':None,'message':'  love\n this  crew ','renewal':True,'ignored':'no'})
        self.assertFalse(e.submit('subscribe','Supporter',event_id='sub1'))
        item=e.snapshot()
        self.assertEqual(item['kind'],'subscribe')
        self.assertEqual(item['duration'],3.8)
        self.assertEqual(item['details'],dict(tier='2000',months=18,message='love this crew',renewal=True))
        e.clear();e.submit('follow','Friend',details={'tier':'3000'})
        self.assertEqual(e.snapshot()['duration'],2.2)
        self.assertEqual(e.snapshot()['details'],{})
        e.clear();e.submit('subscribe','Friend',details={'tier':'Prime','months':True,'streak':-1})
        self.assertEqual(e.snapshot()['details'],{})

    def test_token_validation_rejects_wrong_owner_or_client(self):
        from unittest.mock import Mock
        twitch=Twitch(threading.Event(),lambda *args:None)
        response=Mock();response.json.return_value={'user_id':'someone-else','client_id':'client'}
        with patch.dict(os.environ,{'TWITCH_BROADCASTER_ID':'123','TWITCH_CLIENT_ID':'client'}), \
             patch('twitch_celebrations.twitch.requests.get',return_value=response):
            with self.assertRaises(ValueError):twitch.validate_token('token')
            response.json.return_value={'user_id':'123','client_id':'different-client'}
            with self.assertRaises(ValueError):twitch.validate_token('token')

    def test_reconnect_handoff_keeps_subscriptions_and_delivers_notification(self):
        from unittest.mock import Mock
        import time
        stop=threading.Event();twitch=Twitch(stop,lambda *args:None)
        welcome=lambda sid:json.dumps({'metadata':{'message_type':'session_welcome'},'payload':{'session':{'id':sid}}})
        reconnect=json.dumps({'metadata':{'message_type':'session_reconnect'},'payload':{'session':{'reconnect_url':'wss://eventsub.wss.twitch.tv/ws?handoff=test'}}})
        notification=json.dumps({'metadata':{'message_type':'notification'},'payload':{}})
        old=Mock();old.recv.side_effect=[welcome('old'),reconnect]
        replacement=Mock();replacement.recv.side_effect=[welcome('new'),notification]
        twitch.last_validated=time.monotonic()
        twitch.tokens={'access_token':'fixture'}
        def subscribe(*args):twitch.subscriptions={'raid':{'enabled':True,'status':202}}
        with patch.object(twitch,'token',return_value='fixture'),patch.object(twitch,'validate_token'), \
             patch.object(twitch,'subscribe',side_effect=subscribe) as subscriptions, \
             patch.object(twitch,'notification',side_effect=lambda msg:stop.set()) as receive, \
             patch('websocket.create_connection',side_effect=[old,replacement]) as connect:
            twitch.listen()
        subscriptions.assert_called_once_with('old','fixture')
        receive.assert_called_once()
        self.assertEqual(connect.call_args_list[1].args[0],'wss://eventsub.wss.twitch.tv/ws?handoff=test')
        old.close.assert_called_once();replacement.close.assert_called_once()


class OBSAttachmentTests(unittest.TestCase):
    def test_existing_source_repairs_browser_contract_without_resetting_user_data(self):
        from unittest.mock import Mock
        from twitch_celebrations.main import SOURCE
        c=Mock()
        settings=dict(url='http://127.0.0.1:7443/overlay',width=1920,height=1080,
                      fps=60,reroute_audio=True,shutdown=False,restart_when_active=False)
        answers={
            'GetInputList':{'inputs':[{'inputName':SOURCE,'inputKind':'browser_source'}]},
            'GetInputSettings':{'inputSettings':settings},
            'GetSceneItemList':{'sceneItems':[{'sourceName':SOURCE,'sceneItemId':19}]},
        }
        c.send.side_effect=lambda request,*args,**kwargs:answers.get(request,{})
        s=Service(threading.Event())
        with patch('obs.get_obs',return_value=c),patch('obs.get_current_scene',return_value='Test'), \
             patch('obs.ensure_input_on_stream_track') as tracks, \
             patch('lib.settings_backups.SettingsBackups.snapshot') as backup:
            self.assertEqual(s.attach_obs(),'Test')
        backup.assert_called_once()
        tracks.assert_called_once_with(SOURCE)
        mutations=[call for call in c.send.call_args_list if call.args[0].startswith(('Set','Create'))]
        self.assertEqual(len(mutations),1)
        self.assertEqual(mutations[0].args,('SetInputSettings',dict(inputName=SOURCE,inputSettings={'fps':30,'fps_custom':True},overlay=True)))

    def test_existing_30_fps_source_enables_custom_rate_and_preserves_extra_settings(self):
        from unittest.mock import Mock
        from twitch_celebrations.main import SOURCE
        c=Mock()
        settings=dict(url='http://127.0.0.1:7443/overlay',width=1920,height=1080,
                      fps=30,fps_custom=False,reroute_audio=True,shutdown=False,restart_when_active=False,
                      custom_css='personal CSS',unknown_option='preserve')
        answers={
            'GetInputList':{'inputs':[{'inputName':SOURCE,'inputKind':'browser_source'}]},
            'GetInputSettings':{'inputSettings':settings},
            'GetSceneItemList':{'sceneItems':[{'sourceName':SOURCE,'sceneItemId':19}]},
        }
        c.send.side_effect=lambda request,*args,**kwargs:answers.get(request,{})
        with patch('obs.get_obs',return_value=c),patch('obs.get_current_scene',return_value='Test'), \
             patch('obs.ensure_input_on_stream_track'),patch('lib.settings_backups.SettingsBackups.snapshot'):
            Service(threading.Event()).attach_obs()
        mutations=[call for call in c.send.call_args_list if call.args[0].startswith(('Set','Create'))]
        self.assertEqual(len(mutations),1)
        self.assertEqual(mutations[0].args,('SetInputSettings',dict(inputName=SOURCE,inputSettings={'fps_custom':True},overlay=True)))

    def test_new_source_uses_custom_30_fps(self):
        from unittest.mock import Mock
        c=Mock()
        c.send.side_effect=lambda request,*args,**kwargs:{'inputs':[]} if request=='GetInputList' else {}
        with patch('obs.get_obs',return_value=c),patch('obs.get_current_scene',return_value='Test'), \
             patch('obs.ensure_input_on_stream_track'),patch('lib.settings_backups.SettingsBackups.snapshot'):
            Service(threading.Event()).attach_obs()
        created=next(call.args[1]['inputSettings'] for call in c.send.call_args_list if call.args[0]=='CreateInput')
        self.assertEqual(created['fps'],30)
        self.assertTrue(created['fps_custom'])
        self.assertFalse(created['shutdown'])


if __name__=='__main__':unittest.main()
