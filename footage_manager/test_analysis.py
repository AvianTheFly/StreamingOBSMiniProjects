"""Boundary, ranking, evidence, and source-retention regressions."""
import importlib.util
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from footage_manager.temporal import detect_games
from footage_manager.scoring import rank, spike_signal
from footage_manager.audio_analysis import summarize, select_track, analyze_audio
from footage_manager.analysis_store import AnalysisStore
from footage_manager.store import Store
from footage_manager.analysis import candidates, analyze_video, upgraded_samples, reuse_identical, AnalysisBatch
from footage_manager.analysis_migrations import prior_visual_work
from footage_manager.visual_analysis import parse_hud, replay_text, FrameReader
from footage_manager.analysis_cache import cache_path, save, read, content_hash
from footage_manager.analysis_sampling import desktop_transition_times, game_refinement_times
from footage_manager.visual_outcomes import result_word, result_outcome, include_top_client_heading
from footage_manager.visual_playback import player_visible
from footage_manager.temporal_playback import excluded_seconds
from footage_manager.media import Cancelled
from footage_manager.analysis_api import voice_marks, between_marks, game_marks


def playing(t,clock,kda=(0,0,0),**kwargs):
    return {'time':t,'active':True,'clock':clock,'kda':list(kda),**kwargs}


