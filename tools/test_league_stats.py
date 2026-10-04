"""Archive, match reconciliation, role certainty and trusted-helper regressions."""
import copy
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import Mock, patch
from lib.paths import ensure_import_paths
ensure_import_paths()
from league_stats import analytics, commands, config, api
from league_stats.normalize import live, postgame, same_player
from league_stats.service import Tracker
from league_stats.store import Store
from league_stats.collector import Collector
from lib.twitch_chat import parse_message, ChatReader


def snapshot(t=600):
    return dict(activePlayer=dict(riotId='Tester#NA1',riotIdGameName='Tester',riotIdTagLine='NA1'),
                gameData=dict(gameTime=t),allPlayers=[
        dict(riotId='Tester#NA1',championName='Jinx',team='ORDER',position='BOTTOM',level=8,
             scores=dict(kills=4,deaths=2,assists=3,creepScore=80,wardScore=5),
             items=[dict(itemID=1001,displayName='Boots',slot=0)]),
        dict(riotId='Ally#NA1',championName='Lulu',team='ORDER',position='UTILITY',scores=dict(kills=1)),
        dict(riotId='Enemy#NA1',championName='Caitlyn',team='CHAOS',position='BOTTOM',scores=dict(kills=1)),
    ], events=dict(Events=[dict(EventID=1,EventName='FirstBlood',Recipient='Tester#NA1'),
        dict(EventID=2,EventName='DragonKill',KillerName='Ally#NA1',DragonType='Elder',Stolen='False'),
        dict(EventID=3,EventName='BaronKill',KillerName='Tester#NA1',Stolen='True')]))


def match(game_id=7,modern=False):
    own=dict(participantId=1,championId=222,teamId=100,timeline=dict(lane='BOTTOM',role='DUO_CARRY'),
             stats=dict(kills=6,deaths=3,assists=4,totalMinionsKilled=140,neutralMinionsKilled=10,
                        win=True,item0=1001,firstBloodKill=True,totalDamageDealtToChampions=21000))
    ally=dict(participantId=2,championId=117,teamId=100,timeline=dict(lane='BOTTOM',role='DUO_SUPPORT'),stats=dict(kills=4))
    enemy=dict(participantId=3,championId=51,teamId=200,timeline=dict(lane='BOTTOM',role='DUO_CARRY'),stats=dict(kills=8))
    game=dict(gameId=game_id,gameCreation=1700000000000,gameDuration=1200,queueId=420,mapId=11,
              participants=[own,ally,enemy],participantIdentities=[dict(participantId=1,player=dict(puuid='p'))],
              teams=[dict(teamId=100,dragonKills=3,baronKills=1)])
    if modern:
        players=[]
        for p in game['participants']:
            players.append({**p,**p['stats'], 'teamPosition':'UTILITY' if p is ally else 'BOTTOM'})
        players[0].update(puuid='p',nexusKills=1)
        game['participants']=players
        return dict(info=game)
    return game


class NormalizationTests(unittest.TestCase):
    def test_live_events_are_rebuilt_not_counted_twice_and_firstblood_recipient(self):
        data=snapshot()
        data['events']['Events'].append(copy.deepcopy(data['events']['Events'][-1]))
        r=live(data,'p',7,1700000600)
        self.assertEqual(r['metrics']['first_bloods'],1)
        self.assertEqual(r['metrics']['dragon_kills'],0)
        self.assertEqual(r['metrics']['team_dragons'],1)
        self.assertEqual(r['metrics']['team_elder_dragons'],1)
        self.assertEqual(r['metrics']['objectives_stolen'],1)
        self.assertNotIn('nexus_last_hits',r['metrics'])
        self.assertEqual(r['matchups']['enemy_adc'],'Caitlyn')
        self.assertEqual(r['matchups']['ally_support'],'Lulu')

    def test_same_name_different_tag_is_not_local_player(self):
        self.assertFalse(same_player(dict(riotId='Tester#EUW',gameName='Tester'),dict(gameName='Tester',tagLine='NA1')))
        self.assertTrue(same_player(dict(riotId='Tester#NA1'),dict(gameName='Tester',tagLine='NA1')))

    def test_local_and_modern_records_keep_unknown_nexus_absent(self):
        catalog={'222':dict(name='Jinx'),'117':dict(name='Lulu'),'51':dict(name='Caitlyn')}
        r=postgame(match(),'p',catalog)
        self.assertEqual(r['metrics']['cs'],150)
        self.assertEqual(r['metrics']['team_dragons'],3)
        self.assertNotIn('nexus_last_hits',r['metrics'])
        self.assertEqual(r['matchups']['ally_support'],'Lulu')
        self.assertEqual(r['matchups']['enemy_adc'],'Caitlyn')
        self.assertEqual(postgame(match(modern=True),'p')['metrics']['nexus_last_hits'],1)
        self.assertIsNone(postgame(match(),'some-other-account'))

    def test_ambiguous_roles_not_guessed(self):
        d=snapshot();d['allPlayers'].append(copy.deepcopy(d['allPlayers'][-1]))
        self.assertNotIn('enemy_adc',live(d,'p',7,1700000600)['matchups'])


