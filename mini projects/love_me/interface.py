"""Public live status/actions for the Hub and scoped coordinator pauses."""
from shared import ProjectInterface, ProjectStatus, project_registry
from .catalog import presets

_live = {}


class _LoveMeInterface(ProjectInterface):
    name='love_me'
    controlled_scenes=['LoveMe']
    produces_audio=True

    def get_status(self):
        service=_live.get('service')
        state=service.snapshot() if service else {}
        return ProjectStatus(self.name,bool(state.get('busy')),state.get('active'),self.controlled_scenes,
                             True,bool(state.get('paused')))

    def workflow_state(self):
        service=_live.get('service')
        return service.snapshot() if service else {'busy':False}

    def revert(self):
        if service:=_live.get('service'):
            service.cancel()

    def pause(self):
        if service:=_live.get('service'):
            service.pause(True)

    def resume(self):
        if service:=_live.get('service'):
            service.pause(False)

    def action_catalog(self):
        store=_live.get('store')
        rows=store.snapshot()['variations'] if store else presets()
        return [{'key':'original','label':'Original Love Me · next stage'},
                *[{'key':row['id'],'label':row['name'],'description':row['feeling']} for row in rows],
                {'key':'revert','label':'Stop mood cue'}, {'key':'pause','label':'Pause'}, {'key':'resume','label':'Resume'}]

    def run_action(self,action,**kwargs):
        if action in {'revert','pause','resume'}:
            return super().run_action(action,**kwargs)
        service=_live.get('service')
        if not service:
            return {'ok':False,'error':'Mood cues are not ready.'}
        try:
            return {'ok':service.trigger(action),'action':action}
        except ValueError as exc:
            return {'ok':False,'error':str(exc)}

    def capabilities(self):
        return {'mood_cues':True,'browser_preview':True,'variations':True}

    def apply_audio_state(self,state):
        """Public master/profile fader contract for the existing Hub audio owner."""
        if service:=_live.get('service'):
            service.presentation.apply_audio_state(state)


interface=_LoveMeInterface()
project_registry.register(interface)
