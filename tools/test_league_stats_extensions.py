"""Evidence coverage, session persistence, reversible reviews and viewer requests."""
import copy
import threading
import unittest
from unittest.mock import patch
from tools import test_league_stats as fixtures
match=fixtures.match
from league_stats import analytics, commands, config, insights, timeline
from league_stats.community import Community
from league_stats.collector import Collector


def timeline_data():
    own=dict(totalGold=3000,xp=2000,level=6,minionsKilled=70,jungleMinionsKilled=2)
    enemy=dict(totalGold=3200,xp=1900,level=6,minionsKilled=80,jungleMinionsKilled=0)
    events=[dict(type='ITEM_PURCHASED',participantId=1,itemId=2003,timestamp=100),
            dict(type='ITEM_PURCHASED',participantId=1,itemId=2003,timestamp=100),
            dict(type='ITEM_UNDO',participantId=1,beforeId=2003,afterId=0,timestamp=200),
            dict(type='CHAMPION_KILL',killerId=3,victimId=1,timestamp=200000),
            dict(type='CHAMPION_KILL',killerId=1,victimId=3,timestamp=300000),
            dict(type='LEVEL_UP',participantId=1,level=6,timestamp=400000)]
    return dict(metadata=dict(matchId='NA1_7'),info=dict(participants=[dict(participantId=1,puuid='p')],
        frames=[dict(timestamp=600000,participantFrames={'1':own,'3':enemy},events=events)]))


class ExtensionTests(unittest.TestCase):
    setUp=fixtures.TrackerTests.setUp
    new_tracker=fixtures.TrackerTests.new_tracker
    ingest=fixtures.TrackerTests.ingest
    advance=fixtures.TrackerTests.advance

    def test_session_survives_restart_and_saved_bounds_are_exclusive(self):
        first=self.tracker.sessions.state['current']
        self.tracker=self.new_tracker()
        self.assertEqual(self.tracker.sessions.state['current'],first)
        self.advance(1200)
        self.tracker.start_session({'name':'Next stream'})
        for game_id,stamp in [(1,first['started_at']),(2,self.now)]:
            data=match(game_id);data['gameCreation']=stamp*1000
            self.tracker.enrich(data,'p')
        self.tracker.account='p'
        self.assertEqual([r['game_id'] for r in self.tracker.export(session_id=first['id'])['matches']],['1'])
        self.assertEqual([r['game_id'] for r in self.tracker.export(period='session')['matches']],['2'])
        self.ingest()
        with self.assertRaisesRegex(ValueError,'between games'):self.tracker.start_session({'name':'Bad boundary'})

    def test_review_exclusion_is_reversible_and_survives_enrichment(self):
        self.tracker.enrich(match(),'p');self.tracker.account='p'
        self.tracker.review_match(dict(id='p:7',revision=0,note='Practice game',excluded=True))
        self.tracker.enrich(match(modern=True),'p')
        self.assertEqual(self.tracker.snapshot()['summary']['completed_games'],0)
        saved=self.tracker.export()['matches'][0]
        self.assertEqual(saved['review']['note'],'Practice game')
        self.assertIn('raw_postgame',self.store.get('p:7'))
        with self.assertRaisesRegex(ValueError,'edited elsewhere'):
            self.tracker.review_match(dict(id='p:7',revision=0,note='Overwrite'))
        self.tracker.review_match(dict(id='p:7',revision=1,excluded=False))
        self.assertEqual(self.tracker.snapshot()['summary']['completed_games'],1)

    def test_custom_counter_history_targeted_undo_and_write_failure(self):
        self.tracker.settings['custom_counters']={'bad_recall':'Bad recalls'}
        self.ingest();self.tracker.observe('add','custom_bad_recall',actor='helper')
        identity=self.tracker.current['observations'][0]['id']
        self.advance(16);self.ingest(616);self.tracker.observe('add','missed_cannon')
        self.tracker.settings['custom_counters']={}
        before=copy.deepcopy(self.tracker.current)
        with patch.object(self.store,'put',side_effect=OSError('disk full')):
            with self.assertRaises(OSError):self.tracker.correct_observation(dict(match_id='p:7',observation_id=identity))
        self.assertEqual(self.tracker.current,before)
        with self.assertRaises(ValueError):self.tracker.correct_observation(dict(match_id='p:7'))
        self.tracker.correct_observation(dict(match_id='p:7',observation_id=identity))
        self.assertEqual(self.tracker.current['metrics']['custom_bad_recall'],0)
        self.assertEqual(self.tracker.current['metrics']['missed_cannon'],1)
        self.assertEqual(self.tracker.current['observations'][0]['label'],'Bad recalls')

    def test_viewer_request_between_games_is_readonly_and_blockable(self):
        msg=dict(user='viewer',channel='owner',text='!stats cs',id='one')
        self.tracker.enqueue_chat(msg);self.tracker.drain_chat()
        self.assertEqual(self.tracker.snapshot()['spotlight']['requested_by'],'viewer')
        self.assertEqual(self.tracker.records,{})
        self.tracker.community.clear();self.advance(65)
        self.tracker.settings['blocked_helpers']=['viewer']
        self.tracker.enqueue_chat({**msg,'id':'two'});self.tracker.drain_chat()
        self.assertIsNone(self.tracker.snapshot()['spotlight'])

    def test_timeline_reconciliation_preserves_notes_and_is_idempotent(self):
        self.tracker.enrich(match(modern=True),'p')
        self.tracker.review_match(dict(id='p:7',revision=0,note='Keep me'))
        for _ in range(2):self.tracker.enrich_timeline(timeline_data(),'p:7')
        result=self.tracker.records['p:7']
        self.assertEqual(result['metrics']['cs_at_10'],72)
        self.assertEqual(result['metrics']['cs_difference_at_10'],-8)
        self.assertEqual(result['metrics']['gold_difference_at_10'],-200)
        self.assertEqual(result['metrics']['kills_before_10'],1)
        self.assertEqual(result['review']['note'],'Keep me')
        self.assertEqual(len(result['purchase_events']),3)
        self.assertNotIn('raw_timeline',result)
        self.assertIn('raw_timeline',self.store.get('p:7'))

    def test_collector_keeps_local_history_independent_of_optional_enrichment(self):
        self.tracker.enrich(match(modern=True),'p')
        collector=Collector(self.tracker,threading.Event())
        self.addCleanup(collector.http.close)
        collector.account={'puuid':'p'}
        with patch.object(collector.client,'get',return_value={'games':{'games':[{'gameId':7}]}}):
            collector.plan_history(20);collector.plan_history(20)
        self.assertFalse(collector.pending)
        self.assertFalse(self.tracker.import_busy)


