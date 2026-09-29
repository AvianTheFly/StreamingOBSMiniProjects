from lib.project_runtime import ProjectInterface, ProjectStatus, project_registry

_live = {}

class CelebrationsInterface(ProjectInterface):
    name = 'twitch_celebrations'
    produces_audio = True

    def get_status(self):
        s = _live.get('service')
        active = s.state()['active'] if s else None
        return ProjectStatus(self.name, bool(active), active['kind'] if active else 'Celebrations ready' if s else 'Starting', [], True)

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
