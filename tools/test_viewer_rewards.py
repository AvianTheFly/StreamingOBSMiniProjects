"""Offline tests: no OBS operations, no Twitch writes, no personal settings."""
import os
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from http.server import ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import json

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.viewer_rewards import RewardBridge, EFFECTS


class ViewerRewardsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {"TWITCH_BROADCASTER_ID": "owner"})
        self.env.start()
        self.now = 100.0
        self.b = RewardBridge(threading.Event(), self.tmp.name, lambda: self.now)
        self.b.config = {"enabled": True, "rewards": {"bear": "reward1"}}
        self.b.next_effect()

    def tearDown(self):
        self.b.db.close()
        self.env.stop()
        self.tmp.cleanup()

    def event(self, rid="redeem1", **kwargs):
        return dict(id=rid, broadcaster_user_id="owner", status="unfulfilled", reward={"id": "reward1"}, **kwargs)

    def test_only_explicit_ids_can_control_overlay(self):
        event = self.event(user_input='../../anything; set volume 100')
        event["reward"]["id"] = "unmapped"
        self.assertFalse(self.b.receive(event))
        event["reward"]["id"] = "reward1"
        event["broadcaster_user_id"] = "someone-else"
        self.assertFalse(self.b.receive(event))
        self.assertIsNone(self.b.pending)

    def test_duplicate_persists_across_restart(self):
        self.assertTrue(self.b.receive(self.event()))
        self.assertFalse(self.b.receive(self.event()))
        self.b.db.close()
        self.b = RewardBridge(threading.Event(), self.tmp.name, lambda: self.now)
        self.b.config = {"enabled": True, "rewards": {"bear": "reward1"}}
        self.assertFalse(self.b.receive(self.event()))
        self.assertIn("interrupted", self.b.status()["recent"][0]["status"])

    def test_requires_overlay_and_operator_enable(self):
        self.b.config["enabled"] = False
        self.assertFalse(self.b.receive(self.event()))
        self.b.config["enabled"] = True
        self.now += 10
        self.assertFalse(self.b.receive(self.event("redeem2")))
        self.assertIsNone(self.b.pending)

    def test_ack_required_before_fulfilling(self):
        calls = []
        self.b.api = lambda *a, **kw: calls.append((a, kw))
        self.b.receive(self.event())
        self.b.acknowledge("redeem1")
        self.assertEqual(calls, [])
        effect = self.b.next_effect()
        self.assertEqual(effect["duration"], 1000)
        self.assertIsNone(self.b.next_effect())
        self.b.acknowledge("other-id")
        self.assertEqual(calls, [])
        self.b.acknowledge("redeem1")
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0][1]["json"], {"status": "FULFILLED"})

    def test_busy_and_timeout_remain_refundable(self):
        self.b.receive(self.event())
        self.assertFalse(self.b.receive(self.event("redeem2")))
        self.now += 10
        self.b.next_effect()
        self.assertIsNone(self.b.pending)
        self.assertTrue(all("refund" in x["status"] for x in self.b.status()["recent"]))

    def test_test_button_never_fulfills_a_twitch_redemption(self):
        self.b.api = lambda *a, **kw: self.fail("Unexpected Twitch call")
        self.b.enqueue("bear")
        e = self.b.next_effect()
        self.b.acknowledge(e["id"])
        self.assertEqual(self.b.status()["recent"], [])

    def test_effect_bounds_and_assets(self):
        from lib.viewer_rewards import ASSETS
        for effect in EFFECTS.values():
            self.assertLessEqual(effect["duration"], 2000)
            self.assertLessEqual(effect["cost"], 50)
            self.assertTrue((ASSETS / effect["image"]).is_file())

    def test_settings_preserve_ids_enabled_and_unrelated_personal_data(self):
        from lib.twitch_redemptions.config import configure_effect
        self.b.config['personal']={'anything':42}
        configure_effect(self.b,'bear',{'duration':600,'style':'party','label':'GO!','enabled':False})
        saved=json.loads((Path(self.tmp.name)/'settings.json').read_text())
        self.assertEqual(saved['rewards'],{'bear':'reward1'})
        self.assertEqual(saved['personal'],{'anything':42})
        self.assertTrue(saved['enabled'])
        self.assertFalse(self.b.receive(self.event()))
        self.now+=3
        self.b.enqueue('bear') # A paused reward can still be tested without points.
        effect=self.b.next_effect()
        self.assertEqual(effect['duration'],600)
        self.assertEqual(effect['style'],'party')

    def test_configuration_cannot_supply_media_or_long_effects(self):
        from lib.twitch_redemptions.config import configure_effect
        for value in ({'duration':2001},{'duration':True},{'image':'../../file'}, {'color':'not hex'}, {'enabled':'yes'}):
            with self.assertRaises(ValueError):configure_effect(self.b,'bear',value)
        self.assertNotIn('effects',self.b.config)

    def test_failed_overlay_is_not_fulfilled(self):
        self.b.api=lambda *a,**kw:self.fail('Failed effect must remain refundable')
        self.b.receive(self.event());self.b.next_effect();self.b.acknowledge('redeem1','error')
        self.assertIn('refund',self.b.status()['recent'][0]['status'])
        self.assertEqual(self.b.status()['last_effect']['status'],'failed')

    def test_hidden_overlay_does_not_accept_or_fulfill_redemptions(self):
        self.assertIsNone(self.b.next_effect(active=False))
        self.assertFalse(self.b.status()['overlay_ready'])
        self.assertFalse(self.b.receive(self.event()))
        self.assertIsNone(self.b.pending)

    def test_obs_startup_reuses_input_without_scene_changes(self):
        from unittest.mock import Mock
        from lib.twitch_redemptions.obs_source import attach_obs
        client=Mock()
        client.send.return_value={'inputs':[{'inputName':'Hub Viewer Stickers','inputKind':'browser_source'}]}
        with patch('lib.twitch_redemptions.obs_source.obs.get_obs',return_value=client), \
             patch('lib.twitch_redemptions.obs_source.SettingsBackups'):
            self.assertTrue(attach_obs(self.b,existing_only=True))
        calls=[call.args[0] for call in client.send.call_args_list]
        self.assertEqual(calls,['GetInputList','SetInputSettings','PressInputPropertiesButton'])
        settings=client.send.call_args_list[1].args[1]['inputSettings']
        self.assertFalse(settings['shutdown']);self.assertFalse(settings['restart_when_active'])

    def test_unauthorized_api_refreshes_once_and_retries(self):
        from unittest.mock import Mock
        self.b.tokens={'access_token':'fake'}
        self.b.token=Mock(side_effect=['old','new'])
        bad=Mock(status_code=401,ok=False);good=Mock(status_code=200,ok=True,content=b'{}')
        good.json.return_value={'data':[]}
        with patch.dict(os.environ,{'TWITCH_CLIENT_ID':'app'}), \
             patch('lib.twitch_redemptions.transport.requests.request',side_effect=[bad,good]) as request:
            self.assertEqual(self.b.api('GET','channel_points/custom_rewards'),{'data':[]})
        self.assertEqual(request.call_count,2)
        self.assertEqual(request.call_args.kwargs['headers']['Authorization'],'Bearer new')

    def test_eventsub_notification_reaches_mapped_reward_engine(self):
        from unittest.mock import Mock
        sock=Mock();self.b.tokens={'access_token':'fake'};self.b.validate_connection=Mock()
        subscribed=[];self.b.api=lambda *a,**kw:subscribed.append((a,kw))
        messages=[{'metadata':{'message_type':'session_welcome'},'payload':{'session':{'id':'session'}}},
                  {'metadata':{'message_type':'notification','subscription_type':'channel.channel_points_custom_reward_redemption.add'},'payload':{'event':self.event()}}]
        def receive():
            if messages:return json.dumps(messages.pop(0))
            self.b.stop.set();raise EOFError()
        sock.recv.side_effect=receive
        with patch('websocket.create_connection',return_value=sock):self.b.listen()
        self.assertEqual(subscribed[0][1]['json']['transport']['session_id'],'session')
        self.assertEqual(self.b.next_effect()['id'],'redeem1')

    def test_availability_only_pauses_mapped_rewards_and_respects_per_reward_toggle(self):
        self.b.config['rewards']['party']='reward2'
        self.b.config['effects']={'party': {'enabled':False}}
        self.b.connected=True;self.b.tokens={'access_token':'fake'}
        calls=[]
        self.b.api=lambda *a,**kw:calls.append((a,kw))
        self.b.refresh_rewards=lambda:None
        self.b.stop.wait=lambda seconds:self.b.stop.set()
        self.b.sync_availability()
        self.assertEqual({kw['params']['id']:kw['json']['is_paused'] for _,kw in calls},
                         {'reward1':False,'reward2':True})

    def test_http_protects_configuration_and_serves_overlay_modules(self):
        from lib.twitch_redemptions.http_server import handler
        server=ThreadingHTTPServer(('127.0.0.1',0),handler(self.b))
        server.RequestHandlerClass=handler(self.b,server.server_port)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        url=f'http://127.0.0.1:{server.server_port}'
        try:
            with urlopen(url+'/web/renderer.js') as response:self.assertIn(b'EffectShow',response.read())
            body=json.dumps({'key':'bear','settings':{'duration':700}}).encode()
            with self.assertRaises(HTTPError) as error:urlopen(Request(url+'/api/configure',data=body))
            self.assertEqual(error.exception.code,403)
            with self.assertRaises(HTTPError) as error:urlopen(Request(url+'/api/configure',data=body,headers={'X-Hub-CSRF':self.b.csrf,'Origin':'https://elsewhere.test'}))
            self.assertEqual(error.exception.code,403)
            with urlopen(Request(url+'/api/configure',data=body,headers={'X-Hub-CSRF':self.b.csrf})) as response:self.assertEqual(response.status,200)
            with self.assertRaises(HTTPError) as error:urlopen(url+'/api/next?key=wrong')
            self.assertEqual(error.exception.code,403)
            self.assertEqual(self.b.config['effects']['bear']['duration'],700)
        finally:
            server.shutdown();server.server_close();thread.join()


if __name__ == "__main__":
    unittest.main()
