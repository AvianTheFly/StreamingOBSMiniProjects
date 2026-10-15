"""Replay grammar/delivery regressions without microphone, OBS or personal writes."""
import threading
import unittest
from unittest.mock import Mock, patch

from lib.paths import ensure_import_paths, load_project_env
ensure_import_paths(); load_project_env()
from instant_replay import commands, main, api
from instant_replay.command_guide import command_guide
from instant_replay.voice_controls import ReplayVoiceControls
from instant_replay.runtime_state import ReplayState
from instant_replay.selection import ReplaySelection


class VoiceGrammarTests(unittest.TestCase):
    def test_shared_capture_syntax_and_literal_titles(self):
        for phrase, action in [('mark','mark'),('save','save'),('replay now','quick_replay'),('save and replay','save_replay')]:
            for option, seconds, full in [('30',30,False),('twenty-five seconds',25,False),('one minute',60,False),('full',0,True)]:
                with self.subTest(phrase=phrase,option=option):
                    self.assertEqual(commands.parse_command(f'{phrase} {option} name Save full game 60 and replay'),
                                     (action,'Save full game 60 and replay',seconds,full))
        self.assertEqual(commands.parse_command('save 30 and replay name Dragon steal'),('save_replay','Dragon steal',30,False))
        self.assertEqual(commands.parse_command('save & replay 30'),('save_replay','',30,False))
        self.assertEqual(commands.parse_command('Save, thirty seconds, name Dragon steal!'),('save','Dragon steal',30,False))
        self.assertEqual(commands.parse_command('Replay now, thirty seconds.'),('quick_replay','',30,False))

    def test_invalid_speech_never_silently_captures(self):
        for text in ('display game','please','please do not save','face','dark','I saved that','bookmark','gameplay','save garbage words',
                     'save -30','save 0','save nan','save inf','save 999','save 30 45','save full 30','quick replay banana',
                     'replay now name','save and replay name','mark 30 name'):
            with self.subTest(text=text):
                self.assertEqual(commands.parse_command(text),commands.NO_COMMAND)

    def test_play_target_never_becomes_capture(self):
        for target in ('name Save the game','name Full 30','group Save the day','intro Replay now','Dragon steal','game 3'):
            self.assertEqual(commands.parse_command('play '+target),('play',target.lower(),0,False))

    def test_reference_examples_are_accepted_and_reads_are_independent(self):
        guide=command_guide()
        for group in guide['groups']:
            for entry in group['commands']:
                for phrase in entry['say'].split(' / '):
                    with self.subTest(phrase=phrase):
                        self.assertIsNotNone(commands.parse_command(phrase)[0])
        guide['groups'].clear()
        self.assertTrue(api.voice_commands()['groups'])


class VoiceDeliveryTests(unittest.TestCase):
    def setUp(self):
        self.state=ReplayState();self.stop=threading.Event()
        self.capture,self.selection,self.playback=Mock(),Mock(),Mock()
        self.voice=ReplayVoiceControls(self.capture,self.selection,self.playback,self.state,self.stop)

    def test_save_and_replay_forwards_duration_without_requiring_a_title(self):
        self.voice.dispatch('save and replay 30',100)
        self.selection.capture_and_replay.assert_called_once_with(self.capture,tag='',seconds=30,full_save=False,
            pressed_at=100,purpose='highlight')

    def test_named_replay_only_retains_capture_policy_and_press_time(self):
        self.voice.dispatch('replay now full name Funny moment',101)
        self.selection.capture_and_replay.assert_called_once_with(self.capture,tag='Funny moment',seconds=0,full_save=True,
            pressed_at=101,purpose='replay_only')

    def test_stop_revokes_pending_work_and_pause_uses_coordinator(self):
        self.voice.dispatch('stop')
        self.assertTrue(self.state._cancel_watcher.is_set())
        self.selection.cancel_pending.assert_called_once()
        self.playback._end_replay.assert_called_once_with(cancelled=True)
        with patch('instant_replay.voice_controls.coordinator') as coordinator:
            self.voice.dispatch('pause');self.voice.dispatch('resume')
            self.assertEqual(coordinator.manual_action.call_args_list,
                [unittest.mock.call('instant_replay','pause'),unittest.mock.call('instant_replay','resume')])

    def test_shutdown_discards_delayed_voice(self):
        self.stop.set();self.voice.dispatch('save')
        self.capture._on_save.assert_not_called()

    def test_title_selection_is_literal_and_game_words_do_not_select_all(self):
        state=ReplayState();views=Mock();player=Mock();selection=ReplaySelection(state,views,player)
        with patch('instant_replay.library.search_paths',return_value=['clip.mkv']) as search:
            selection._on_play('name save the game')
            search.assert_called_once_with('save the game',unittest.mock.ANY)
        player._play_all_clips_sequential.assert_called_once_with(['clip.mkv'])
        selection._on_play('great game escape')
        views._resolve_play_spec.assert_called_once_with('great game escape')

    def test_hotkey_listens_during_active_playback(self):
        # Run the real assembly with all resource owners replaced by fixtures.
        import queue
        state=ReplayState();state._replay_active[0]=True;state._is_multi_clip_active[0]=True
        stop=threading.Event();keys=[]
        class Input:
            def get(self,timeout):
                keys[0]('|');stop.set();raise queue.Empty
        with patch.object(main,'KillTracker'),patch.object(main,'start_deferred'), \
             patch.object(main,'ReplayState',return_value=state),patch.object(main,'ReplayCapture'), \
             patch.object(main,'ReplayInventory'),patch.object(main,'ReplayPlayback') as player, \
             patch.object(main,'ReplaySelection'),patch.object(main,'VoicePTT') as ptt, \
             patch.object(main,'key_char',side_effect=lambda key:key), \
             patch.object(main,'subscribe_global_hotkeys',side_effect=lambda handler:keys.append(handler) or 1), \
             patch.object(main,'unsubscribe_global_hotkeys'),patch.object(main.stage,'install'):
            main.run(Input(),stop)
            ptt.return_value.on_trigger.assert_called_once()
            player.return_value._end_replay.assert_not_called()
            self.assertFalse(state._skip_clip.is_set())
