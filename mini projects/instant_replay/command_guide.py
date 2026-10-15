"""Public, read-only replay voice reference; the Hub renders this feature data."""
from .config import HOTKEY_LISTEN, REVIEW_CAPTURE_SECONDS


def command_guide():
    return {
        'hotkey': HOTKEY_LISTEN,
        'instructions': f'Press {HOTKEY_LISTEN}, then speak. Works during playback too. '
                        f'Finish speaking and pause to transcribe; press C or {HOTKEY_LISTEN} again to finish sooner.',
        'groups': [
            {'title': 'Capture a moment', 'commands': [
                {'say': 'mark', 'description': f'Save the last {REVIEW_CAPTURE_SECONDS:g} seconds for later review. No Twitch clip or automatic playback.'},
                {'say': 'save', 'description': 'Keep a highlight and request a Twitch clip. Uses the game kill/death anchor, or the full buffer when none exists.'},
                {'say': 'replay now', 'description': 'Capture and play the last 15 seconds. No Twitch clip; excluded from highlight montages.'},
                {'say': 'save and replay', 'description': 'Keep a highlight, request a Twitch clip, then play the finished capture.'},
            ]},
            {'title': 'Choose length and title', 'commands': [
                {'say': 'save 30 name Dragon steal', 'description': 'Add a length (3–120 seconds), then name and your title. Works with mark, replay now, and save and replay too.'},
                {'say': 'mark full', 'description': 'Use full instead of a length to retain the available buffer. Works with all capture commands. OBS buffer length limits what is available.'},
                {'say': 'save win', 'description': 'Existing win, escape and fail tags still work. Use name for any custom title; put it last.'},
            ]},
            {'title': 'Play saved clips', 'commands': [
                {'say': 'play last', 'description': 'Play the latest eligible saved clip.'},
                {'say': 'play name Dragon steal', 'description': 'Find a saved clip by its title. play win or play win 2 selects a tag or its numbered clip.'},
                {'say': 'play highlights', 'description': 'Play the current game highlights, or the previous game if none exist.'},
                {'say': 'play game 3', 'description': 'Play that game’s highlights. play game last selects the latest archived game.'},
                {'say': 'play group Stream intro', 'description': 'Play a saved montage by name.'},
                {'say': 'play random', 'description': 'Continuously shuffle replay-ready highlights until stopped.'},
                {'say': 'play showcase', 'description': 'Show the latest highlight in the showcase layout.'},
            ]},
            {'title': 'During playback', 'commands': [
                {'say': 'pause', 'description': 'Pause the current replay.'},
                {'say': 'resume', 'description': 'Continue the paused replay.'},
                {'say': 'next', 'description': 'Skip to the next clip.'},
                {'say': 'stop', 'description': 'Stop playback or cancel a replay that is still being saved; return to live.'},
                {'say': 'screen on / screen off', 'description': 'Show or hide the companion screen. live view chooses the live game view.'},
            ]},
        ],
        'compatibility': 'Older shortcuts still work: quick replay = replay now; replay = play replay (latest capture in quick layout); random = play random; showcase = play showcase; name Dragon steal = save name Dragon steal.',
    }
