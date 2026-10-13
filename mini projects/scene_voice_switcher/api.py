"""Public scene controls used by HTTP and the scene-switcher page."""
from .config import GAME_SCENE, LOBBIES_SCENE, PRESENTATION_SCENES
from .inventory import _discover_lobbies
from .inventory import publish_inventory
from .layouts import canonical, artwork, LAYOUTS
from . import settings, presentation
from lib.coordination.scenes import scene_director
from lib.settings_backups import SettingsBackups
from lib.display_capture import snapshot as screen_snapshot
from .routing import show_lobby


def current_lobby(client, lobbies):
    program = client.get_current_program_scene().current_program_scene_name
    if program in lobbies:
        return program
    if program == LOBBIES_SCENE:
        return next((item['sourceName'] for item in client.get_scene_item_list(LOBBIES_SCENE).scene_items
                     if item['sourceName'] in lobbies and item['sceneItemEnabled']), None)
    return None


def lobby_effect(source, action):
    """Return a cue only while its authored world is actually on program."""
    import obs
    from .effects import envelope
    with presentation.lock:
        client = obs.get_obs()
        lobbies = _discover_lobbies()
        source = canonical(source, lobbies)
        if source != current_lobby(client, lobbies):
            raise ValueError('That lobby is no longer on screen')
        cue = envelope(source, action)
        living = source + ' Living World'
        if living not in obs.list_sources(source):
            raise ValueError('Living effects are not installed in this lobby')
        return cue


def catalog():
    """Browse authored worlds without requiring an OBS connection."""
    data = settings.read()
    from .effects import catalog as effects_catalog
    return {'selection': settings.selection(data), 'locations': [
        {'source': name, 'label': row[1], 'rotation': settings.location(name, data)['rotation'],
         'effects': effects_catalog(name),
         'art_url': '/api/projects/scene_voice_switcher/artwork?source=' + name
                    if row[0] else '/spirit-lobby/art/clubhouse-aligned.png'}
        for name, row in LAYOUTS.items()]}


def configure_selection(mode, source=None):
    with presentation.lock:
        lobbies = _discover_lobbies()
        source = canonical(source, lobbies)
        SettingsBackups().snapshot()
        saved = settings.save_selection(mode, source, lobbies)
        publish_inventory(lobbies)
        return {'ok': True, 'selection': settings.selection(saved)}


def locations():
    import obs
    client=obs.get_obs()
    lobbies=_discover_lobbies()
    program=client.get_current_program_scene().current_program_scene_name
    visible=[r['sourceName'] for r in client.get_scene_item_list(LOBBIES_SCENE).scene_items
             if r['sourceName'] in lobbies and r['sceneItemEnabled']]
    installed = set(obs.list_scenes())
    from .screen_content import catalog as display_catalog
    return {'game_scene': GAME_SCENE, 'lobbies_scene': LOBBIES_SCENE, 'selection': settings.selection(),
            'display': display_catalog(client),
            'lobbies': list(lobbies), 'locations':[presentation.describe(client,n) for n in lobbies],
            'current_lobby':program if program in lobbies else visible[0] if program==LOBBIES_SCENE and visible else None,
            'program_scene':program,'screen':screen_snapshot(client=client),
            'other_scenes': [{'scene': name, 'label': label} for name, label in PRESENTATION_SCENES.items()
                             if name in installed]}


def select_lobby(source=None, *, screen_visible=None, expected_manual_revision=None):
    if screen_visible is not None and not isinstance(screen_visible,bool):
        raise ValueError('Screen visibility must be true or false')
    revision = (scene_director.snapshot()['manual_revision'] if expected_manual_revision is None
                else expected_manual_revision)
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


def select_stage(stage, source=None):
    """Manual session choices are policy here, never in the HTTP adapter."""
    from .interface import _live
    from .routing import show_game
    controls = _live.get('session_controls')
    if controls is None:
        raise ValueError('Scene controls are still starting')
    def select():
        if stage in {'game', 'loading'}:
            if not show_game():
                raise ValueError('Gameplay choice was superseded')
            return {'ok': True, 'scene': GAME_SCENE}
        return select_lobby(source, screen_visible=False)
    return controls.present(stage, select)


def next_lobby():
    """A deliberate next-world choice preserves the saved fixed/rotation preference."""
    import random
    import obs
    lobbies = _discover_lobbies()
    data = settings.read()
    choices = settings.rotation(lobbies, {**data, 'selection': {'mode': 'shuffle', 'source': None}})
    current = current_lobby(obs.get_obs(), lobbies)
    alternatives = [name for name in choices if name != current]
    return select_stage('lobby', random.choice(alternatives or choices))


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
