from shared import ProjectInterface, ProjectStatus, project_registry
_live={}
class LeagueAPIInterface(ProjectInterface):
    name='league_api'
    controlled_scenes=['League API']
    produces_audio=True
    def get_status(self):
        s=_live.get('service')
        snapshot=s.snapshot() if s else {}
        production=snapshot.get('production',{})
        active=bool(snapshot.get('alerts') or production.get('ambient') or production.get('effect'))
        return ProjectStatus(self.name,active,s.status if s else None,self.controlled_scenes,True)
    def revert(self):
        s=_live.get('service')
        if s:
            with s.lock: s.engine.clear()
interface=LeagueAPIInterface()
project_registry.register(interface)
