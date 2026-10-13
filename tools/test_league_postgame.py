"""Personal timeline, archive survival, report gating and data-coverage regressions."""
import copy
import unittest
from tools import test_league_stats as fixtures
snapshot, match = fixtures.snapshot, fixtures.match
from league_stats import recap_events, postgame_report
from league_stats.normalize import postgame
from league_stats.timeline import extract


class PostgameTests(unittest.TestCase):
    setUp = fixtures.TrackerTests.setUp
    new_tracker = fixtures.TrackerTests.new_tracker
    ingest = fixtures.TrackerTests.ingest
    advance = fixtures.TrackerTests.advance

    def test_client_end_screen_verifies_match_and_player(self):
        from league_stats.client_enrichment import end_stats
        record=postgame(match(),'p')
        data=dict(gameId=7,localPlayer=dict(puuid='p',championId=77,teamId=100,
                  stats=dict(totalMinionsKilled=80,neutralMinionsKilled=20,spell1Casts=77,totalTimeSpentDead=92)))
        patch=end_stats(data,record)
        self.assertEqual(patch['metrics']['cs'],100)
        self.assertEqual(patch['metrics']['dead_seconds'],92)
        self.assertEqual(patch['raw_end_screen'],data)
        data['gameId']=8
        with self.assertRaises(ValueError):end_stats(data,record)
        data['gameId']=7;data['localPlayer']['puuid']='someone_else'
        with self.assertRaises(ValueError):end_stats(data,record)

    def test_client_timeline_is_distinguished_from_riot_and_filters_unrelated_combat(self):
        from league_stats.client_enrichment import local_timeline
        record=postgame(match(),'p')
        data=dict(frames=[dict(timestamp=5000,events=[dict(type='CHAMPION_KILL',timestamp=1000,killerId=1,victimId=3),
                 dict(type='CHAMPION_KILL',timestamp=2000,killerId=2,victimId=3)])])
        patch=local_timeline(data,record,7,{})
        self.assertEqual(len(patch['client_events']),1)
        self.assertEqual(patch['client_events'][0]['source'],'client')
        self.assertNotIn('official_events',patch)
        with self.assertRaises(ValueError):local_timeline(data,record,8,{})

    def test_visual_build_preserves_exact_purchase_order_and_skill_times(self):
        from league_stats.report_visuals import project
        record=postgame(match(modern=True),'p')
        events=[dict(type='ITEM_PURCHASED',timestamp=11234,participantId=1,itemId=1001),
                dict(type='SKILL_LEVEL_UP',timestamp=12567,participantId=1,skillSlot=2)]
        patch=extract(dict(metadata=dict(matchId='NA1_7'),info=dict(frames=[dict(timestamp=60000,events=events)])),record)
        visual=project({**record,**patch},[])
        self.assertEqual(visual['build'][0]['time'],11.234)
        self.assertEqual(visual['skills'][0]['skill_slot'],2)
        self.assertEqual(visual['skills'][0]['time'],12.567)
        self.assertTrue(visual['exact_build'])

    def test_personal_combat_only_and_both_teams_objectives(self):
        data = snapshot()
        data['events']['Events'] = [
            dict(EventName='ChampionKill', EventTime=90, KillerName='Tester#NA1', VictimName='Enemy#NA1'),
            dict(EventName='ChampionKill', EventTime=100, KillerName='Enemy#NA1', VictimName='Tester#NA1'),
            dict(EventName='ChampionKill', EventTime=110, KillerName='Ally#NA1', VictimName='Enemy#NA1', Assisters=['Tester#NA1']),
            dict(EventName='ChampionKill', EventTime=120, KillerName='Ally#NA1', VictimName='Enemy#NA1'),
            dict(EventName='DragonKill', EventTime=130, KillerName='Enemy#NA1'),
            dict(EventName='TurretKilled', EventTime=140, KillerName='Minion_T100', TurretKilled='Turret_T2_L_03_A'),
        ]
        rows = recap_events.live_events(data, data['allPlayers'][0])
        self.assertEqual([r['time'] for r in rows], [90, 100, 110, 130, 140])
        self.assertEqual([r['side'] for r in rows[-2:]], ['enemy', 'ally'])

    def test_events_survive_poll_gaps_enrichment_and_restart(self):
        data = snapshot()
        data['events']['Events'] = [dict(EventName='ChampionKill', EventTime=42, KillerName='Tester#NA1', VictimName='Enemy#NA1')]
        self.tracker.ingest(data, account='p', game_id=7)
        self.advance(11)
        self.ingest(611)
        self.assertEqual(len(self.tracker.current['personal_events']), 1)
        self.tracker.enrich(match(), 'p')
        tracker = self.new_tracker()
        self.assertEqual(tracker.records['p:7']['personal_events'][0]['time'], 42)
        self.assertEqual(len(tracker.records['p:7']['samples']), 2)
        self.assertNotIn('unspent_gold', tracker.records['p:7']['samples'][0])

    def test_stale_live_poll_never_rewinds_capture(self):
        self.ingest(610)
        self.ingest(600)
        self.assertEqual(self.tracker.current['duration'], 610)

    def test_stream_gates_age_phase_identity_and_unknown_result(self):
        self.ingest()
        self.tracker.disconnected()
        self.tracker.client_phase = 'EndOfGame'
        report = self.tracker.postgame_report()
        self.assertTrue(report['visible'])
        self.assertIsNone(report['match']['win'])
        self.assertIn('Partial', report['coverage'])
        for phase in ('InProgress', 'Reconnect', 'Matchmaking', 'ChampSelect', 'WatchInProgress', ''):
            self.tracker.client_phase = phase
            self.assertFalse(self.tracker.postgame_report()['visible'], phase)
        self.tracker.client_phase = 'Lobby'
        self.advance(901)
        self.assertFalse(self.tracker.postgame_report()['visible'])

    def test_no_older_match_displayed_during_new_match(self):
        self.ingest()
        self.tracker.disconnected()
        self.advance(30)
        self.ingest(10, game_id=8)
        self.tracker.client_phase = 'Lobby'
        self.assertFalse(self.tracker.postgame_report()['visible'])

    def test_official_timeline_uses_identity_and_replaces_live_events(self):
        record = postgame(match(modern=True), 'p')
        events = [dict(type='CHAMPION_KILL', timestamp=1000, killerId=1, victimId=3),
                  dict(type='CHAMPION_KILL', timestamp=2000, killerId=2, victimId=3),
                  dict(type='CHAMPION_KILL', timestamp=3000, killerId=2, victimId=3, assistingParticipantIds=[1]),
                  dict(type='BUILDING_KILL', timestamp=4000, killerId=0, teamId=200, buildingType='TOWER_BUILDING'),
                  dict(type='ITEM_PURCHASED', timestamp=5000, participantId=1, itemId=1001),
                  dict(type='WARD_PLACED', timestamp=6000, creatorId=2),
                  dict(type='WARD_PLACED', timestamp=7000, creatorId=1)]
        data = dict(metadata=dict(matchId='NA1_7'), info=dict(frames=[dict(timestamp=10000, events=events)]))
        patch = extract(data, record, {'1001':dict(name='Boots')})
        self.assertEqual([r['time'] for r in patch['official_events']], [1,3,4,5,7])
        self.assertEqual(patch['official_events'][2]['side'], 'ally')
        report = postgame_report.build([{**record, **patch, 'personal_events':[dict(time=9, kind='kill')]}])
        self.assertEqual(len(report['events']), 5)
        data['metadata']['matchId'] = 'NA1_8'
        with self.assertRaises(ValueError):
            extract(data, record)

    def test_missing_stats_not_zero_and_peers_exclude_future_games(self):
        record = postgame(match(), 'p')
        record['champion'] = 'Jinx'
        peers = [dict(copy.deepcopy(record), id=str(i), started_at=record['started_at']-i-1) for i in range(3)]
        report = postgame_report.build([*peers, record])
        self.assertNotIn('gold_earned', report['match']['metrics'])
        self.assertEqual(report['comparisons'][0]['games'], 3)
        self.assertEqual(report['lifetime']['games'], 4)

    def test_account_and_exclusion_filters_apply(self):
        self.tracker.enrich(match(), 'p')
        self.tracker.account = 'someone_else'
        self.assertIsNone(self.tracker.postgame_report()['match'])
        self.tracker.account = 'p'
        self.tracker.review_match(dict(id='p:7', excluded=True, revision=0))
        self.assertIsNone(self.tracker.postgame_report()['match'])

    def test_bounded_samples_and_observed_level_timing(self):
        self.ingest(600)
        self.tracker.current['samples'] = [dict(time=i) for i in range(1440)]
        data=snapshot(1450);data['allPlayers'][0]['level']=9
        self.tracker.ingest(data,account='p',game_id=7)
        self.assertEqual(len(self.tracker.current['samples']),1440)
        self.assertEqual(self.tracker.current['level_observations'][-1]['source'],'observed')

    def test_ambiguous_name_only_does_not_credit_personal_combat(self):
        data=snapshot(); data['allPlayers'].append(dict(riotId='Tester#EUW',riotIdGameName='Tester',team='CHAOS'))
        data['allPlayers'][0]['riotIdGameName']='Tester'
        data['events']['Events']=[dict(EventName='ChampionKill',EventTime=5,KillerName='Tester',VictimName='Enemy#NA1')]
        self.assertEqual(recap_events.live_events(data,data['allPlayers'][0]),[])

    def test_saved_official_timeline_can_be_projected_without_rewrite(self):
        raw = match(modern=True)
        record = postgame(raw, 'p')
        record.pop('participants');record.pop('team_id')
        timeline = dict(metadata=dict(matchId='NA1_7'),info=dict(frames=[dict(timestamp=5000,events=[
            dict(type='CHAMPION_KILL',timestamp=1000,killerId=1,victimId=3)])]))
        stored = dict(record,raw_postgame=raw,raw_timeline=timeline)
        restored=postgame_report.restore(record,stored,{}, {})
        self.assertEqual(restored['official_events'][0]['kind'],'kill')
        self.assertNotIn('official_events',record)
        self.assertNotIn('official_events',stored)

    def test_report_leaves_sample_detail_in_archive(self):
        self.ingest()
        self.tracker.disconnected()
        report=self.tracker.postgame_report()
        self.assertNotIn('kills',report['samples'][0])
        self.assertIn('kills',self.tracker.current['samples'][0])

    def test_legacy_live_events_use_saved_account_identity(self):
        raw=match();raw['participantIdentities'][0]['player'].update(gameName='Tester',tagLine='NA1')
        record=postgame(raw,'p')
        stored=dict(record,raw_postgame=raw,raw_events=[dict(EventName='ChampionKill',EventTime=42,KillerName='Tester#NA1',VictimName='Other')])
        restored=postgame_report.restore(record,stored,{}, {})
        self.assertEqual(restored['personal_events'][0]['kind'],'kill')
        self.assertNotIn('personal_events',stored)

    def test_disconnected_http_reader_is_not_answered_twice(self):
        from hub_ui.routes.league_stats import LeagueStatsRoutes
        from unittest.mock import Mock, patch
        route=LeagueStatsRoutes();route.path='/api/league-stats/postgame'
        route._json=Mock(side_effect=ConnectionAbortedError);route._err=Mock()
        with patch('league_stats.api.postgame',return_value={}):
            route._get_league_stats(route.path)
        route._err.assert_not_called()