class TrackerTests(unittest.TestCase):
    def setUp(self):
        self.folder=tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.path=Path(self.folder.name)
        self.now=1700000600
        self.tick=100
        self.store=Store(self.path/'stats.sqlite3')
        self.tracker=self.new_tracker()

    def new_tracker(self):
        return Tracker(self.store,self.path/'settings.json',clock=lambda:self.now,monotonic=lambda:self.tick)

    def ingest(self,t=600,game_id=7):
        self.tracker.ingest(snapshot(t),account='p',game_id=game_id,context=dict(queue=420))

    def advance(self,seconds):
        self.now+=seconds;self.tick+=seconds

    def test_shared_cooldown_survives_restart_and_undo_does_not_bypass_it(self):
        self.ingest();self.tracker.observe('add','missed_melee',actor='helper',message_id='a')
        with self.assertRaisesRegex(ValueError,'cooldown'):
            self.tracker.observe('add','missed_cannon',actor='other')
        self.tracker.observe('undo',actor='helper',moderator=False,message_id='undo')
        self.tracker=self.new_tracker();self.ingest()
        with self.assertRaises(ValueError):self.tracker.observe('add','missed_ranged')
        self.advance(16);self.ingest(616)
        self.tracker.observe('add','missed_cannon',actor='helper',message_id='b')
        self.assertEqual(self.tracker.current['metrics']['missed_minions'],1)
        with self.assertRaises(ValueError):self.tracker.observe('undo',message_id='undo')

    def test_simultaneous_reports_count_once(self):
        self.ingest();barrier=threading.Barrier(3);results=[]
        def report():
            barrier.wait()
            try:self.tracker.observe('add','missed_cannon');results.append(True)
            except ValueError:results.append(False)
        workers=[threading.Thread(target=report) for _ in range(2)]
        for worker in workers:worker.start()
        barrier.wait()
        for worker in workers:worker.join(1)
        self.assertEqual(sorted(results),[False,True])
        self.assertEqual(self.tracker.current['metrics']['missed_cannon'],1)

    def test_postgame_enrichment_is_idempotent_and_preserves_manual_checkpoints(self):
        self.ingest();self.tracker.observe('add','missed_cannon',message_id='1')
        self.tracker.enrich(match(),'p');self.tracker.enrich(match(),'p')
        self.ingest(1200)
        self.assertEqual(len(self.tracker.records),1)
        r=self.store.get('p:7')
        self.assertEqual(r['source'],'league_client')
        self.assertEqual(r['metrics']['kills'],6)
        self.assertEqual(r['metrics']['missed_cannon'],1)
        self.assertEqual(r['metrics']['cs_at_10'],80)
        self.assertEqual(r['checkpoints']['10']['cs'],80)
        self.tracker.enrich(match(modern=True),'p')
        self.tracker.enrich(match(),'p')
        self.assertEqual(self.store.get('p:7')['source'],'match_v5')
        self.assertEqual(self.store.get('p:7')['metrics']['nexus_last_hits'],1)

    def test_disconnect_reconnect_and_new_game_keep_totals_separate(self):
        self.ingest();self.tracker.observe('add','missed_cannon')
        self.tracker.disconnected()
        with self.assertRaises(ValueError):self.tracker.observe('add','missed_melee')
        self.advance(16);self.ingest(616)
        self.assertEqual(self.tracker.current['metrics']['missed_cannon'],1)
        self.ingest(5,game_id=8)
        self.assertEqual(self.tracker.current['metrics']['missed_cannon'],0)
        self.assertEqual(len(self.tracker.records),2)

    def test_helpers_require_authorization_and_cannot_undo_others(self):
        self.ingest()
        self.tracker.enqueue_chat(dict(user='random',channel='caster',moderator=False,text='!cannon'))
        self.tracker.drain_chat()
        self.assertEqual(self.tracker.current['metrics']['missed_cannon'],0)
        self.tracker.enqueue_chat(dict(user='mod',channel='caster',moderator=True,text='!cannon',id='1'))
        self.tracker.drain_chat()
        self.assertEqual(self.tracker.current['metrics']['missed_cannon'],1)
        with self.assertRaises(ValueError):self.tracker.observe('undo',actor='someone_else',moderator=False)

    def test_queued_chat_rejects_old_game_and_stale_intent(self):
        self.ingest()
        message=dict(user='mod',channel='caster',moderator=True,text='!cannon',id='1')
        self.tracker.enqueue_chat(message)
        self.ingest(5,game_id=8)
        self.tracker.drain_chat()
        self.assertEqual(self.tracker.current['metrics']['missed_cannon'],0)
        self.tracker.enqueue_chat(message)
        self.advance(6)
        self.ingest(11,game_id=8)
        self.tracker.drain_chat()
        self.assertEqual(self.tracker.current['metrics']['missed_cannon'],0)

    def test_unwatched_history_has_no_manual_or_milestone_coverage(self):
        self.tracker.enrich(match(),'p')
        r=self.tracker.records['p:7']
        self.assertNotIn('missed_cannon',r['metrics'])
        self.assertNotIn('cs_at_10',r['metrics'])

    def test_delayed_nexus_report_has_two_minute_window_and_stays_separate(self):
        self.ingest()
        self.tracker.enrich(match(),'p')
        self.advance(20)
        self.tracker.observe('add','nexus_last_hits_manual')
        self.assertEqual(self.tracker.current['metrics']['nexus_last_hits_manual'],1)
        self.assertNotIn('nexus_last_hits',self.tracker.current['metrics'])
        self.advance(121)
        with self.assertRaises(ValueError):self.tracker.observe('add','nexus_last_hits_manual')

    def test_archive_export_more_than_ui_page_and_filters(self):
        for i in range(60):self.tracker.enrich(match(game_id=i+1),'p')
        self.tracker.account='p'
        self.assertEqual(len(self.tracker.snapshot()['matches']),50)
        self.assertEqual(len(self.tracker.export()['matches']),60)
        self.assertEqual(self.tracker.snapshot(queue='400')['summary']['completed_games'],0)
        with self.assertRaises(ValueError):self.tracker.snapshot(period='nonsense')