class ChronologyTests(unittest.TestCase):
    def test_reference_background_gives_a_rough_end_without_overriding_live_hud(self):
        samples=[playing(0,0),playing(900,900,between_games=True),
                 {'time':1020,'between_games':True},
                 {'time':1050,'between_games':True},playing(1110,10)]
        games,_=detect_games(samples,1300,step=30)
        self.assertEqual([(0,1020),(1100,1300)],[(g['start'],g['end']) for g in games])
        self.assertEqual('Likely between games: reference background',games[0]['end_reason'])
        self.assertEqual(1080,games[0]['trim_end'])

    def test_live_end_separates_browser_review_of_the_same_match(self):
        samples=[playing(0,0),playing(1000,1000),{'time':1010,'continue':True},
                 {'time':1020,'outcome':'victory'},playing(1030,1005,player=True),
                 playing(1040,1015),{'time':1050,'desktop':True}]
        games,replays=detect_games(samples,1100)
        self.assertEqual([(0,1010,'victory')],[(g['start'],g['end'],g['outcome']) for g in games])
        self.assertEqual(0,games[0]['replay_seconds'])
        self.assertEqual(1025,replays[0]['start'])
        self.assertEqual(20,excluded_seconds(0,100,[{'start':10,'end':30},{'start':15,'end':25}]))

    def test_browser_clips_with_hidden_controls_do_not_create_live_games(self):
        samples=[playing(359,0),playing(1800,1441),{'time':1883,'continue':True},
                 {'time':1892,'outcome':'defeat'},{'time':2247,'desktop':True},
                 playing(2249,38,player=True),playing(2255,44),playing(2280,46),
                 playing(2301,67,(2,0,0)),playing(2303,69,(2,0,0)),
                 {'time':2311,'clock':77,'no_hud':True,'desktop':True},
                 {'time':2330,'clock':80,'no_hud':True,'desktop':True},
                 {'time':2341,'clock':81,'no_hud':True},{'time':2343,'desktop':True},
                 playing(2345,2322,player=True),playing(2350,2327,player=True),
                 playing(2360,2328),playing(2420,2328),playing(2440,2348),
                 playing(2441,1,desktop=True),playing(2442,2),
                 {'time':3546,'outcome':'defeat'}]
        games,replays=detect_games(samples,3617)
        self.assertEqual([(359,1883),(2440,3546)],[(g['start'],g['end']) for g in games])
        self.assertEqual(['defeat','defeat'],[g['outcome'] for g in games])
        self.assertEqual([[],[]],[g['moments'] for g in games])
        self.assertEqual([{'start':2248,'end':2440.5,'kind':'browser_playback'}],replays)

    def test_retrospective_clock_after_a_closed_game_cannot_overlap_it(self):
        samples=[playing(0,0),{'time':1000,'continue':True},
                 playing(1100,1000),playing(1110,1010),playing(1200,0),
                 playing(1210,10),{'time':2200,'continue':True}]
        games,_=detect_games(samples,2300)
        self.assertEqual([(0,1000),(1200,2200)],[(g['start'],g['end']) for g in games])

    def test_unreadable_death_ticks_wait_for_nearby_independent_clock(self):
        samples=[playing(100,0),playing(1100,1000),
                 {'time':1100.25,'no_hud':True},{'time':1100.5,'no_hud':True},
                 {'time':1100.75,'no_hud':True,'clock':1001},
                 {'time':1101,'no_hud':True,'clock':1001}]
        games,_=detect_games(samples,1200)
        self.assertEqual(1200,games[0]['end'])
        self.assertTrue(games[0]['partial_end'])

    def test_independent_clock_reopens_soft_end_after_long_kda_occlusion(self):
        samples=[playing(100,0),playing(1100,1000),
                 {'time':1110,'no_hud':True},{'time':1120,'no_hud':True},
                 {'time':1130,'no_hud':True,'clock':1030},
                 {'time':1140,'no_hud':True,'clock':1040},
                 {'time':1150,'no_hud':True},{'time':1160,'no_hud':True},
                 {'time':1170,'no_hud':True,'clock':1070},
                 {'time':1200,'continue':True},{'time':1210,'outcome':'defeat'}]
        games,_=detect_games(samples,1300)
        self.assertEqual([(100,1200,'defeat')],[(g['start'],g['end'],g['outcome']) for g in games])
        bins=[{'time':t,'db':-20,'speech':1} for t in range(1105,1170,10)]
        bins.append({'time':1170,'db':-7,'speech':1})
        _,spikes=summarize(bins,games[0]['start'],games[0]['end'])
        self.assertEqual([1170],[m['time'] for m in spikes])
        frozen=[playing(100,0),playing(1100,1000),
                {'time':1110,'no_hud':True,'clock':1010},
                {'time':1120,'no_hud':True,'clock':1020},
                {'time':1130,'no_hud':True,'clock':1020},
                {'time':1140,'no_hud':True,'clock':1020}]
        games,_=detect_games(frozen,1300)
        self.assertEqual(1120,games[0]['end'])
        self.assertFalse(games[0]['partial_end'])

    def test_clock_cannot_reopen_confirmed_result_or_continue(self):
        for end in ('result','continue'):
            with self.subTest(end=end):
                samples=[playing(100,0),playing(1100,1000),
                         {'time':1110,'no_hud':True},{'time':1120,'no_hud':True}]
                samples.append({'time':1125,**({'outcome':'defeat'} if end=='result' else {'continue':True})})
                # Continue with no currently open game still supplies hard end
                # evidence; the next bare clock must not revoke that boundary.
                samples.extend([{'time':1130,'no_hud':True,'clock':1030},playing(1140,1040)])
                games,_=detect_games(samples,1300)
                self.assertEqual([(100,1110,'defeat' if end=='result' else 'unknown')],
                                 [(g['start'],g['end'],g['outcome']) for g in games])

    def test_early_moment_ranges_are_clamped_to_confirmed_game_end(self):
        games,_=detect_games([playing(100,0),playing(160,60,(2,0,0)),
                             playing(162,62,(2,0,0)),{'time':170,'continue':True}],300)
        self.assertEqual((140,170),(games[0]['moments'][0]['start'],games[0]['moments'][0]['end']))
        reopened,_=detect_games([playing(100,0),playing(160,60,(2,0,0)),
                                playing(162,62,(2,0,0)),{'time':164,'no_hud':True},
                                {'time':166,'no_hud':True},playing(200,100,(2,0,0)),
                                {'time':1200,'continue':True}],1300)
        self.assertEqual(1,len(reopened))
        self.assertEqual((140,175),(reopened[0]['moments'][0]['start'],reopened[0]['moments'][0]['end']))

    def test_single_or_interrupted_loading_flash_preserves_live_game_and_voice(self):
        samples=[playing(100,0),playing(1100,1000),{'time':1110,'loading':True},
                 {'time':1115,'desktop':True},{'time':1120,'loading':True},
                 playing(1130,1030),playing(1200,1100),{'time':1300,'continue':True}]
        games,_=detect_games(samples,1400)
        self.assertEqual([(100,1300)],[(g['start'],g['end']) for g in games])
        self.assertFalse(games[0]['partial_end'])
        bins=[{'time':t,'db':-20,'speech':1} for t in range(1100,1190,10)]
        bins.append({'time':1200,'db':-7,'speech':1})
        _,spikes=summarize(bins,games[0]['start'],games[0]['end'])
        self.assertEqual([1200],[m['time'] for m in spikes])

    def test_loading_confirmation_requires_distinct_frames_and_retains_next_start(self):
        samples=[playing(100,0),playing(1100,1000),{'time':1110,'loading':True},
                 {'time':1110.25,'loading':True}]
        games,_=detect_games(samples,1400)
        self.assertEqual(1400,games[0]['end'])
        self.assertTrue(games[0]['partial_end'])
        games,_=detect_games(samples+[{'time':1120,'loading':True},playing(1200,0),
                                     {'time':2200,'continue':True}],2300)
        self.assertEqual([(100,1100),(1200,2200)],[(g['start'],g['end']) for g in games])
        self.assertTrue(games[0]['partial_end'])
        self.assertEqual('Loading + gameplay',games[1]['start_reason'])

    def test_nexus_flash_and_continue_supply_confirmed_end(self):
        for continued in ({'time':1114,'continue':True},
                          {'time':1114,'continue':True,'loading':True}):
            with self.subTest(continued=continued):
                samples=[playing(100,0),playing(1100,1000),{'time':1110,'loading':True},
                         {'time':1112,'no_hud':True},continued,{'time':1120,'outcome':'victory'}]
                games,_=detect_games(samples,1200)
                self.assertEqual([(100,1114,'victory')],
                                 [(g['start'],g['end'],g['outcome']) for g in games])
                self.assertEqual('Continue / Nexus end screen',games[0]['end_reason'])
                self.assertFalse(games[0]['partial_end'])

    def test_conflicting_results_stay_unknown_when_a_result_repeats(self):
        samples=[playing(0,0),{'time':1000,'continue':True},
                 {'time':1010,'outcome':'defeat'},{'time':1020,'outcome':'victory'},
                 {'time':1030,'outcome':'victory'},{'time':1040,'outcome':'defeat'},
                 playing(1200,0),playing(1210,10),{'time':2200,'continue':True},
                 {'time':2240,'outcome':'victory'}]
        games,_=detect_games(samples,2300)
        self.assertEqual(['unknown','victory'],[g['outcome'] for g in games])
        self.assertTrue(games[0]['outcome_conflict'])
        self.assertFalse(games[1].get('outcome_conflict',False))
        self.assertEqual([0,1],[g['metrics']['victory'] for g in games])

    def test_desktop_transition_probes_are_bounded_and_do_not_imply_an_end(self):
        game={'start':100,'end':1500}
        samples=[playing(1000,900),{'time':1010,'desktop':True}]
        probes=desktop_transition_times(samples,[game],10)
        self.assertEqual(set(range(1001,1010)),probes)
        self.assertEqual(set(),desktop_transition_times(samples,[game],10,fine=True))
        samples += [playing(1001,901),{'time':1002,'desktop':True}]
        fine=desktop_transition_times(samples,[game],10,fine=True)
        self.assertEqual({1001.25,1001.5,1001.75},fine)
        games,_=detect_games(samples+[playing(1200,1100),{'time':1400,'continue':True}],1500)
        self.assertEqual((100,1400),(games[0]['start'],games[0]['end']))
        self.assertEqual(set(),desktop_transition_times([playing(1000,900),{'time':1040,'desktop':True}],[game],10))
        self.assertEqual(set(),desktop_transition_times([playing(1000,900),{'time':1005,'replay':True},
                                                       {'time':1010,'desktop':True}],[game],10))

    def test_late_boundary_still_refines_last_live_hud_before_lobby(self):
        samples=[playing(0,25),playing(1750,1775),playing(2170,400,replay=True),
                 playing(2160,390),playing(2228,0)]
        excluded=[{'start':2150,'end':2180,'kind':'browser_playback'}]
        times=game_refinement_times(samples,[{'start':0,'end':2180}],excluded,3600,10)
        # The actual Nexus/Defeat frames lie far before the late portrait estimate.
        self.assertTrue({1752,1754,1756,1758,2180}<=times)
        self.assertNotIn(2000,times)
        self.assertNotIn(2230,times)
        self.assertTrue(all(0<=t<3600 for t in times))

    def test_long_inactive_gap_does_not_expand_dense_refinement_work(self):
        samples=[playing(100,0),playing(1100,1000)]
        times=game_refinement_times(samples,[{'start':100,'end':18000}],[],18000,10)
        self.assertIn(1102,times)
        self.assertIn(17998,times)
        self.assertNotIn(2000,times)
        self.assertNotIn(10000,times)
        self.assertLess(len(times),300)

    def test_alt_tab_and_mid_game_no_hud_do_not_end_game(self):
        samples=[{'time':100,'loading':True},playing(130,0),playing(430,300),
                 {'time':440}, {'time':450}, {'time':500,'no_hud':True}, {'time':510,'no_hud':True},
                 playing(1100,970), {'time':1120,'continue':True}, {'time':1150,'outcome':'victory'}]
        games,_=detect_games(samples,1400)
        self.assertEqual(1,len(games))
        self.assertEqual((130,1120),(games[0]['start'],games[0]['end']))
        self.assertEqual((70,1180),(games[0]['trim_start'],games[0]['trim_end']))
        self.assertEqual('victory',games[0]['outcome'])

    def test_replay_is_excluded_from_boundaries_and_kda(self):
        samples=[playing(100,0),playing(350,250,(2,0,0),replay=True),
                 {'time':360,'continue':True,'replay':True},playing(370,270),
                 playing(400,300,(0,0,2)),playing(410,310,(2,0,2)),{'time':1300,'continue':True}]
        games,replays=detect_games(samples,1400)
        self.assertEqual(1,len(games))
        self.assertEqual(1,len(replays))
        self.assertEqual([400],[m['time'] for m in games[0]['moments']])

    def test_start_without_loading_and_incomplete_recording(self):
        games,_=detect_games([playing(20,620),playing(40,640)],100)
        self.assertEqual(0,games[0]['start'])
        self.assertTrue(games[0]['partial_start'])
        self.assertTrue(games[0]['partial_end'])
        self.assertEqual(100,games[0]['trim_end'])

    def test_replay_banner_animation_gap_does_not_create_game_or_kda(self):
        samples=[playing(0,0),{'time':1000,'continue':True},
                 {'time':1100,'replay':True},playing(1110,190,(2,0,0)),
                 playing(1120,200,replay=True),{'time':1130},
                 playing(1200,0),{'time':2200,'continue':True}]
        games,replays=detect_games(samples,2300)
        self.assertEqual(2,len(games))
        self.assertEqual(1,len(replays))
        self.assertEqual([],games[1]['moments'])
        self.assertTrue(replay_text('INSTANT REPL AY'))
        self.assertTrue(replay_text('INSTANT.REPLAY'))

    def test_early_remake_allowed_but_middle_animation_ignored(self):
        games,_=detect_games([playing(0,0),{'time':100,'no_hud':True},{'time':110,'no_hud':True}],200)
        self.assertEqual(100,games[0]['end'])
        games,_=detect_games([playing(0,0),playing(200,200),{'time':210,'no_hud':True},{'time':220,'no_hud':True},playing(900,900)],1000)
        self.assertTrue(games[0]['partial_end'])

    def test_late_soft_boundary_revoked_when_game_clock_continues(self):
        games,_=detect_games([playing(100,0),playing(1050,950),{'time':1060,'no_hud':True},
                             {'time':1070,'no_hud':True},playing(1200,1100),{'time':1300,'continue':True}],1400)
        self.assertEqual(1,len(games))
        self.assertEqual(1300,games[0]['end'])

    def test_desktop_with_obs_portrait_does_not_close_game(self):
        samples=[playing(0,800),playing(1000,1800),{'time':1100,'no_hud':True,'desktop':True},
                 {'time':1110,'no_hud':True,'desktop':True}]
        games,_=detect_games(samples,1200)
        self.assertEqual(1200,games[0]['end'])
        self.assertTrue(games[0]['partial_end'])
        games,_=detect_games(samples+[{'time':1120,'desktop':True,'outcome':'victory'}],1200)
        self.assertEqual('victory',games[0]['outcome'])
        self.assertEqual(1120,games[0]['end'])

    def test_death_overlay_with_advancing_clock_does_not_confirm_game_end(self):
        samples=[playing(100,0),playing(1100,1000),
                 {'time':1110,'no_hud':True,'clock':1010},
                 {'time':1120,'no_hud':True,'clock':1020}]
        games,_=detect_games(samples,1400)
        self.assertEqual(1400,games[0]['end'])
        self.assertTrue(games[0]['partial_end'])
        # Strong end evidence overrides a retained clock; a frozen clock does
        # not keep a game alive merely because the field is still visible.
        games,_=detect_games(samples+[{'time':1130,'continue':True,'clock':1030}],1400)
        self.assertEqual(1130,games[0]['end'])
        games,_=detect_games([playing(100,0),playing(1100,1000),
                            {'time':1110,'no_hud':True,'clock':1000},
                            {'time':1120,'no_hud':True,'clock':1000}],1400)
        self.assertEqual(1110,games[0]['end'])

    def test_subsecond_death_overlay_clock_readings_remain_in_same_game(self):
        samples=[playing(100,0),playing(1100,1000),
                 {'time':1100.25,'no_hud':True,'clock':1000},
                 {'time':1100.5,'no_hud':True,'clock':1000}]
        games,_=detect_games(samples+[{'time':1100.75,'desktop':True,'no_hud':True}],1200)
        self.assertEqual(1200,games[0]['end'])
        self.assertTrue(games[0]['partial_end'])
        games,_=detect_games(samples+[{'time':1101.5,'no_hud':True,'clock':1000}],1200)
        self.assertEqual(1100.5,games[0]['end'])
        self.assertFalse(games[0]['partial_end'])

    def test_reset_needs_two_readings_and_results_do_not_leak_next_game(self):
        samples=[playing(0,0),playing(1000,1000),playing(1010,15),playing(1020,1020),
                 {'time':1100,'continue':True},{'time':1130,'outcome':'defeat'},playing(1200,0),
                 playing(1210,10),{'time':2200,'continue':True},{'time':2240,'outcome':'victory'}]
        games,_=detect_games(samples,2300)
        self.assertEqual(['defeat','victory'],[g['outcome'] for g in games])

    def test_inflated_clock_minute_does_not_split_same_game(self):
        # A first-blood overlay made 01:28 read as 4:28 in the actual archive.
        # Two subsequent correct readings must not confirm a new game whose
        # inferred origin is identical to the existing game.
        samples=[playing(135,4),playing(215,84),playing(219,268,(1,0,0)),
                 playing(220,89,(1,0,0)),playing(221,90,(1,0,0)),
                 playing(223,92,(2,0,0)),playing(227,96,(2,0,0)),
                 {'time':2038,'continue':True},{'time':2042,'outcome':'victory'}]
        games,_=detect_games(samples,2182)
        self.assertEqual(1,len(games))
        self.assertEqual((131,2038),(games[0]['start'],games[0]['end']))
        self.assertEqual('victory',games[0]['outcome'])
        self.assertEqual([223],[m['time'] for m in games[0]['moments']])
        # A recording that starts mid-game has a clamped origin of zero too.
        games,_=detect_games([playing(0,800),playing(200,1000),playing(210,1300),
                             playing(220,1020),playing(230,1030)],300)
        self.assertEqual(1,len(games))
        self.assertTrue(games[0]['partial_start'])

    def test_real_reset_with_later_origin_still_separates_games(self):
        samples=[playing(0,0),playing(1000,1000),playing(1100,5),
                 playing(1110,15,(2,0,0)),playing(1120,25,(2,0,0)),
                 {'time':2200,'continue':True}]
        games,_=detect_games(samples,2300)
        self.assertEqual([(0,1000),(1095,2200)],[(g['start'],g['end']) for g in games])
        self.assertTrue(games[0]['partial_end'])
        self.assertEqual([1110],[m['time'] for m in games[1]['moments']])

    def test_kda_exact_thresholds(self):
        samples=[playing(0,0),playing(60,60,(1,1,1)),playing(300,300,(2,1,1)),playing(301,301,(3,1,1)),{'time':1000,'continue':True}]
        games,_=detect_games(samples,1100)
        self.assertEqual([300],[m['time'] for m in games[0]['moments']])
        self.assertEqual(([2,2,1],317),parse_hud('2/2/1 05:17'))

    def test_single_frame_kda_ocr_error_is_not_a_highlight(self):
        samples=[playing(0,0),playing(18,18,(20,0,0)),playing(20,20),
                 playing(200,200,(2,0,0)),playing(202,202,(2,0,0)),{'time':1000,'continue':True}]
        games,_=detect_games(samples,1100)
        self.assertEqual([200],[m['time'] for m in games[0]['moments']])


