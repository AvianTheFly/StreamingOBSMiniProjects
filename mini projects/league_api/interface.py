from shared import ProjectInterface, ProjectStatus, project_registry
_live={}
class LeagueAPIInterface(ProjectInterface):
    name='league_api'
    controlled_scenes=['League API']
    produces_audio=True
    def workflow_state(self):
        service = _live.get('service')
        if not service: return {}
        client = service.client_scenes.snapshot()
        return {**{key:client.get(key) for key in ('phase','target','status','privacy_armed','connected')},
                'scene_automation': client['settings']['enabled'],
                'champion_scene': client['settings'].get('champion_scene'),
                'lobby_scene': client['settings']['lobby_scene']}
    def action_catalog(self):
        return [*super().action_catalog(),
                {'key':'champion_select','label':'Show champion select'},
                {'key':'queue_lobby','label':'Hide for queue'}]
    def run_action(self, action, **kwargs):
        service = _live.get('service')
        if action in {'champion_select','queue_lobby'}:
            if service is None:
                return {'ok':False,'error':'League scene controls are still starting'}
            method = service.client_scenes.present_champions if action=='champion_select' else service.client_scenes.hide_now
            return {'ok':True,'client_scenes':method()}
        return super().run_action(action, **kwargs)
    def capabilities(self):
        service = _live.get('service')
        return {'production_borders': bool(service and service.engine.production.settings.get('enabled'))}
    def get_status(self):
        s=_live.get('service')
        snapshot=s.snapshot() if s else {}
        production=snapshot.get('production',{})
        active=bool(snapshot.get('alerts') or snapshot.get('match_screen') or production.get('ambient') or production.get('effect') or production.get('death'))
        return ProjectStatus(self.name,active,s.status if s else None,self.controlled_scenes,True)
    def revert(self):
        s=_live.get('service')
        if s:
            with s.lock:
                s.engine.clear()
                s.match_screens.clear()
interface=LeagueAPIInterface()
project_registry.register(interface)