class AnalyticsTests(unittest.TestCase):
    def test_weighted_cs_rate_differs_from_mean_game_rate_and_unknowns_are_excluded(self):
        records=[dict(state='complete',win=True,duration=600,metrics=dict(cs=100,kills=4,deaths=0,assists=2)),
                 dict(state='complete',win=False,duration=1800,metrics=dict(cs=150,kills=2,deaths=2,assists=0,nexus_last_hits=1)),
                 dict(state='partial',win=None,duration=120,metrics=dict(cs=5,kills=1,deaths=1,assists=0))]
        s=analytics.aggregate(records)
        self.assertEqual(s['cs_per_minute'],6.25)
        self.assertEqual(s['average_match_cs_per_minute'],7.5)
        self.assertEqual(s['metrics']['cs']['total'],255)
        self.assertEqual(s['metrics']['cs']['average'],125)
        self.assertEqual(s['metrics']['nexus_last_hits']['games'],1)
        self.assertEqual(s['win_rate'],50)
        self.assertEqual(s['kda'],4)


class ConfigurationAndChatTests(unittest.TestCase):
    def test_unknown_settings_survive_and_malformed_files_never_reset(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'settings.json';path.write_text('{"future_field": 42}')
            with patch('league_stats.config.SettingsBackups.snapshot'):
                self.assertEqual(config.save({'helpers':['A_Helper']},path)['future_field'],42)
                self.assertEqual(config.read(path)['helpers'],['a_helper'])
                path.write_text('broken personal data')
                with self.assertRaises(ValueError):config.save({'cooldown_seconds':15},path)
                self.assertEqual(path.read_text(),'broken personal data')

    def test_permissions_and_exact_command_syntax(self):
        self.assertTrue(commands.authorized(dict(user='owner',channel='owner'),config.DEFAULTS))
        self.assertFalse(commands.authorized(dict(user='guest',channel='owner',moderator='true'),config.DEFAULTS))
        self.assertEqual(commands.parse('!range'),('add','missed_ranged'))
        self.assertIsNone(commands.parse('!cannon 500'))
        self.assertIsNone(commands.parse('hello !cannon'))

    def test_chat_uses_login_not_display_name_and_rejects_shared_channel_moderator(self):
        line='@id=1;user-id=20;mod=1;display-name=owner;tmi-sent-ts=123 :helper!helper@helper.tmi.twitch.tv PRIVMSG #owner :!cannon'
        data=parse_message(line,'owner')
        self.assertEqual(data['user'],'helper');self.assertTrue(data['moderator'])
        self.assertIsNone(parse_message(line,'different'))
        self.assertIsNone(parse_message(line.replace('id=1;','id=1;source-room-id=10;room-id=11;'),'owner'))
        self.assertIsNone(parse_message(line.replace('@id=1;','@'),'owner'))

    def test_readonly_chat_cleanup_and_channel_join(self):
        stop=threading.Event();sock=Mock()
        def recv():
            stop.set();return '@room-id=1 :tmi.twitch.tv ROOMSTATE #owner\r\n'
        sock.recv.side_effect=recv
        reader=ChatReader(stop,lambda:'owner')
        with patch('lib.twitch_chat.websocket.create_connection',return_value=sock):reader.run()
        sent=''.join(c.args[0] for c in sock.send.call_args_list)
        self.assertIn('JOIN #owner',sent)
        self.assertNotIn('PRIVMSG',sent)
        sock.close.assert_called_once()
        self.assertFalse(reader.connected)

    def test_collector_does_not_record_spectated_or_closed_client_game(self):
        tracker=Mock();tracker.import_requested=False
        tracker.enrichment_requested=False;tracker.lock=threading.RLock()
        tracker.settings=copy.deepcopy(config.DEFAULTS)
        collector=Collector(tracker,threading.Event(),client=Mock(),fetch=Mock())
        collector.next_client=float('inf');collector.phase='Spectating';collector.step()
        collector.fetch.assert_not_called();tracker.disconnected.assert_called_once()
        collector.http.close()


if __name__=='__main__':unittest.main()