class OutcomeEvidenceTests(unittest.TestCase):
    @staticmethod
    def label(word,height=16,offset=0):
        return ([[0,offset],[200,offset],[200,offset+height*1.5],[0,offset+height*1.5]],word,.99)

    def test_browser_screenshots_and_match_history_do_not_supply_current_results(self):
        rows=[self.label('VICTORY',offset=i*40) for i in range(4)]
        text='VICTORY Ranked Solo/Duo 17/4/10 VICTORY VICTORY VICTORY'
        for desktop in (True,False):
            with self.subTest(desktop=desktop):
                self.assertIsNone(result_outcome(rows,text,desktop=desktop,top_text='reddit.com/r/udyrmains Create post'))
                self.assertIsNone(result_outcome(rows,text,desktop=desktop))
        self.assertIsNone(result_outcome([self.label('VICTORY',70)],'VICTORY',
                                        top_text='reddit.com/r/udyrmains',continued=True))

    def test_current_client_result_on_desktop_is_still_recognized(self):
        rows=[self.label('DEFEAT')]
        client=rows+[self.label('Ranked Solo/Duo',12,30)]
        self.assertEqual('defeat',result_outcome(client,'DEFEAT Ranked Solo/Duo',desktop=True))
        self.assertIsNone(result_outcome(rows,'DEFEAT playlist title',desktop=True))
        client=[self.label('DEFEAT',32),self.label('Ranked Solo/Duo',12,54),self.label('VICTORY',12,140)]
        self.assertEqual('defeat',result_outcome(client,'DEFEAT Ranked Solo/Duo VICTORY',desktop=True))

    def test_client_panel_survives_cropped_queue_label_and_browser_behind_it(self):
        def row(text,left,top,right,bottom):
            return ([[left,top],[right,top],[right,bottom],[left,bottom]],text,.99)
        rows=[row('DEFEAT',0,138,83,166),
              row('VIEWADVANCEDDETAILS',682,150,874,175),
              row('CONTINUE',376,749,455,771)]
        for browser in ('','twitch.tv/udyrisabotlaner'):
            for button in ('CONTINUE','PLAY AGAIN'):
                with self.subTest(browser=browser,button=button):
                    panel=rows[:2]+[(rows[2][0],button,.99)]
                    self.assertEqual('defeat',result_outcome(panel,'DEFEAT '+button,
                                                          desktop=True,top_text=browser))
        # A browser game banner cannot borrow header/button controls from a
        # separate client window or an unrelated persistent overlay.
        misplaced=[row('DEFEAT',400,340,700,420),*rows[1:]]
        self.assertIsNone(result_outcome(misplaced,'DEFEAT',desktop=True,top_text='twitch.tv'))
        self.assertIsNone(result_outcome(rows[:2],'DEFEAT',desktop=True))
        outside=[*rows[:2],row('CONTINUE',1100,749,1180,771)]
        self.assertIsNone(result_outcome(outside,'DEFEAT',desktop=True))
        history=[*rows,row('DEFEAT',0,250,83,278)]
        self.assertIsNone(result_outcome(history,'DEFEAT DEFEAT',desktop=True,top_text='reddit.com'))

    def test_persistent_rank_overlay_does_not_validate_another_app_result_word(self):
        rows=[self.label('VICTORY',70),self.label('Ranked Queue Solo',12,600)]
        self.assertIsNone(result_outcome(rows,'VICTORY Ranked Queue Solo',desktop=True))

    def test_masked_result_title_requires_its_client_panel(self):
        def row(text,left,top,right,bottom):
            return ([[left,top],[right,top],[right,bottom],[left,bottom]],text,.99)
        for title,expected in (('ICTORY','victory'),('1CTORY','victory'),('EFEAT','defeat')):
            with self.subTest(title=title):
                heading=row(title,410,39,512,70)
                client=[heading,row('VIEW ADVANCED DETAILS',1050,56,1242,83),
                        row('PLAY AGAIN',730,580,860,610)]
                self.assertEqual(expected,result_outcome(client,title,desktop=True))
                self.assertEqual(expected,result_outcome(client,title))
                self.assertIsNone(result_outcome([heading],title))
                self.assertIsNone(result_outcome([heading],title,desktop=True,top_text='reddit.com'))
                self.assertIsNone(result_word(title))
        ambiguous=[row('ICTORY EFEAT',410,39,512,70),
                   row('VIEW ADVANCED DETAILS',1050,56,1242,83),
                   row('PLAY AGAIN',730,580,860,610)]
        self.assertIsNone(result_outcome(ambiguous,'ICTORY EFEAT'))

    def test_large_game_banner_takes_precedence_over_unrelated_small_text(self):
        rows=[self.label('DEFEAT',55),self.label('VICTORY',12,100)]
        self.assertEqual('defeat',result_outcome(rows,'DEFEAT chat: VICTORY'))
        self.assertEqual('defeat',result_outcome(rows,'DEFEAT chat: VICTORY',desktop=True,continued=True))

    def test_top_crop_heading_joins_only_its_aligned_client_panel(self):
        def row(text,left,top,right,bottom):
            return ([[left,top],[right,top],[right,bottom],[left,bottom]],text,.99)
        controls=[row('VIEW ADVANCED DETAILS',700,150,960,175),
                  row('CONTINUE',308,870,410,905)]
        for title,expected in (('ICTORY','victory'),('VICTORY','victory'),('EFEAT','defeat')):
            top=[row(title,0,116,90,137)]
            joined=include_top_client_heading(controls,top,top_left=230,details_left=294)
            self.assertEqual(3,len(joined))
            self.assertAlmostEqual(-96,joined[-1][0][0][0])
            self.assertAlmostEqual(139.2,joined[-1][0][0][1])
            self.assertEqual(expected,result_outcome(joined,title,desktop=True,top_text='twitch.tv'))
        misplaced=[row('ICTORY',0,300,90,321)]
        self.assertEqual(controls,include_top_client_heading(controls,misplaced,top_left=230,details_left=294))
        outside=[controls[0],row('CONTINUE',1100,870,1200,905)]
        self.assertEqual(outside,include_top_client_heading(outside,top,top_left=230,details_left=294))
        # Existing headings/history cannot gain duplicates from overlapping OCR.
        history=[row('VICTORY DEFEAT',0,140,200,170),*controls]
        self.assertIs(history,include_top_client_heading(history,top,top_left=230,details_left=294))
        self.assertIsNone(result_outcome(history,'VICTORY DEFEAT',desktop=True,top_text='reddit.com'))

    def test_result_words_require_a_distinct_result_keyword(self):
        self.assertIsNone(result_word('VictoryAnnouncer'))
        self.assertIsNone(result_word('VICTORY DEFEAT'))
        self.assertEqual('victory',result_word('VICTORY! Ranked Solo/Duo'))


