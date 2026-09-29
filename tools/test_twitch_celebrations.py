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
            with urlopen(url+'/') as r: self.assertIn(b'Let the borders party',r.read())
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


if __name__=='__main__':unittest.main()
