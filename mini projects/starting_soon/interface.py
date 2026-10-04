from lib.project_runtime import ProjectInterface, ProjectStatus, project_registry

_service = None


def register(service):
    global _service
    _service = service


class StartingSoonInterface(ProjectInterface):
    name = 'starting_soon'
    controlled_scenes = ['Starting Soon']
    produces_audio = True

    def get_status(self):
        data = _service.snapshot() if _service else {}
        return ProjectStatus(self.name, bool(data.get('active')), data.get('clip_title') or
                             ('Waiting for stream' if data.get('active') else None), self.controlled_scenes, True,
                             is_paused=data.get('session_queue',{}).get('paused',False))

    def revert(self):
        self.run_action('finish')

    def action_catalog(self):
        return [dict(key=k, label=v) for k, v in [('start', 'Open Starting Soon'),
            ('finish', 'Finish Starting Soon'), ('play', 'Play Selected Clips'), ('stop', 'Stop Clips'),
            ('skip', 'Next Clip'), ('pause','Pause Clips'), ('resume','Resume Clips'),
            ('next-art', 'Next Background'), ('install', 'Install OBS Scene'),
            ('show-message','Show Starting Soon text'), ('hide-message','Hide Starting Soon text')]]

    def run_action(self, action, **kwargs):
        if not _service:
            return dict(ok=False, error='Starting Soon is not ready.')
        if action not in {v['key'] for v in self.action_catalog()} | {
                'queue-next','queue-remove','queue-first','apply-layout','set-art'}:
            return dict(ok=False, error='Unknown Starting Soon action.')
        _service.queue.put((action, kwargs))
        return dict(ok=True, queued=True)


interface = StartingSoonInterface()
project_registry.register(interface)
