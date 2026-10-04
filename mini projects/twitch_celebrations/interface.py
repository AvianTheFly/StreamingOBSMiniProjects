from lib.project_runtime import ProjectInterface, ProjectStatus, project_registry

_live = {}

class CelebrationsInterface(ProjectInterface):
    name = 'twitch_celebrations'
    produces_audio = True

    def workflow_state(self):
        service = _live.get('service')
        if not service: return {}
        with service.lock:
            return {'queued':len(service.engine.queue), 'phase':service.engine.active.get('kind') if service.engine.active else 'idle',
                    'enabled':service.settings['enabled']}

    def get_status(self):
        s = _live.get('service')
        active = s.state()['active'] if s else None
        return ProjectStatus(self.name, bool(active), active['kind'] if active else 'Celebrations ready' if s else 'Starting', [], True,
                             is_paused=bool(s and s.engine.paused))

    def revert(self):
        s = _live.get('service')
        if s:
            with s.lock: s.engine.clear()

    def pause(self):
        s = _live.get('service')
        if s:
            with s.lock:
                s.engine.paused = True
                s.engine.clear()

    def resume(self):
        s = _live.get('service')
        if s:
            with s.lock: s.engine.paused = False

interface = CelebrationsInterface()
project_registry.register(interface)