class SpeechRankingTests(unittest.TestCase):
    @unittest.skipUnless(importlib.util.find_spec('faster_whisper'),'Speech dependencies not installed')
    def test_sparse_speech_skips_lobby_chunks_and_can_fill_later_game_coverage(self):
        import numpy as np
        def game(start,end):
            return {'start':start,'end':end,'metrics':{},'moments':[]}
        with tempfile.TemporaryDirectory() as temporary:
            video={'id':1,'size':1,'mtime_ns':1,'path':'unused-fixture.mp4','name':'fixture',
                   'duration':1200,'streams':json.dumps([{'type':'audio'}])}
            calls=[]
            def decode(command,*args):
                start=int(command[command.index('-ss')+1]);calls.append(start)
                audio=np.full(300*16000,.01,dtype=np.float32)
                audio[22*16000:23*16000]=.1
                audio.tofile(command[-1])
            with patch('footage_manager.audio_analysis.run',side_effect=decode), \
                 patch('faster_whisper.vad.get_speech_timestamps',side_effect=lambda audio,opts:[{'start':0,'end':len(audio)}]):
                first=game(310,590)
                analyze_audio(video,[first],[],temporary,{})
                self.assertEqual([300],calls)
                self.assertEqual(280,first['metrics']['speaking_seconds'])
                self.assertEqual([322],[m['time'] for m in first['moments']])
                checkpoint=cache_path(temporary,video,'silero-speech-v1',{'track':0})
                self.assertEqual([300],read(checkpoint)['completed_chunks'])
                self.assertEqual(0,read(checkpoint)['completed_seconds'])
                # Later discovery of an earlier game fills its skipped chunk.
                second=game(310,590)
                spanning=game(0,600)
                analyze_audio(video,[game(50,100),second,spanning],[],temporary,{})
                self.assertEqual([300,0],calls)
                self.assertEqual(first['metrics'],second['metrics'])
                self.assertEqual(first['moments'],second['moments'])
                self.assertEqual([22,322],[m['time'] for m in spanning['moments']])
                self.assertEqual(600,read(checkpoint)['completed_seconds'])
                analyze_audio(video,[game(950,1000)],[],temporary,{})
                self.assertEqual([300,0,900],calls)
                self.assertEqual(600,read(checkpoint)['completed_seconds'])
                analyze_audio(video,[game(700,800)],[],temporary,{})
                self.assertEqual([300,0,900,600],calls)
                cache=read(checkpoint)
                self.assertEqual([0,300,600,900],cache['completed_chunks'])
                self.assertEqual(1200,cache['completed_seconds'])
                self.assertEqual(1200,len({b['time'] for b in cache['bins']}))

    @unittest.skipUnless(importlib.util.find_spec('faster_whisper'),'Speech dependencies not installed')
    def test_sparse_speech_reuses_legacy_contiguous_checkpoint(self):
        with tempfile.TemporaryDirectory() as temporary:
            video={'id':1,'size':1,'mtime_ns':1,'path':'unused-fixture.mp4','name':'fixture',
                   'duration':1200,'streams':json.dumps([{'type':'audio'}])}
            checkpoint=cache_path(temporary,video,'silero-speech-v1',{'track':0})
            save(checkpoint,{'completed_seconds':600,
                 'bins':[{'time':i,'speech':.8,'db':-30} for i in range(600)]})
            game={'start':350,'end':450,'metrics':{},'moments':[]}
            with patch('footage_manager.audio_analysis.run',side_effect=AssertionError('Decoded cached audio')):
                analyze_audio(video,[game],[],temporary,{})
            self.assertEqual(80,game['metrics']['speaking_seconds'])

    def test_normalization_survives_microphone_gain_and_ignores_replays(self):
        bins=[{'time':i,'speech':.8,'db':-30+(12 if i in (20,21) else 0)} for i in range(60)]
        one,spikes=summarize(bins,0,60)
        two,other=summarize([{**b,'db':b['db']+15} for b in bins],0,60)
        self.assertEqual(one['spike_count'],two['spike_count'])
        self.assertEqual(one['strongest_spike_db'],two['strongest_spike_db'])
        self.assertEqual(one['voice_spikes'],two['voice_spikes'])
        self.assertEqual([20],[s['time'] for s in spikes])
        excluded,_=summarize(bins,0,60,[{'start':19,'end':22}])
        self.assertEqual(0,excluded['spike_count'])

    def test_silence_is_not_speech_and_microphone_selection_is_explicit(self):
        metrics,spikes=summarize([{'time':i,'speech':0,'db':-10} for i in range(50)],0,50)
        self.assertEqual(0,metrics['speaking_seconds']); self.assertEqual([],spikes)
        video={'streams':json.dumps([{'type':'audio','tags':{'title':'Game'}},{'type':'audio','tags':{'title':'Mic'}}])}
        self.assertEqual((1,'Microphone track'),select_track(video))
        self.assertIn('Mixed',select_track(video,0)[1])

    def test_any_metric_combination_including_none(self):
        games=[{'start':0,'metrics':{'victory':1,'speaking':.1}}, {'start':100,'metrics':{'victory':0,'speaking':.9}}]
        self.assertEqual(0,rank(games,{'victory':1})[0]['start'])
        self.assertEqual(100,rank(games,{'speaking':1})[0]['start'])
        self.assertEqual([0,0],[g['score'] for g in rank(games,{})])
        with self.assertRaises(ValueError):rank(games,{'victory':float('nan')})

    def test_voice_ranking_distinguishes_burst_frequency_and_relative_strength(self):
        def game(index, heights, seconds=1200, replay_seconds=0):
            return {'video_id':index,'start':0,'end':seconds,'replay_seconds':replay_seconds,
                    'metrics':{'spike_count':len(heights),'voice_spikes':1},
                    'moments':[{'kind':'voice_spike','above_baseline_db':height} for height in heights]}
        # All three legacy results had a saturated score of 1. Retained moment
        # evidence must let the better contender rank higher without reanalysis.
        games=[game(1,[6,6]),game(2,[6]*8),game(3,[12]*8)]
        ranked=rank(games,{'voice_spikes':1})
        self.assertEqual([3,2,1],[g['video_id'] for g in ranked])
        self.assertGreater(ranked[0]['score'],ranked[1]['score'])
        self.assertGreater(ranked[1]['score'],ranked[2]['score'])
        self.assertLess(ranked[0]['score'],100)
        self.assertEqual(1,games[0]['metrics']['voice_spikes'])
        self.assertEqual(0,spike_signal([],1200))
        self.assertAlmostEqual(.5,spike_signal([{'above_baseline_db':6}]*10,600))
        # Repeated footage contributes neither bursts nor chronology duration.
        ordinary=rank([game(4,[6]*8)],{'voice_spikes':1})[0]['score']
        repeated=rank([game(4,[6]*8,seconds=1500,replay_seconds=300)],{'voice_spikes':1})[0]['score']
        self.assertEqual(ordinary,repeated)


class DecoderBoundaryTests(unittest.TestCase):
    def test_short_audio_tail_uses_last_visual_frame_but_middle_failures_are_reported(self):
        class Capture:
            fail=False
            closed=False
            def isOpened(self):return True
            def set(self,key,value):self.position=value/1000
            def read(self):return (not self.fail and self.position<=28.9),SimpleNamespace(shape=(720,1280,3))
            def release(self):self.closed=True
        capture=Capture()
        cv=SimpleNamespace(VideoCapture=lambda *args:capture,CAP_FFMPEG=1,CAP_PROP_N_THREADS=2,CAP_PROP_POS_MSEC=3)
        with patch.dict('sys.modules',{'cv2':cv}):
            reader=FrameReader('source.mp4',30)
            reader.frame(29.8)
            self.assertAlmostEqual(28.8,reader.actual_time)
            self.assertEqual(1,len(reader.warnings))
            capture.fail=True
            with self.assertRaisesRegex(ValueError,'15.0s'):reader.frame(15)
            self.assertEqual(15,capture.position)
            reader.close()
        self.assertTrue(capture.closed)


class PersistenceTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='footage-analysis-test-')
        self.store=Store(Path(self.temp.name))
        self.id=self.store.execute('INSERT INTO videos(path,name,size,mtime_ns,duration) VALUES (?,?,?,?,?)',('source.mp4','source.mp4',50,30,1200))
        self.repo=AnalysisStore(self.store)
        self.game=detect_games([playing(100,0),{'time':1100,'continue':True}],1200)[0][0]

    def tearDown(self):
        self.store.db.close();self.temp.cleanup()

    def test_atomic_analysis_does_not_replace_review_markers_and_stale_source_blocked(self):
        marker=self.store.save_range({'video_id':self.id,'start':5,'end':15,'title':'Personal note'})
        self.repo.save(self.store.video(self.id),{}, {'games':[self.game],'replays':[]})
        kept=self.repo.keep_game(self.id,0)
        self.assertEqual(marker,self.store.ranges(self.id)[0]['id'])
        notes=json.loads(next(r for r in self.store.ranges(self.id) if r['id']==kept)['notes'])
        self.assertEqual('source.mp4',notes['source_path'])
        self.store.execute('UPDATE videos SET size=99 WHERE id=?',(self.id,))
        self.assertTrue(self.repo.load(self.store.video(self.id))['stale'])
        with self.assertRaisesRegex(ValueError,'current source'):self.repo.keep_game(self.id,0)

    def test_recordings_under_ten_minutes_excluded_renamed_files_included(self):
        self.store.execute('UPDATE videos SET duration=600,name=? WHERE id=?',('renamed footage.mp4',self.id))
        self.assertEqual(1,len(candidates(self.store)))
        self.store.execute('UPDATE videos SET duration=599 WHERE id=?',(self.id,))
        self.assertEqual([],candidates(self.store))

    def test_quick_pass_reuses_completed_finer_work_but_honors_audio_and_force(self):
        video=self.store.video(self.id)
        options={'sample_seconds':10,'audio':True,'audio_track':'auto'}
        self.repo.save(video,options,{'games':[self.game],'replays':[],'sample_seconds':10})
        with patch('footage_manager.analysis.analyze_video',return_value={'video_id':self.id}) as analyze, \
             patch('footage_manager.analysis.reuse_identical',return_value=None), \
             patch('footage_manager.analysis.VisualDetector'):
            result=AnalysisBatch(self.store,{**options,'sample_seconds':30})({})
            self.assertEqual([],result['analyses'])
            analyze.assert_not_called()
            AnalysisBatch(self.store,{**options,'sample_seconds':30,'audio_track':'1'})({})
            self.assertEqual(1,analyze.call_count)
            AnalysisBatch(self.store,{**options,'sample_seconds':30,'force':True})({})
            self.assertEqual(2,analyze.call_count)
        self.assertEqual(options,self.repo.load(video)['options'])

    def test_quick_pass_retains_source_scoped_interrupted_visual_observations(self):
        video=self.store.video(self.id)
        old=[playing(0,0),playing(60,60),{'time':90,'desktop':True,'playback_context':1,
                                        'personal_unknown_field':{'keep':True}}]
        checkpoint=cache_path(self.store.directory,video,'visual-v10',{'sample_seconds':10.0})
        save(checkpoint,{'observations':old})
        samples,refresh=prior_visual_work(self.store,video,30)
        self.assertEqual({s['time']:s for s in old},samples)
        self.assertEqual(set(),refresh)
        self.assertEqual({},prior_visual_work(self.store,{**video,'size':51},30)[0])
        self.assertEqual(old,read(checkpoint)['observations'])

    def test_quick_pass_reduces_decoding_and_keeps_kda_voice_and_context(self):
        source=Path(self.temp.name)/'quick-source.mp4';source.write_bytes(b'fixture')
        st=source.stat()
        self.store.execute('UPDATE videos SET path=?,size=?,mtime_ns=? WHERE id=?',
                           (str(source),st.st_size,st.st_mtime_ns,self.id))
        readers=[]
        class Reader:
            closed=False
            def __init__(self,*args):readers.append(self)
            def frame(self,second):return second
            def close(self):self.closed=True
        class Detector:
            def __init__(self):self.calls=[]
            def observe(self,frame,second):
                self.calls.append(second)
                if second>=1000:return {'time':second,'continue':True,'outcome':'victory'}
                if second==450:return {'time':second,'desktop':True}
                return playing(second,second,(2,0,0) if second>=210 else (0,0,0))
        def audio(video,games,*args):
            games[0]['moments'].append({'kind':'voice_spike','time':500,'start':492,'end':501,
                                       'above_baseline_db':9,'label':'Voice intensity spike'})
            return {'label':'Fixture speech'}
        detector=Detector();video=self.store.video(self.id)
        with patch('footage_manager.analysis.FrameReader',Reader), \
             patch('footage_manager.analysis.analyze_audio',side_effect=audio) as speech, \
             patch('footage_manager.analysis.desktop_transition_times',side_effect=AssertionError('Detailed probes in quick mode')):
            analyze_video(self.store,video,{}, {'sample_seconds':30,'audio':True},detector)
        result=self.repo.load(video);game=result['games'][0]
        self.assertEqual((0,1000,'victory'),(game['start'],game['end'],game['outcome']))
        self.assertEqual((0,1060),(game['trim_start'],game['trim_end']))
        self.assertEqual([210],[m['time'] for m in game['moments'] if m['kind']=='early_kda'])
        self.assertEqual([500],[m['time'] for m in game['moments'] if m['kind']=='voice_spike'])
        self.assertLess(len(detector.calls),120)
        self.assertTrue(all(t%10==0 for t in detector.calls))
        self.assertTrue(readers[0].closed)
        speech.assert_called_once()

    def test_voice_markers_are_read_only_and_clip_context_stays_inside_the_game(self):
        personal=self.store.save_range({'video_id':self.id,'start':5,'end':15,'title':'My existing note'})
        self.game['moments']=[{'kind':'voice_spike','time':1098,'start':1090,'end':1099,'above_baseline_db':15},
                              {'kind':'early_kda','time':300,'start':280,'end':315},
                              {'kind':'voice_spike','time':105,'start':100,'end':108,'above_baseline_db':9}]
        self.repo.save(self.store.video(self.id),{}, {'games':[self.game],'replays':[],
            'audio':{'label':'Mixed audio — speech estimate includes other voices'}})
        cues=voice_marks(self.store,self.id)
        self.assertEqual('current',cues['state'])
        self.assertEqual([105,1098],[m['time'] for m in cues['markers']])
        self.assertEqual([(100,123),(1088,1100)],[(m['start'],m['end']) for m in cues['markers']])
        self.assertEqual([personal],[r['id'] for r in self.store.ranges(self.id)])
        self.assertEqual('My existing note',self.store.ranges(self.id)[0]['title'])
        # Source identity changes suppress obsolete timestamp suggestions.
        self.store.execute('UPDATE videos SET size=99 WHERE id=?',(self.id,))
        self.assertEqual('source_changed',voice_marks(self.store,self.id)['state'])
        self.assertEqual([],voice_marks(self.store,self.id)['markers'])

    def test_voice_marker_pending_and_detector_upgrade_states_are_explicit(self):
        self.assertEqual('pending',voice_marks(self.store,self.id)['state'])
        self.game['moments']=[{'kind':'voice_spike','time':300,'end':304,'above_baseline_db':12}]
        self.repo.save(self.store.video(self.id),{}, {'games':[self.game],'replays':[]})
        self.store.execute('UPDATE analyses SET version=? WHERE video_id=?',('earlier-detector',self.id))
        cues=voice_marks(self.store,self.id)
        self.assertEqual('outdated',cues['state'])
        self.assertEqual([300],[m['time'] for m in cues['markers']])

    def test_game_timeline_is_source_scoped_and_never_changes_personal_ranges(self):
        self.assertEqual('pending',game_marks(self.store,self.id)['state'])
        personal=self.store.save_range({'video_id':self.id,'start':5,'end':15,'title':'Personal'})
        self.repo.save(self.store.video(self.id),{}, {'games':[self.game],'replays':[]})
        result=game_marks(self.store,self.id)
        self.assertEqual('current',result['state'])
        self.assertEqual([{'index':0,'start':self.game['start'],'end':self.game['end'],
                          'outcome':self.game.get('outcome','unknown')}],result['games'])
        self.assertEqual([personal],[r['id'] for r in self.store.ranges(self.id)])
        self.store.execute('UPDATE videos SET size=99 WHERE id=?',(self.id,))
        self.assertEqual('source_changed',game_marks(self.store,self.id)['state'])
        self.assertEqual([],game_marks(self.store,self.id)['games'])

    def test_between_game_navigation_groups_matches_and_preserves_personal_ranges(self):
        self.repo.save(self.store.video(self.id),{}, {'games':[self.game],'replays':[],
            'sample_seconds':30,'observations':[{'time':0},
              {'time':30,'between_games':True},{'time':60,'between_games':True},
              {'time':90},{'time':120,'between_games':True},{'time':150}]})
        cues=between_marks(self.store,self.id)
        self.assertEqual('current',cues['state'])
        self.assertEqual([(15,75),(105,135)],[(m['start'],m['end']) for m in cues['markers']])
        self.assertEqual([],self.store.ranges(self.id))
        self.store.execute('UPDATE videos SET size=99 WHERE id=?',(self.id,))
        self.assertEqual('source_changed',between_marks(self.store,self.id)['state'])
        self.assertEqual([],between_marks(self.store,self.id)['markers'])

    def test_resume_checkpoint_is_source_and_track_scoped(self):
        video=self.store.video(self.id)
        first=cache_path(self.store.directory,video,'speech',{'track':0})
        second=cache_path(self.store.directory,video,'speech',{'track':1})
        changed=cache_path(self.store.directory,{**video,'size':51},'speech',{'track':0})
        self.assertNotEqual(first,second);self.assertNotEqual(first,changed)
        save(first,{'bins':[{'time':10,'speech':.8,'db':-30}],'completed_seconds':300})
        self.assertEqual(300,read(first)['completed_seconds'])
        self.assertEqual({},read(changed))

    def test_detector_upgrade_refreshes_replay_transitions_retaining_hud_work(self):
        samples=[playing(100,0),playing(1000,900),playing(1100,415),
                 {'time':1110,'evidence':'INSTANT REPL AY'},playing(1120,197),playing(1300,0)]
        upgraded=upgraded_samples(samples,10)
        self.assertEqual({100,1000,1300},set(upgraded))

    def duplicate_sources(self):
        primary=Path(self.temp.name)/'source-a.mp4';primary.write_bytes(b'same clip bytes')
        st=primary.stat()
        self.store.execute('UPDATE videos SET path=?,size=?,mtime_ns=? WHERE id=?',(str(primary),st.st_size,st.st_mtime_ns,self.id))
        copy=Path(self.temp.name)/'source-b.mp4';copy.write_bytes(primary.read_bytes());st=copy.stat()
        copy_id=self.store.execute('INSERT INTO videos(path,name,size,mtime_ns,duration) VALUES (?,?,?,?,?)',
                                  (str(copy),copy.name,st.st_size,st.st_mtime_ns,1200))
        return self.store.video(self.id),self.store.video(copy_id)

    def test_verified_duplicate_reuses_analysis_but_keeps_its_own_source_metadata(self):
        primary,copy=self.duplicate_sources();options={'audio':False}
        marker=self.store.save_range({'video_id':self.id,'start':5,'end':15,'title':'Original personal note'})
        self.repo.save(primary,options,{'games':[self.game],'replays':[],'unknown_field':{'preserved':True}})
        result=reuse_identical(self.store,copy,{},options)
        self.assertTrue(result['reused_analysis'])
        analysis=self.repo.load(copy)
        self.assertEqual(primary['id'],analysis['verified_duplicate']['video_id'])
        self.assertEqual(hashlib.sha256(b'same clip bytes').hexdigest(),analysis['verified_duplicate']['sha256'])
        self.assertEqual({'preserved':True},analysis['unknown_field'])
        self.assertEqual([],self.store.ranges(copy['id']))
        kept=self.repo.keep_game(copy['id'],0)
        notes=json.loads(next(r for r in self.store.ranges(copy['id']) if r['id']==kept)['notes'])
        self.assertEqual((copy['id'],copy['path']),(notes['source_id'],notes['source_path']))
        self.assertEqual(marker,self.store.ranges(primary['id'])[0]['id'])

    def test_matching_size_and_duration_or_different_options_are_not_identity(self):
        primary,copy=self.duplicate_sources();options={'audio':False}
        self.repo.save(primary,options,{'games':[self.game],'replays':[]})
        self.assertIsNone(reuse_identical(self.store,copy,{}, {'audio':True}))
        Path(copy['path']).write_bytes(b'other clip data');st=Path(copy['path']).stat()
        self.store.execute('UPDATE videos SET size=?,mtime_ns=? WHERE id=?',(st.st_size,st.st_mtime_ns,copy['id']))
        copy=self.store.video(copy['id'])
        self.assertEqual(primary['size'],copy['size'])
        self.assertIsNone(reuse_identical(self.store,copy,{},options))
        self.assertIsNone(self.repo.load(copy))

    def test_cancelled_fingerprint_is_not_saved_and_cached_hash_revalidates_source(self):
        primary,_=self.duplicate_sources()
        checkpoint=cache_path(self.store.directory,primary,'content-sha256-v1',{})
        with patch('footage_manager.analysis_cache.check_cancelled',side_effect=[None,Cancelled('test')]):
            with self.assertRaises(Cancelled):content_hash(self.store.directory,primary,{})
        self.assertFalse(checkpoint.exists())
        content_hash(self.store.directory,primary,{})
        Path(primary['path']).write_bytes(b'changed bytes')
        with self.assertRaises(ValueError):content_hash(self.store.directory,primary,{})

    def test_keep_game_is_idempotent_and_rerun_preserves_review(self):
        self.repo.save(self.store.video(self.id),{}, {'games':[self.game],'replays':[]})
        first=self.repo.keep_game(self.id,0)
        self.assertEqual(first,self.repo.keep_game(self.id,0))
        self.store.save_range({**self.store.ranges(self.id)[0],'title':'My game title'})
        self.repo.save(self.store.video(self.id),{}, {'games':[self.game],'replays':[]})
        self.assertEqual('My game title',self.store.ranges(self.id)[0]['title'])

    def test_cancelled_visual_pass_resumes_and_publishes_only_complete_generation(self):
        source=Path(self.temp.name)/'source.mp4';source.write_bytes(b'fixture')
        st=source.stat()
        self.store.execute('UPDATE videos SET path=?,size=?,mtime_ns=? WHERE id=?',(str(source),st.st_size,st.st_mtime_ns,self.id))
        video=self.store.video(self.id)
        class Reader:
            closed=False
            def __init__(self,*args):pass
            def frame(self,second):return second
            def close(self):self.closed=True
        class Detector:
            calls=0
            cancel=True
            def observe(self,frame,second):
                self.calls+=1
                if self.cancel and self.calls==16:raise Cancelled('test cancellation')
                if second==90:return {'time':second,'loading':True}
                if 100<=second<1100:return playing(second,second-100,(2,0,0) if second>=300 else (0,0,0))
                if 1100<=second<1120:return {'time':second,'continue':True}
                if second>=1120:return {'time':second,'outcome':'victory'}
                return {'time':second}
        detector=Detector();options={'sample_seconds':30,'audio':False}
        with patch('footage_manager.analysis.FrameReader',Reader):
            with self.assertRaises(Cancelled):analyze_video(self.store,video,{},options,detector)
            self.assertIsNone(self.repo.load(video))
            checkpoint=cache_path(self.store.directory,video,'visual-v10',{'sample_seconds':30.0})
            self.assertEqual(15,len(read(checkpoint)['observations']))
            detector.cancel=False
            result=analyze_video(self.store,video,{},options,detector)
        self.assertEqual(1,result['games'])
        game=self.repo.load(video)['games'][0]
        self.assertEqual((100,1100,'victory'),(game['start'],game['end'],game['outcome']))

    def test_sparse_nexus_end_is_recovered_before_a_late_lobby_portrait(self):
        source=Path(self.temp.name)/'source.mp4';source.write_bytes(b'fixture')
        st=source.stat()
        self.store.execute('UPDATE videos SET path=?,size=?,mtime_ns=?,duration=? WHERE id=?',
                           (str(source),st.st_size,st.st_mtime_ns,3600,self.id))
        readers=[]
        class Reader:
            closed=False
            def __init__(self,*args):readers.append(self)
            def frame(self,second):return second
            def close(self):self.closed=True
        class Detector:
            def __init__(self):self.calls=[]
            def observe(self,frame,second):
                self.calls.append(second)
                if second<1752:return playing(second,second+25)
                if second<1760:
                    return ({'time':second,'continue':True,'outcome':'defeat'} if second>=1756
                            else {'time':second,'no_hud':True})
                if 2180<=second<2228:return {'time':second,'no_hud':True}
                if second>=2228:return playing(second,second-2228)
                return {'time':second}
        detector=Detector();video=self.store.video(self.id)
        with patch('footage_manager.analysis.FrameReader',Reader):
            analyze_video(self.store,video,{}, {'sample_seconds':10,'audio':False},detector)
        games=self.repo.load(video)['games']
        self.assertEqual([(0,1752,'defeat'),(2228,3600,'unknown')],
                         [(g['start'],g['end'],g['outcome']) for g in games])
        self.assertEqual(1812,games[0]['trim_end'])
        self.assertIn(1758,detector.calls)
        self.assertNotIn(2002,detector.calls)
        self.assertTrue(readers[0].closed)

    def test_playback_context_upgrade_resumes_without_repeating_ocr(self):
        source=Path(self.temp.name)/'source.mp4';source.write_bytes(b'fixture')
        st=source.stat()
        self.store.execute('UPDATE videos SET path=?,size=?,mtime_ns=? WHERE id=?',
                           (str(source),st.st_size,st.st_mtime_ns,self.id))
        video=self.store.video(self.id)
        old=[playing(0,800),playing(1000,1800),playing(1100.25,20,(2,0,0)),
             playing(1150.25,70,(2,0,0),personal_unknown_field={'keep':True})]
        legacy=cache_path(self.store.directory,video,'visual-v9',{'sample_seconds':10.0})
        save(legacy,{'observations':old})
        class Reader:
            def __init__(self,*args):pass
            def frame(self,second):return second
            def close(self):pass
        class Detector:
            cancel=True
            def __init__(self):self.context_calls=[];self.ocr_calls=[]
            def context(self,second):
                self.context_calls.append(second)
                if self.cancel and second==1150.25:raise Cancelled('context-only cancellation')
                return {'player':second==1100.25,'desktop':False,'playback_context':1}
            def observe(self,frame,second):
                self.ocr_calls.append(second)
                context=self.context(second)
                value=playing(second,int(second+800)) if second<1020 else {'time':second,'continue':True}
                return {**value,**context}
        detector=Detector();options={'sample_seconds':10,'audio':False}
        with patch('footage_manager.analysis.FrameReader',Reader):
            with self.assertRaises(Cancelled):analyze_video(self.store,video,{},options,detector)
            self.assertIsNone(self.repo.load(video))
            checkpoint=read(cache_path(self.store.directory,video,'visual-v10',{'sample_seconds':10.0}))
            self.assertEqual(1,next(s for s in checkpoint['observations'] if s['time']==1100.25)['playback_context'])
            detector.cancel=False
            analyze_video(self.store,video,{},options,detector)
        for second in (0,1000,1100.25,1150.25):self.assertNotIn(second,detector.ocr_calls)
        self.assertEqual(1,detector.context_calls.count(1100.25))
        self.assertEqual(2,detector.context_calls.count(1150.25))
        result=self.repo.load(video)
        self.assertEqual(1,len(result['games']))
        self.assertEqual([],result['games'][0]['moments'])
        self.assertEqual('browser_playback',result['replays'][0]['kind'])
        self.assertEqual({'keep':True},next(s for s in result['observations'] if s['time']==1150.25)['personal_unknown_field'])
        self.assertEqual(old,read(legacy)['observations'])

    def test_outcome_context_upgrade_resumes_refresh_and_keeps_hud_checkpoint(self):
        source=Path(self.temp.name)/'source.mp4';source.write_bytes(b'fixture')
        st=source.stat()
        self.store.execute('UPDATE videos SET path=?,size=?,mtime_ns=? WHERE id=?',(str(source),st.st_size,st.st_mtime_ns,self.id))
        video=self.store.video(self.id)
        legacy=cache_path(self.store.directory,video,'visual-v5',{'sample_seconds':10.0})
        old=[playing(0,800),playing(1000,1800),{'time':1020,'outcome':None,'evidence':'DEFEAT VIEWADVANCEDDETAILS'},
             {'time':1100.25,'desktop':True,'outcome':'victory'}]
        save(legacy,{'observations':old})
        class Reader:
            def __init__(self,*args):pass
            def frame(self,second):return second
            def close(self):pass
        class Detector:
            cancel=True
            def __init__(self):self.calls=[]
            def observe(self,frame,second):
                self.calls.append(second)
                if self.cancel and second==1100.25:raise Cancelled('context refresh cancellation')
                if second<1020:return playing(second,int(second+800))
                if second<1050:return {'time':second,'outcome':'defeat'}
                return {'time':second,'desktop':True}
        detector=Detector();options={'sample_seconds':10,'audio':False}
        with patch('footage_manager.analysis.FrameReader',Reader):
            with self.assertRaises(Cancelled):analyze_video(self.store,video,{},options,detector)
            self.assertIsNone(self.repo.load(video))
            detector.cancel=False
            analyze_video(self.store,video,{},options,detector)
        self.assertNotIn(0,detector.calls);self.assertNotIn(1000,detector.calls)
        self.assertEqual(1,detector.calls.count(1020))
        self.assertEqual(2,detector.calls.count(1100.25))
        self.assertEqual(old,read(legacy)['observations'])
        result=self.repo.load(video)
        self.assertEqual('defeat',result['games'][0]['outcome'])
        self.assertEqual(None,next(s for s in result['observations'] if s['time']==1100.25).get('outcome'))

    def test_legacy_result_refresh_survives_an_already_populated_new_checkpoint(self):
        source=Path(self.temp.name)/'source.mp4';source.write_bytes(b'fixture')
        st=source.stat()
        self.store.execute('UPDATE videos SET path=?,size=?,mtime_ns=? WHERE id=?',(str(source),st.st_size,st.st_mtime_ns,self.id))
        video=self.store.video(self.id);options={'sample_seconds':10,'audio':False}
        old=[playing(0,800),playing(1000,1800),{'time':1020,'outcome':'defeat'},
             {'time':1100.25,'desktop':True,'outcome':'victory'}]
        save(cache_path(self.store.directory,video,'visual-v3',{'sample_seconds':10.0}),{'observations':old})
        # The result refresh was interrupted after the genuine defeat. The
        # remaining fractional browser-image timestamp is outside regular grids.
        save(cache_path(self.store.directory,video,'visual-v10',{'sample_seconds':10.0}),{'observations':old[:3]})
        class Reader:
            def __init__(self,*args):pass
            def frame(self,second):return second
            def close(self):pass
        class Detector:
            def __init__(self):self.calls=[]
            def observe(self,frame,second):
                self.calls.append(second)
                if second<1020:return playing(second,int(second+800))
                if second<1050:return {'time':second,'outcome':'defeat'}
                return {'time':second,'desktop':True}
        detector=Detector()
        with patch('footage_manager.analysis.FrameReader',Reader):
            analyze_video(self.store,video,{},options,detector)
        self.assertIn(1100.25,detector.calls)
        self.assertNotIn(1020,detector.calls)
        result=self.repo.load(video)
        self.assertEqual('defeat',result['games'][0]['outcome'])
        self.assertIsNone(next(s for s in result['observations'] if s['time']==1100.25).get('outcome'))

    def test_masked_result_refresh_preserves_hud_and_recovers_victory(self):
        source=Path(self.temp.name)/'source.mp4';source.write_bytes(b'fixture')
        st=source.stat()
        self.store.execute('UPDATE videos SET path=?,size=?,mtime_ns=? WHERE id=?',(str(source),st.st_size,st.st_mtime_ns,self.id))
        video=self.store.video(self.id)
        legacy=cache_path(self.store.directory,video,'visual-v6',{'sample_seconds':10.0})
        old=[playing(0,800),playing(1000,1800),
             {'time':1020.25,'outcome':None,'evidence':'ICTORY VIEW ADVANCED DETAILS PLAY AGAIN'},
             {'time':1020.75,'outcome':None,'evidence':''}]
        save(legacy,{'observations':old})
        class Reader:
            def __init__(self,*args):pass
            def frame(self,second):return second
            def close(self):pass
        class Detector:
            def __init__(self):self.calls=[]
            def observe(self,frame,second):
                self.calls.append(second)
                return playing(second,int(second+800)) if second<1020 else {'time':second,'outcome':'victory'}
        detector=Detector()
        with patch('footage_manager.analysis.FrameReader',Reader):
            analyze_video(self.store,video,{}, {'sample_seconds':10,'audio':False},detector)
        self.assertNotIn(0,detector.calls);self.assertNotIn(1000,detector.calls)
        self.assertIn(1020.25,detector.calls)
        self.assertIn(1020.75,detector.calls)
        self.assertEqual('victory',self.repo.load(video)['games'][0]['outcome'])
        self.assertEqual(old,read(legacy)['observations'])

    def test_masked_defeat_refresh_resumes_without_redecoding_compatible_inactive_frames(self):
        source=Path(self.temp.name)/'source.mp4';source.write_bytes(b'fixture')
        st=source.stat()
        self.store.execute('UPDATE videos SET path=?,size=?,mtime_ns=? WHERE id=?',(str(source),st.st_size,st.st_mtime_ns,self.id))
        video=self.store.video(self.id)
        legacy=cache_path(self.store.directory,video,'visual-v7',{'sample_seconds':10.0})
        old=[playing(0,800),playing(1000,1800),
             {'time':1020.25,'outcome':None,'evidence':'EFEAT VIEW ADVANCED DETAILS CONTINUE'},
             {'time':1100.25,'desktop':True,'evidence':'Spotify'}]
        save(legacy,{'observations':old})
        save(cache_path(self.store.directory,video,'visual-v10',{'sample_seconds':10.0}),{'observations':old[:2]})
        class Reader:
            def __init__(self,*args):pass
            def frame(self,second):return second
            def close(self):pass
        class Detector:
            cancel=True
            def __init__(self):self.calls=[]
            def observe(self,frame,second):
                self.calls.append(second)
                if self.cancel and second==1020.25:raise Cancelled('masked defeat refresh')
                return playing(second,int(second+800)) if second<1020 else {'time':second,'outcome':'defeat'}
        detector=Detector();options={'sample_seconds':10,'audio':False}
        with patch('footage_manager.analysis.FrameReader',Reader):
            with self.assertRaises(Cancelled):analyze_video(self.store,video,{},options,detector)
            self.assertIsNone(self.repo.load(video))
            detector.cancel=False
            analyze_video(self.store,video,{},options,detector)
        self.assertNotIn(0,detector.calls);self.assertNotIn(1000,detector.calls)
        self.assertNotIn(1100.25,detector.calls)
        self.assertEqual(2,detector.calls.count(1020.25))
        self.assertEqual('defeat',self.repo.load(video)['games'][0]['outcome'])
        self.assertEqual(old,read(legacy)['observations'])

    def test_top_result_context_refresh_preserves_classified_and_inactive_work(self):
        source=Path(self.temp.name)/'source.mp4';source.write_bytes(b'fixture')
        st=source.stat()
        self.store.execute('UPDATE videos SET path=?,size=?,mtime_ns=? WHERE id=?',(str(source),st.st_size,st.st_mtime_ns,self.id))
        video=self.store.video(self.id)
        legacy=cache_path(self.store.directory,video,'visual-v8',{'sample_seconds':10.0})
        old=[playing(0,800),playing(1000,1800),
             {'time':1020.25,'outcome':None,'evidence':'ICTORY VIEW ADVANCED DETAILS CONTINUE'},
             {'time':1100.25,'desktop':True,'evidence':'Spotify'},
             {'time':1100.75,'desktop':True,'outcome':'victory','evidence':'VICTORY'}]
        save(legacy,{'observations':old})
        save(cache_path(self.store.directory,video,'visual-v10',{'sample_seconds':10.0}),{'observations':old[:2]})
        class Reader:
            def __init__(self,*args):pass
            def frame(self,second):return second
            def close(self):pass
        class Detector:
            cancel=True
            def __init__(self):self.calls=[]
            def observe(self,frame,second):
                self.calls.append(second)
                if self.cancel and second==1020.25:raise Cancelled('top context refresh')
                return playing(second,int(second+800)) if second<1020 else {'time':second,'outcome':'victory'}
        detector=Detector();options={'sample_seconds':10,'audio':False}
        with patch('footage_manager.analysis.FrameReader',Reader):
            with self.assertRaises(Cancelled):analyze_video(self.store,video,{},options,detector)
            self.assertIsNone(self.repo.load(video))
            detector.cancel=False
            analyze_video(self.store,video,{},options,detector)
        for second in (0,1000,1100.25,1100.75):self.assertNotIn(second,detector.calls)
        self.assertEqual(2,detector.calls.count(1020.25))
        result=self.repo.load(video)
        self.assertEqual('victory',result['games'][0]['outcome'])
        self.assertEqual('victory',next(s for s in result['observations'] if s['time']==1020.25)['outcome'])
        self.assertEqual(old,read(legacy)['observations'])

    def test_brief_nexus_transition_is_detected_and_fractional_probes_resume(self):
        source=Path(self.temp.name)/'source.mp4';source.write_bytes(b'fixture')
        st=source.stat()
        self.store.execute('UPDATE videos SET path=?,size=?,mtime_ns=? WHERE id=?',(str(source),st.st_size,st.st_mtime_ns,self.id))
        video=self.store.video(self.id)
        class Reader:
            def __init__(self,*args):pass
            def frame(self,second):return second
            def close(self):pass
        class Detector:
            cancel=True
            seen=[]
            def observe(self,frame,second):
                if self.cancel and second==1000.75:raise Cancelled('fractional probe cancellation')
                self.seen.append(second)
                if 100<=second<1000.75:return playing(second,int(second-100))
                if second>=1000.75:return {'time':second,'no_hud':True,'desktop':second>=1001.5}
                return {'time':second}
        detector=Detector();options={'sample_seconds':10,'audio':False}
        with patch('footage_manager.analysis.FrameReader',Reader):
            with self.assertRaises(Cancelled):analyze_video(self.store,video,{},options,detector)
            self.assertIsNone(self.repo.load(video))
            seen=list(detector.seen)
            detector.cancel=False
            result=analyze_video(self.store,video,{},options,detector)
        self.assertEqual(1,result['games'])
        self.assertEqual(len(detector.seen),len(set(detector.seen)))
        self.assertTrue(set(seen).issubset(detector.seen))
        game=self.repo.load(video)['games'][0]
        self.assertEqual((100,1000.75),(game['start'],game['end']))
        self.assertEqual(1060.75,game['trim_end'])
        self.assertFalse(game['partial_end'])


