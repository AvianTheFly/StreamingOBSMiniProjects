"""League lobby group policy; the shared director owns scene transactions."""
from lib.coordination.scenes import scene_director
from lib.coordination.lobbies import lobby_catalog, prepare_lobby


def idle_uses_lobby(settings):
    return settings.get('idle_presentation', 'scene') == 'lobby'


def destination(settings, target):
    if target == 'champions' and settings.get('champion_scene'):
        return settings['champion_scene']
    if target == 'idle' and not idle_uses_lobby(settings):
        return settings['idle_scene']
    return settings['lobby_scene']


def _prepare_scene(client, settings, target):
    """Resolve every required item before writing visibility or switching scenes."""
    scenes = {s['sceneName'] for s in client.get_scene_list().scenes}
    if target == 'champions' and settings.get('champion_scene'):
        scene = settings['champion_scene']
        if scene not in scenes:
            raise ValueError(f'OBS champion scene is missing: {scene}')
        return
    scene = destination(settings, target)
    if scene not in scenes:
        raise ValueError(f'OBS scene is missing: {scene}')
    if target == 'idle' and not idle_uses_lobby(settings):
        return
    items = client.get_scene_item_list(scene).scene_items
    indexed = {i['sourceName']: i for i in items}
    candidates, exclusions = lobby_catalog.snapshot(scene)
    if target == 'idle' and not candidates:
        candidates = (settings['queue_group'], *settings['other_lobby_groups'])
        exclusions = (settings['champion_group'],)
    if target in ('queue', 'idle') and candidates:
        # Legacy Tavern embeds a separate League client scene. Hide that view
        # as before; desktop privacy now belongs to the central capture gate.
        updates = []
        group = settings['queue_group']
        if group in indexed and indexed[group].get('isGroup'):
            children = {i['sourceName']: i for i in client.get_group_scene_item_list(group).scene_items}
            for name in settings['hidden_queue_sources']:
                if name == 'DESKTOP 3D SCREEN':
                    continue
                if name not in children:
                    raise ValueError(f'OBS Tavern source is missing: {name}')
                updates.append(children[name])
        prepare_lobby(client, scene, candidates, exclusions=exclusions, hide_screen=True)
        for item in updates:
            if item['sceneItemEnabled']:
                client.set_scene_item_enabled(group, item['sceneItemId'], False)
        return
    for name in (settings['queue_group'], settings['champion_group']):
        if name not in indexed or not indexed[name].get('isGroup'):
            raise ValueError(f'OBS lobby group is missing: {name}')
    updates = []
    if target == 'queue':
        group = settings['queue_group']
        children = {i['sourceName']: i for i in client.get_group_scene_item_list(group).scene_items}
        for name in settings['hidden_queue_sources']:
            if name not in children:
                raise ValueError(f'OBS Tavern source is missing: {name}')
            updates.append((group, children[name], False))
    selected = settings['queue_group'] if target == 'queue' else settings['champion_group']
    for name in [settings['queue_group'], settings['champion_group'], *settings['other_lobby_groups'], *candidates]:
        if name in indexed:
            updates.append((scene, indexed[name], name == selected))
    for owner, item, enabled in updates:
        if item['sceneItemEnabled'] != enabled:
            client.set_scene_item_enabled(owner, item['sceneItemId'], enabled)


def apply_scene(client, settings, target, *, director=scene_director, automatic=True,
                expected_manual_revision=None):
    return director.request(destination(settings, target), owner='league_client',
                            reason=f'Client phase: {target}', automatic=automatic,
                            expected_manual_revision=expected_manual_revision,
                            client=client, prepare=lambda c: _prepare_scene(c, settings, target))


def replay_is_active(client):
    """Compatibility name: any temporary scene reservation suspends automation."""
    return (scene_director.snapshot()['temporary_owner'] is not None or
            client.get_current_program_scene().current_program_scene_name == 'InstantReplay')
