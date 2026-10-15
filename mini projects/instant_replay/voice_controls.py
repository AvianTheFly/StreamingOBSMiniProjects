"""Replay voice delivery adapter; existing capture/playback owners do the work."""
from .commands import parse_command
from . import stage
from coordinator import coordinator


class ReplayVoiceControls:
    def __init__(self, capture, selection, playback, state, stop_event):
        self.capture, self.selection, self.playback = capture, selection, playback
        self.state, self.stop_event = state, stop_event

    def dispatch(self, text, pressed_at=None):
        if self.stop_event.is_set():
            return
        print(f'[instant_replay] Heard: {text!r}')
        action, spec, seconds, full = parse_command(text)
        if action in ('save', 'mark'):
            handler = self.capture._on_mark if action == 'mark' else self.capture._on_save
            return handler(tag=spec, clip_seconds=seconds, full_save=full, pressed_at=pressed_at)
        if action in ('save_replay', 'quick_replay'):
            return self.selection.capture_and_replay(self.capture, tag=spec, seconds=seconds,
                full_save=full, pressed_at=pressed_at,
                purpose='replay_only' if action == 'quick_replay' else 'highlight')
        if action == 'play':
            return self.selection._on_play(spec)
        if action == 'stop':
            self.state._cancel_watcher.set()
            self.selection.cancel_pending()
            return self.playback._end_replay(cancelled=True)
        if action in ('pause', 'resume'):
            return coordinator.manual_action('instant_replay', action)
        if action == 'next':
            if self.state._replay_active[0]:
                self.state._skip_clip.set()
        elif action == 'screen':
            return stage.set_companion(spec == 'on')
        elif action == 'view':
            return stage.set_view(spec)
        elif action is None:
            print('[instant_replay] Say mark, save, replay now, or play last. '
                  'Capture options: 30, full, or name Dragon steal. See Voice commands in Manage clips.')