@unittest.skipUnless(importlib.util.find_spec('rapidocr_onnxruntime'),'Analysis dependencies not installed')
class ReferenceEvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import cv2
        from footage_manager.visual_analysis import VisualDetector
        cls.cv=cv2;cls.detector=VisualDetector();cls.root=Path(__file__).parent/'references'

    def test_user_supplied_hud_and_end_screen_references(self):
        cases=[('hud-early','active',True),('hud-late','clock',317),('defeat','outcome','defeat'),
               ('lobby-victory','outcome','victory'),('loadout','loading',True),('loading','loading',True),('replay','replay',True),('continue','continue',True)]
        for name,key,expected in cases:
            with self.subTest(name=name):
                result=self.detector.observe(self.cv.imread(str(self.root/(name+'.png'))))
                self.assertEqual(expected,result[key])
                json.dumps(result)

    def test_between_games_shortcut_matches_scaled_snippet_and_skips_full_scene_ocr(self):
        import numpy as np
        reference=self.cv.imread(str(self.root/'between-games-table.png'))
        for width in (360,432,600):
            frame=np.zeros((720,1280,3),dtype=np.uint8)
            tile=self.cv.resize(reference,(width,round(width*reference.shape[0]/reference.shape[1])))
            tile[round(tile.shape[0]*.76):]=0  # A lower-third caption obscures this part.
            frame[350:350+tile.shape[0],80:80+width]=tile
            with self.subTest(width=width), patch.object(self.detector,'line',return_value=''), \
                 patch.object(self.detector,'read',return_value=[]) as text:
                observation=self.detector.observe(frame,1020)
                self.assertTrue(observation['between_games'])
                self.assertFalse(observation['active'])
                self.assertEqual(1020,observation['time'])
                text.assert_called_once()
                self.assertEqual(216,text.call_args.args[0].shape[0])
        gameplay=self.cv.imread(str(self.root/'gameplay-full.jpg'))
        self.assertFalse(self.detector.between_games.matches(gameplay))
        with patch.object(self.detector.between_games,'matches',return_value=True) as background:
            observation=self.detector.observe(gameplay,3600)
            self.assertTrue(observation['active'])
            self.assertFalse(observation.get('between_games',False))
            background.assert_not_called()

    def test_fullscreen_player_controls_are_distinct_from_live_hud(self):
        for name,expected in (('browser-player-start.jpg',True),('browser-player-late.jpg',True),
                              ('browser-player-hidden.jpg',False),('live-hud-desktop.jpg',False),
                              ('gameplay-full.jpg',False),('desktop-full.jpg',False)):
            with self.subTest(name=name):
                frame=self.cv.imread(str(self.root/name))
                self.assertEqual(expected,player_visible(frame))
        live=self.detector.observe(self.cv.imread(str(self.root/'live-hud-desktop.jpg')),2441)
        self.assertTrue(live['active']);self.assertTrue(live['desktop']);self.assertFalse(live['player'])
        player=self.detector.observe(self.cv.imread(str(self.root/'browser-player-start.jpg')),2249)
        self.assertTrue(player['active']);self.assertTrue(player['player'])

    def test_real_full_frames_are_serializable_and_have_end_evidence(self):
        end=self.detector.observe(self.cv.imread(str(self.root/'endgame-full.jpg')),4096)
        self.assertTrue(end['continue']);self.assertTrue(end['no_hud']);json.dumps(end)
        result=self.detector.observe(self.cv.imread(str(self.root/'postgame-full.jpg')),4140)
        self.assertEqual('defeat',result['outcome']);json.dumps(result)
        active=self.detector.observe(self.cv.imread(str(self.root/'gameplay-full.jpg')),3600)
        self.assertTrue(active['active']);json.dumps(active)

    def test_replay_banner_in_middle_of_animation(self):
        replay=self.detector.observe(self.cv.imread(str(self.root/'replay-middle.jpg')),4670)
        self.assertTrue(replay['replay']);json.dumps(replay)

    def test_desktop_taskbar_is_distinct_from_real_game_end_portrait(self):
        desktop=self.detector.observe(self.cv.imread(str(self.root/'desktop-full.jpg')),1258)
        self.assertTrue(desktop['desktop']);self.assertTrue(desktop['no_hud']);json.dumps(desktop)
        end=self.detector.observe(self.cv.imread(str(self.root/'endgame-full.jpg')),4096)
        self.assertFalse(end['desktop']);self.assertTrue(end['continue'])
        offline=self.detector.observe(self.cv.imread(str(self.root/'camera-off-full.jpg')),1400)
        self.assertFalse(offline['loading']);self.assertFalse(offline['active'])


if __name__=='__main__':unittest.main()
