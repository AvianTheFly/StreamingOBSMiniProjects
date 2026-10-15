"""Shared OBS playhead, stale intent and evidence-based personal story checks."""
import copy
import unittest
from unittest.mock import patch
from tools import test_league_postgame as fixtures
from tools.test_league_stats import match
from league_stats import recap_stories, postgame_report, recap_analysis
from league_stats.normalize import postgame
from league_stats.recap_show import RecapShow


class RecapShowTests(unittest.TestCase):
    setUp=fixtures.PostgameTests.setUp
    new_tracker=fixtures.PostgameTests.new_tracker
    advance=fixtures.PostgameTests.advance
    def test_queue_starts_at_overview_and_loops_until_cancelled(self):
        self.tracker.enrich(match(),'p');self.tracker.account='p'
        for phase in ['EndOfGame', 'Lobby']:
            self.tracker.client_phase=phase
            self.assertFalse(self.tracker.postgame_report()['visible'])
        self.advance(3600)
        self.tracker.client_phase='Matchmaking'
        report=self.tracker.postgame_report()
        self.assertTrue(report['visible']);self.assertEqual(report['show']['view'],'highlights')
        self.advance(96)
        report=self.tracker.postgame_report()
        self.assertTrue(report['visible']);self.assertEqual(report['show']['page'],1)
        for phase in ['ReadyCheck', 'ChampSelect']:
            self.tracker.client_phase=phase
            self.assertTrue(self.tracker.postgame_report()['visible'])
        self.tracker.client_phase='Lobby'
        self.assertFalse(self.tracker.postgame_report()['visible'])
        self.tracker.client_phase='Matchmaking'
        self.assertEqual(self.tracker.postgame_report()['show']['page'],0)

    def command(self, action, **fields):
        r=self.tracker.postgame_report()
        return self.tracker.control_postgame(dict(action=action,match_id=r['match']['id'],revision=r['show']['revision'],**fields))

    def test_shared_playhead_manual_selection_and_pause(self):
        self.tracker.enrich(match(),'p');self.tracker.account='p';self.tracker.client_phase='Matchmaking'
        first=self.tracker.postgame_report()
        self.assertEqual(first['show']['view'],'highlights')
        self.advance(13)
        self.assertEqual(self.tracker.postgame_report()['show']['view'],'tempo')
        r=self.command('view',view='build')
        self.assertTrue(r['show']['playing'])
        self.assertEqual(r['show']['hold_remaining'],30)
        self.advance(29)
        self.assertEqual(self.tracker.postgame_report()['show']['view'],'build')
        self.command('view',view='build');self.advance(29)
        self.assertEqual(self.tracker.postgame_report()['show']['view'],'build')
        self.advance(1)
        self.assertEqual(self.tracker.postgame_report()['show']['view'],'economy')
        self.command('view',view='build');self.command('pause');self.advance(100)
        self.assertEqual(self.tracker.postgame_report()['show']['view'],'build')
        self.assertEqual(self.command('next')['show']['page'],1)
        self.assertEqual(self.command('previous')['show']['page'],0)
        self.command('play');self.advance(13)
        self.assertEqual(self.tracker.postgame_report()['show']['view'],'economy')

    def test_hide_persists_and_manual_show_cannot_override_gameplay(self):
        self.tracker.enrich(match(),'p');self.tracker.account='p';self.tracker.client_phase='Matchmaking'
        with patch('league_stats.config.SettingsBackups'):
            self.command('hide')
        self.assertFalse(self.new_tracker().settings['postgame_auto'])
        self.assertFalse(self.tracker.postgame_report()['visible'])
        self.assertTrue(self.command('show')['visible'])
        self.tracker.client_phase='InProgress'
        self.assertFalse(self.tracker.postgame_report()['visible'])
        with self.assertRaises(ValueError):self.command('show')
        self.tracker.client_phase='Matchmaking';self.advance(1801)
        self.assertFalse(self.tracker.postgame_report()['visible'])

    def test_stale_controls_rejected_after_new_match_or_other_controller(self):
        self.tracker.enrich(match(),'p');self.tracker.account='p';self.tracker.client_phase='Matchmaking'
        r=self.tracker.postgame_report();old=dict(action='hide',match_id=r['match']['id'],revision=r['show']['revision'])
        self.command('pause')
        with self.assertRaises(ValueError):self.tracker.control_postgame(old)
        second=match(8);second['gameCreation']+=2000000;self.tracker.enrich(second,'p')
        with self.assertRaises(ValueError):self.tracker.control_postgame(old)
        self.assertTrue(self.tracker.settings['postgame_auto'])

    def test_stories_have_filtered_baseline_and_actual_burst(self):
        current=postgame(match(),'p');current['metrics'].update(skillshots_dodged=15,turret_plates=3,deaths=0)
        peers=[dict(copy.deepcopy(current),id=str(i),started_at=current['started_at']-i-1) for i in range(5)]
        for p in peers:p['metrics']['cs']=100
        foreign=dict(copy.deepcopy(peers[0]),id='foreign',champion='Other')
        current['official_events']=[dict(time=t,kind=k) for t,k in [(10,'kill'),(35,'assist'),(50,'objective'),(72,'kill')]]
        report=postgame_report.build([*peers,foreign,current])
        result=recap_stories.project(report,[*peers,foreign,current])
        self.assertEqual(result['standout']['change'],50)
        self.assertEqual(result['standout']['games'],5)
        self.assertEqual(result['burst']['kills']+result['burst']['assists'],2)
        self.assertEqual([b['value'] for b in result['badges']],[0,15,3])
        self.assertEqual(result['lane'],[])

    def test_unknown_roles_and_partial_games_do_not_get_personal_rank_claims(self):
        current=postgame(match(),'p')
        peers=[dict(copy.deepcopy(current),id=str(i),started_at=current['started_at']-i-1) for i in range(4)]
        current['role']=None
        for p in peers:p['role']=None
        report=postgame_report.build([*peers,current])
        self.assertIsNone(recap_stories.project(report,[*peers,current])['standout'])
        current['state']='partial';current['metrics']['deaths']=0
        report=postgame_report.build([current])
        result=recap_stories.project(report,[current])
        self.assertFalse(any(b['kind']=='deathless' for b in result['badges']))

    def test_analysis_checks_identity_and_uses_elapsed_time(self):
        record=dict(id='p:7',game_id=7,participant_id=1,account='p',opponent_id=2,
                    raw_timeline=dict(metadata=dict(matchId='NA1_7'),info=dict(participants=[dict(participantId=1,puuid='p')],frames=[])))
        for stamp,cs,wallet in [(120.1,10,150),(181.4,20,600),(251.2,40,200),(321.9,55,900)]:
            record['raw_timeline']['info']['frames'].append(dict(timestamp=stamp*1000,participantFrames={'1':dict(totalGold=1000+cs,currentGold=wallet,minionsKilled=cs,jungleMinionsKilled=0),'2':dict(totalGold=1000)}))
        report=dict(match=dict(id='p:7'),events=[dict(kind='vision',label='Ward placed',time=33)])
        result=recap_analysis.project(report,record)
        self.assertEqual(result['points'][-1]['time'],321.9)
        self.assertEqual(result['peak_wallet']['wallet'],900)
        self.assertAlmostEqual(result['farm_window']['rate'],45*60/201.8)
        self.assertEqual(result['points'][-1]['lead'],55)
        record['raw_timeline']['info']['participants'][0]['puuid']='other'
        self.assertEqual(recap_analysis.project(report,record)['points'],[])
        self.assertEqual(recap_analysis.project(report,{})['peak_wallet'],None)