class EvidenceTests(unittest.TestCase):
    def test_missing_timeline_data_is_unknown_and_foreign_identity_rejected(self):
        record=dict(game_id=7,account='p',participant_id=1,duration=1200)
        data=timeline_data()
        result=timeline.extract(data,record)
        self.assertNotIn('cs_difference_at_10',result['metrics'])
        data['info']['frames'][0]['timestamp']=500000
        result=timeline.extract(data,record)
        self.assertNotIn('cs_at_10',result['metrics'])
        self.assertNotIn('kills_before_10',result['metrics'])
        data['info']['frames'][0]['timestamp']=None
        with self.assertRaises(ValueError):timeline.extract(data,record)
        data=timeline_data();data['metadata']['matchId']='NA1_8'
        with self.assertRaises(ValueError):timeline.extract(data,record)
        data=timeline_data();data['info']['participants'][0]['puuid']='foreign'
        with self.assertRaises(ValueError):timeline.extract(data,record)

    def test_rates_have_coverage_and_no_meaningless_sum(self):
        r=dict(state='complete',duration=1200,metrics=dict(damage_champions=20000,team_damage_champions=80000,dead_seconds=120))
        calculated=insights.derived(r)['metrics']
        self.assertEqual(calculated['damage_per_minute'],1000)
        self.assertEqual(calculated['damage_share_pct'],25)
        self.assertEqual(calculated['time_dead_pct'],10)
        self.assertNotIn('gold_per_minute',calculated)
        totals=analytics.aggregate([r,dict(state='complete',duration=100,metrics={})])['metrics']['damage_per_minute']
        self.assertIsNone(totals['total']);self.assertEqual(totals['average'],1000);self.assertEqual(totals['completed_games'],1)

    def test_streak_unknown_result_breaks_run_and_trends_use_covered_games(self):
        records=[dict(state='complete',started_at=i,win=True,duration=600,metrics=dict(cs=i+1,deaths=0)) for i in range(22)]
        records[-2]['win']=None
        report=insights.report(records)
        self.assertEqual(report['streak']['current'],1)
        self.assertEqual(report['streak']['longest_wins'],20)
        self.assertEqual(report['deathless_games'],22)
        cs=next(t for t in report['trends'] if t['metric']=='cs_per_minute')
        self.assertAlmostEqual(cs['change'],1)

    def test_viewer_limits_expiry_and_bounded_memory(self):
        now=[1000];c=Community(lambda:now[0])
        self.assertTrue(c.request('cs','viewer','1',config.DEFAULTS))
        self.assertFalse(c.request('kda','other','2',config.DEFAULTS))
        now[0]+=13;self.assertIsNone(c.snapshot())
        self.assertFalse(c.request('cs','viewer','3',config.DEFAULTS))
        self.assertTrue(c.request('cs','other','2',config.DEFAULTS))
        now[0]+=60;self.assertFalse(c.request('cs','viewer','1',config.DEFAULTS))
        with self.assertRaises(ValueError):c.request('cs','third','4',dict(viewer_requests=False))
        for i in range(1100):
            now[0]+=60;c.request('cs',str(i),str(i+10),config.DEFAULTS)
        self.assertLessEqual(len(c.users),512);self.assertLessEqual(len(c.seen),1024);self.assertEqual(len(c.activity),20)

    def test_command_permissions_named_helper_and_block_override(self):
        settings={**config.DEFAULTS,'helpers':['friend'],'blocked_helpers':['blocked']}
        self.assertTrue(commands.authorized(dict(user='friend',channel='owner'),settings))
        self.assertFalse(commands.authorized(dict(user='blocked',channel='owner',moderator=True),settings))
        self.assertEqual(commands.parse('!count bad_recall'),('add','custom_bad_recall'))
        self.assertEqual(commands.parse('!stats cs'),('spotlight','cs'))
        self.assertIsNone(commands.parse('!count bad_recall 10'))
        self.assertIsNone(commands.parse('!stats arbitrary'))


if __name__=='__main__':unittest.main()
