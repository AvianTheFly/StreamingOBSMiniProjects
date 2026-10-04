"""Riot identity, budget/retry isolation and rank/goal evidence regressions."""
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import Mock,patch
from tools import test_league_stats as fixtures
from tools.test_league_stats_extensions import timeline_data
from league_stats.riot import RiotClient,KeySource,Deferred,RiotFailure
from league_stats.enrichment import Enrichment
from league_stats.collector import Collector
from league_stats import ranked


def response(data=None,code=200,headers=None):
    r=Mock(status_code=code,headers=headers or {});r.json.return_value=data
    return r


class TransportTests(unittest.TestCase):
    def setUp(self):
        self.now=1000;self.key='private-fixture-key';self.http=Mock()
        keys=Mock();keys.read.side_effect=lambda:(self.key,'fixture')
        self.riot=RiotClient(self.http,keys=keys,clock=lambda:self.now,wall=lambda:1000000+self.now)

    def test_key_refresh_invalidates_identity_and_public_state_has_no_secret(self):
        self.http.get.return_value=response({'puuid':'remote'})
        self.assertEqual(self.riot.identity('Tester','NA1','na1'),'remote')
        self.assertEqual(self.riot.identity('Tester','NA1','na1'),'remote');self.assertEqual(self.http.get.call_count,1)
        self.key='different-secret';self.now+=2;self.riot.identity('Tester','NA1','na1')
        self.assertEqual(self.http.get.call_count,2)
        self.assertNotIn(self.key,json.dumps(self.riot.snapshot()))
        self.key='';self.assertFalse(self.riot.snapshot()['configured'])

    def test_budget_headers_pause_before_next_request(self):
        self.http.get.return_value=response({},headers={'X-App-Rate-Limit':'2:120','X-App-Rate-Limit-Count':'2:120'})
        self.riot.match(7,'na1');self.now+=2
        with self.assertRaises(Deferred):self.riot.match(8,'na1')
        self.assertEqual(self.http.get.call_count,1)
        self.now+=121;self.riot.match(8,'na1');self.assertEqual(self.http.get.call_count,2)

    def test_429_retry_after_is_honored_and_auth_refusal_clears_on_new_key(self):
        self.http.get.return_value=response(code=429,headers={'Retry-After':'180'})
        with self.assertRaises(Deferred):self.riot.match(7,'na1')
        self.now+=179
        with self.assertRaises(Deferred):self.riot.match(7,'na1')
        self.assertEqual(self.http.get.call_count,1)
        self.now+=1;self.http.get.return_value=response(code=403)
        with self.assertRaises(Deferred):self.riot.match(7,'na1')
        self.key='replacement';self.now+=2;self.http.get.return_value=response({})
        self.riot.match(7,'na1');self.assertEqual(self.riot.state,'connected')

    def test_404_is_distinct_and_failure_does_not_expose_response_body(self):
        self.http.get.return_value=response(code=404)
        self.assertIsNone(self.riot.match(7,'na1'))
        self.now+=2;self.http.get.return_value=response({'token':self.key},code=500)
        with self.assertRaises(RiotFailure) as exc:self.riot.match(7,'na1')
        self.assertNotIn(self.key,str(exc.exception))
        args=self.http.get.call_args
        self.assertFalse(args.kwargs['allow_redirects'])
        self.assertNotIn(self.key,args.args[0])

    def test_file_key_replacement_does_not_need_process_restart_or_change_other_settings(self):
        with tempfile.TemporaryDirectory() as folder,patch.dict('os.environ',{},clear=True):
            path=Path(folder)/'.env';path.write_text('REPLAY_DIR=C:/StreamingMedia/Replays\nRIOT_API_KEY=first\n')
            source=KeySource(path);self.assertEqual(source.read()[0],'first')
            path.write_text('REPLAY_DIR=C:/StreamingMedia/Replays\nRIOT_API_KEY=second\n')
            self.assertEqual(source.read()[0],'second')
            self.assertIn('REPLAY_DIR=C:/StreamingMedia/Replays',path.read_text())
            with patch.dict('os.environ',{'RIOT_API_KEY':'environment'}):self.assertEqual(source.read()[0],'environment')


