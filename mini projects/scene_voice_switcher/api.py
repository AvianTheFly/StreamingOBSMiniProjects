"""Public scene controls used by HTTP and the scene-switcher page."""
from .config import GAME_SCENE, LOBBIES_SCENE
from .inventory import _discover_lobbies
from .inventory import publish_inventory
from .layouts import canonical, artwork, LAYOUTS
from . import settings, presentation
from lib.coordination.scenes import scene_director
from lib.settings_backups import SettingsBackups
from lib.display_capture import snapshot as screen_snapshot
from .routing import show_lobby


def locations():
    import obs
    client=obs.get_obs()
    lobbies=_discover_lobbies()
    program=client.get_current_program_scene().current_program_scene_name
    visible=[r['sourceName'] for r in client.get_scene_item_list(LOBBIES_SCENE).scene_items
             if r['sourceName'] in lobbies and r['sceneItemEnabled']]
    return {'game_scene': GAME_SCENE, 'lobbies_scene': LOBBIES_SCENE,
            'lobbies': list(lobbies), 'locations':[presentation.describe(client,n) for n in lobbies],
            'current_lobby':program if program in lobbies else visible[0] if program==LOBBIES_SCENE and visible else None,
            'program_scene':program,'screen':screen_snapshot(client=client)}


def select_lobby(source=None, *, screen_visible=None):
    if screen_visible is not None and not isinstance(screen_visible,bool):
        raise ValueError('Screen visibility must be true or false')
    revision = scene_director.snapshot()['manual_revision']
    lobbies = _discover_lobbies()
    publish_inventory(lobbies)
    source = canonical(source,lobbies)
    applied, selected = show_lobby(lobbies, selected=source, expected_manual_revision=revision,
                                  screen_visible=screen_visible)
    if not applied:
        raise ValueError('Lobby request was superseded')
    from .interface import _live
    active = _live.get('active_source')
    if active is not None:
        active[0] = selected
    return {'ok': True, 'lobby': selected}


def configure_lobby(source, changes):
    import obs
    with presentation.lock:
        lobbies=_discover_lobbies()
        source=canonical(source,lobbies)
        if source not in LAYOUTS: raise ValueError('This lobby has no authored layout')
        SettingsBackups().snapshot()
        settings.save(source,changes,lobbies)
        if any(k in changes for k in ('screen','camera','chat')):
            presentation.restore(obs.get_obs(),source)
        publish_inventory(lobbies)
        return {'ok':True,'location':presentation.describe(obs.get_obs(),source)}


def restore_lobby(source):
    import obs
    with presentation.lock:
        lobbies=_discover_lobbies(); source=canonical(source,lobbies)
        if source not in lobbies: raise ValueError('Lobby is not installed')
        SettingsBackups().snapshot()
        presentation.restore(obs.get_obs(),source)
        return {'ok':True,'location':presentation.describe(obs.get_obs(),source)}
