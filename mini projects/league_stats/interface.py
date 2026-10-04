"""Project status; tracking is independent of playback pause/scene coordination."""
from lib.project_runtime import ProjectInterface, ProjectStatus, project_registry
from . import api


class StatsInterface(ProjectInterface):
    name = 'league_stats'

    def get_status(self):
        try:
            tracker = api.provider()
            with tracker.lock:
                active = bool(tracker.current and tracker.current.get('state')=='live' and tracker.monotonic()-tracker.last_seen<=5)
                return ProjectStatus(self.name,active,tracker.error or tracker.status,[],False)
        except ValueError:
            return ProjectStatus(self.name,False,'Not running',[],False)

    def action_catalog(self):
        return []


interface = StatsInterface()
project_registry.register(interface)