class WorkflowTests(unittest.TestCase):
    setUp=fixtures.TrackerTests.setUp
    new_tracker=fixtures.TrackerTests.new_tracker
    advance=fixtures.TrackerTests.advance

    def make_work(self):
        self.tracker.enrich(fixtures.match(),'p')
        self.tracker.identify('p','Tester','NA1')
        keys=Mock();keys.read.return_value=('fixture-key','fixture')
        self.http=Mock();self.riot=RiotClient(self.http,keys=keys,clock=lambda:self.tick,wall=lambda:self.now)
        return Enrichment(self.tracker,self.riot)

    def test_different_public_identifier_merges_same_archive_and_timeline(self):
        work=self.make_work()
        official=fixtures.match(modern=True);official['metadata']={'matchId':'NA1_7'}
        official['info']['participants'][0]['puuid']='api-puuid'
        timeline=timeline_data();timeline['info']['participants'][0]['puuid']='api-puuid'
        self.http.get.side_effect=[response({'puuid':'api-puuid'}),response(official),response(timeline)]
        work.tick();self.assertEqual(len(work.pending),1)  # Match waits after identity request.
        self.advance(2);work.tick();self.assertEqual(work.saved_matches,1)
        self.advance(2);work.tick();self.assertEqual(work.saved_timelines,1)
        saved=self.store.get('p:7')
        self.assertEqual(saved['account'],'p');self.assertEqual(saved['api_account'],'api-puuid')
        self.assertEqual(saved['metrics']['cs_at_10'],72);self.assertEqual(len(self.tracker.records),1)
        self.assertEqual(saved['timeline_version'],1)

    def test_foreign_public_participant_is_never_credited(self):
        work=self.make_work();data=fixtures.match(modern=True);data['metadata']={'matchId':'NA1_7'}
        self.http.get.side_effect=[response({'puuid':'foreign'}),response(data)]
        work.tick();self.advance(2);work.tick()
        self.assertEqual(self.tracker.records['p:7']['source'],'league_client')
        self.assertEqual(work.saved_matches,0)

    def test_backoff_keeps_queue_and_does_not_consume_retries(self):
        work=self.make_work();self.http.get.return_value=response(code=429,headers={'Retry-After':'60'})
        for _ in range(10):work.tick();self.advance(1)
        self.assertEqual(work.pending[0][2],0);self.assertEqual(self.http.get.call_count,1)
        work.retry();work.tick();self.assertEqual(self.http.get.call_count,1)

    def test_collector_enriches_archive_even_when_launcher_is_closed(self):
        work=self.make_work();collector=Collector(self.tracker,threading.Event(),client=Mock())
        self.addCleanup(collector.http.close);collector.enrichment=work
        collector.next_client=float('inf');collector.account=None
        with patch.object(work,'tick') as tick:collector.step();tick.assert_called_once()

    def test_rank_session_baseline_and_promotion_survive_restart(self):
        def data(division,lp,wins):return {'queueMap':{'RANKED_SOLO_5x5':dict(tier='GOLD',division=division,leaguePoints=lp,wins=wins,losses=4)}}
        self.tracker.account='p'
        self.store.metadata('last_account',{'id':'p','name':'Tester'})
        self.tracker.observe_rank('p',data('II',90,10));self.advance(120)
        self.tracker.observe_rank('p',data('I',15,11))
        result=self.tracker.snapshot()['ranked'][0]
        self.assertEqual(result['session_movement'],25)
        self.tracker=self.new_tracker();self.assertEqual(self.tracker.snapshot()['ranked'][0]['session_movement'],25)
        self.advance(1);self.tracker.start_session({'name':'Next stream'})
        self.assertIsNone(self.tracker.snapshot()['ranked'][0]['session_movement'])
        self.tracker.observe_rank('p',data('I',15,11))
        self.assertEqual(self.tracker.snapshot()['ranked'][0]['session_movement'],0)

    def test_unranked_provisional_and_reset_do_not_claim_lp_movement(self):
        self.assertIsNone(ranked.score(dict(tier='NONE',division='',lp=0,provisional=False)))
        self.assertIsNone(ranked.score(dict(tier='GOLD',division='I',lp=15,provisional=True)))
        data={'queueMap':{'RANKED_SOLO_5x5':dict(tier='GOLD',division='I',leaguePoints=90,wins=50,losses=20)}}
        self.tracker.account='p';self.tracker.observe_rank('p',data);self.advance(60)
        data['queueMap']['RANKED_SOLO_5x5'].update(wins=1,losses=0,leaguePoints=0)
        self.tracker.observe_rank('p',data);self.assertIsNone(self.tracker.snapshot()['ranked'][0]['session_movement'])

    def test_recap_and_goal_use_completed_covered_session_games(self):
        game=fixtures.match();game['gameCreation']=self.now*1000
        self.tracker.enrich(game,'p');self.tracker.account='p'
        s=self.tracker.snapshot();self.assertEqual(s['recap']['metrics']['cs_per_minute'],7.5)
        self.assertEqual(s['progress']['reached_games'],1)
        self.tracker.review_match({'id':'p:7','revision':0,'excluded':True})
        s=self.tracker.snapshot();self.assertIsNone(s['recap']);self.assertEqual(s['progress']['covered_games'],0)


if __name__=='__main__':unittest.main()
