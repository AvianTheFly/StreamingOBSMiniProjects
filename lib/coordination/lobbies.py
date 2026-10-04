"""Published lobby inventory and OBS-only preparation inside scene transactions.

Features publish complete candidate snapshots. Consumers never import another
feature or invoke its callbacks while the scene director holds its lock.
"""
import random
import threading
from copy import deepcopy


class LobbyCatalog:
    def __init__(self):
        self._lock = threading.Lock()
        self.presentation_lock = threading.RLock()
        self._owners = {}
        self._layouts = {}

    def publish(self, owner, scene, sources, *, exclusions=(), layouts=None):
        with self.presentation_lock, self._lock:
            self._owners[owner] = (scene, tuple(sources), tuple(exclusions))
            self._layouts[owner] = deepcopy(layouts or {})

    def unregister(self, owner):
        with self.presentation_lock, self._lock:
            self._owners.pop(owner, None)
            self._layouts.pop(owner, None)

    def layout(self, location):
        with self._lock:
            return next((deepcopy(plans[location]) for plans in self._layouts.values()
                         if location in plans), None)

    def snapshot(self, scene):
        with self._lock:
            rows = [r for r in self._owners.values() if r[0] == scene]
        return (tuple(dict.fromkeys(n for _, names, _ in rows for n in names)),
                tuple(dict.fromkeys(n for _, _, names in rows for n in names)))


def prepare_lobby(client, scene, candidates, *, selected=None, exclusions=(),
                  chooser=random.choice, hide_screen=False):
    with lobby_catalog.presentation_lock:
        return _prepare_lobby(client, scene, candidates, selected=selected,
                              exclusions=exclusions, chooser=chooser, hide_screen=hide_screen)


def _prepare_lobby(client, scene, candidates, *, selected=None, exclusions=(),
                   chooser=random.choice, hide_screen=False):
    """Validate first, then select one location without touching unrelated overlays.

Call only from SceneDirector.request(prepare=...). A rejected/deferred request
does not choose a location or mutate visibility. Automatic entries avoid the
currently visible location; retries with an active lobby are handled by caller.
"""
    indexed = {i['sourceName']: i for i in client.get_scene_item_list(scene).scene_items}
    available = [n for n in candidates if n in indexed]
    if selected is not None and selected not in available:
        raise ValueError(f'OBS lobby is missing: {selected}')
    if not available:
        raise ValueError(f'No available OBS lobbies in {scene}')
    if selected is None:
        choices = [n for n in available if not indexed[n]['sceneItemEnabled']]
        selected = chooser(choices or available)
    plan = lobby_catalog.layout(selected)
    if plan:
        from .lobby_layout import apply_layout, transform_matches
        apply_layout(client, selected, plan)
        row = indexed[selected]
        desired = plan.get('link_transform', {})
        if not transform_matches(row.get('sceneItemTransform', {}),desired):
            from lib.settings_backups import SettingsBackups
            SettingsBackups().snapshot()
            client.set_scene_item_transform(scene, row['sceneItemId'], desired)
    updates = [(indexed[n], n == selected) for n in (*available, *exclusions) if n in indexed]
    if hide_screen:
        from lib.display_capture import set_visible
        set_visible(False, client=client)
    for item, enabled in updates:
        if item['sceneItemEnabled'] != enabled:
            client.set_scene_item_enabled(scene, item['sceneItemId'], enabled)
    return selected


def prepare_presented_lobby(client, scene):
    with lobby_catalog.presentation_lock:
        return _prepare_presented_lobby(client, scene)


def _prepare_presented_lobby(client, scene):
    """Prepare a direct scene or the currently selected published lobby."""
    plan = lobby_catalog.layout(scene)
    if plan:
        from .lobby_layout import apply_layout
        apply_layout(client, scene, plan)
        return
    candidates, exclusions = lobby_catalog.snapshot(scene)
    if not candidates:
        return
    rows = client.get_scene_item_list(scene).scene_items
    names = (*candidates, *(name for name in exclusions if lobby_catalog.layout(name)))
    selected = next((row['sourceName'] for row in rows
                     if row['sourceName'] in names and row['sceneItemEnabled']), None)
    prepare_lobby(client, scene, names, selected=selected,
                  exclusions=exclusions if selected is None else tuple(n for n in exclusions if n != selected))


lobby_catalog = LobbyCatalog()
