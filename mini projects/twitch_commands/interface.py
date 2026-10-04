"""Chat status is independent of OBS playback coordination."""
from lib.project_runtime import ProjectInterface,ProjectStatus,project_registry
from . import api


class CommandsInterface(ProjectInterface):
    name = 'twitch_commands'

    def get_status(self):
        try:
            state = api.state()
            count = sum(c['enabled'] for c in state['commands'])
            return ProjectStatus(self.name,False,f'{count} chat command groups ready' if state['enabled'] else 'Chat commands disabled',[],False)
        except ValueError:
            return ProjectStatus(self.name,False,'Not running',[],False)

    def action_catalog(self):
        return []


interface = CommandsInterface()
project_registry.register(interface)
