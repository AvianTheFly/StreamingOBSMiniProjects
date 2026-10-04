from lib.project_runtime import ProjectInterface, ProjectStatus, project_registry

_live = {}


class SpotifyInterface(ProjectInterface):
    name = 'spotify'
    controlled_scenes = ['Spotify Overlay']

    def get_status(self):
        state = _live.get('state')
        data = state.snapshot() if state else {}
        activity = f"{data.get('title', '')} — {data.get('artist', '')}" if data.get('playing') else data.get('error') or 'Waiting for Spotify playback'
        if data.get('audio_error'):
            activity += f" (visualizer: {data['audio_error']})"
        return ProjectStatus(self.name, bool(data.get('playing')), activity, self.controlled_scenes, True,
                             is_paused=bool(state and state.hidden))

    def revert(self):
        self.pause()

    def pause(self):
        if state := _live.get('state'):
            state.set_hidden(True)

    def resume(self):
        if state := _live.get('state'):
            state.set_hidden(False)

    def action_catalog(self):
        return [dict(key='pause', label='Hide Overlay', description='Hide the Spotify visualizer.'),
                dict(key='resume', label='Show Overlay', description='Show while Spotify is playing.')]


interface = SpotifyInterface()
project_registry.register(interface)
