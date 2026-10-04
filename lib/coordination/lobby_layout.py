"""Apply published OBS layer data; feature owners supply layout and source policy."""
from lib.settings_backups import SettingsBackups

def transform_matches(actual, desired):
    for key,value in desired.items():
        current=actual.get(key)
        if isinstance(value,(int,float)) and not isinstance(value,bool):
            if not isinstance(current,(int,float)) or abs(current-value)>.01:
                return False
        elif current != value:
            return False
    return True


def apply_layout(client, scene, plan):
    """Repair only named layers, idempotently, without editing nested inputs/filters.

    Resolve dependencies before mutation. Snapshot before the first repair. Unknown
    items retain their relative order; named layers remain below personal overlays.
    """
    rows = client.get_scene_item_list(scene).scene_items
    indexed = {row['sourceName']: row for row in rows}
    layers = plan['layers']
    missing = [layer for layer in layers if layer['source'] not in indexed]
    if missing:
        available = {row['inputName'] for row in client.get_input_list().inputs}
        available.update(row['sceneName'] for row in client.get_scene_list().scenes)
        for layer in missing:
            if layer['source'] not in available and not layer.get('kind'):
                raise ValueError('Missing lobby source: ' + layer['source'])
    saved = False

    def before_write():
        nonlocal saved
        if not saved:
            SettingsBackups().snapshot()
            saved = True

    for layer in missing:
        before_write()
        source = layer['source']
        identifier = (client.create_scene_item(scene, source, True).scene_item_id
                      if source in available else client.create_input(
                          scene, source, layer['kind'], layer.get('settings', {}), True).scene_item_id)
        indexed[source] = {'sceneItemId': identifier, 'sceneItemEnabled': True}
    for layer in layers:
        source = layer['source']; row = indexed[source]; identifier = row['sceneItemId']
        if layer.get('configure') and layer.get('settings'):
            current = client.get_input_settings(source).input_settings
            changes = {key: value for key, value in layer['settings'].items() if current.get(key) != value}
            if changes:
                before_write(); client.set_input_settings(source, changes, True)
        transform = row.get('sceneItemTransform', {})
        if not transform_matches(transform,layer['transform']):
            before_write(); client.set_scene_item_transform(scene, identifier, layer['transform'])
        if not row.get('sceneItemEnabled'):
            before_write(); client.set_scene_item_enabled(scene, identifier, True)
        if not row.get('sceneItemLocked'):
            before_write(); client.set_scene_item_locked(scene, identifier, True)
    for source in plan.get('hide', ()):
        row = indexed.get(source)
        if row and row['sceneItemEnabled']:
            before_write(); client.set_scene_item_enabled(scene, row['sceneItemId'], False)
    # Move only owned layers when their relative stacking is incorrect.
    ordered = [row['sourceName'] for row in client.get_scene_item_list(scene).scene_items]
    expected = [layer['source'] for layer in layers]
    if [name for name in ordered if name in expected] != expected:
        for index, source in enumerate(expected):
            before_write(); client.set_scene_item_index(scene, indexed[source]['sceneItemId'], index)
    return saved
