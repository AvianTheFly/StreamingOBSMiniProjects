from shared import ProjectInterface, ProjectStatus, project_registry
_live={}
class LeagueAPIInterface(ProjectInterface):
    name='league_api'
    controlled_scenes=['League API']
    produces_audio=True
    def get_status(self):
        s=_live.get('service')
        return ProjectStatus(self.name,bool(s and s.snapshot()['alerts']),s.status if s else None,self.controlled_scenes,True)
    def revert(self):
        s=_live.get('service')
        if s:
            with s.lock: s.engine.clear()
interface=LeagueAPIInterface()
project_registry.register(interface)
