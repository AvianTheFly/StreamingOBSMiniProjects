"""Standalone additive installation of native channel presentation images.

Uses the existing OBS transport and snapshots settings. Existing scenes/items,
input settings, filters, transforms, faders and program selection are preserved.
No Hub service, thread, browser channel, hook, decoder or playback worker is added.
"""
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

CARDS = (
    ('Spirit Welcome', 'Hub Spirit Welcome Card', 'welcome.png'),
    ('Spirit Intermission', 'Hub Spirit Intermission Card', 'intermission.png'),
    ('Spirit Signoff', 'Hub Spirit Signoff Card', 'ending.png'),
    ('Bot Lane Court', 'Hub Bot Lane Court Card', 'court.png'),
    ('Court - Genius', 'Hub Court Genius Card', 'court-genius.png'),
    ('Court - Inting', 'Hub Court Inting Card', 'court-inting.png'),
)


def install(client, assets):
    """Only create missing resources; a rerun never resets a personalized item."""
    assets = Path(assets).resolve()
    for _, _, filename in CARDS:
        if not (assets / filename).is_file():
            raise FileNotFoundError(assets / filename)
    if client.get_stream_status().output_active or client.get_record_status().output_active:
        raise RuntimeError('Install these new scenes when streaming and recording are stopped.')
    canvas = client.get_video_settings()
    scenes = {s['sceneName'] for s in client.get_scene_list().scenes}
    inputs = {i['inputName']: i['inputKind'] for i in client.get_input_list().inputs}
    # Check every name before making the first change.
    for _, source, _ in CARDS:
        if source in scenes or (source in inputs and inputs[source] != 'image_source'):
            raise ValueError(f'{source!r} already belongs to a different resource.')
    result = []
    for scene, source, filename in CARDS:
        if scene in inputs:
            raise ValueError(f'{scene!r} already belongs to an input.')
    for scene, source, filename in CARDS:
        new_scene = scene not in scenes
        if scene not in scenes:
            client.create_scene(scene)
            scenes.add(scene)
        # Existing clean recording capture remains owned by its original scene.
        # Reuse its scene only in newly created cards; never reset audio settings
        # or replace a user's later decision to remove/disable that reference.
        if new_scene and 'Recording Audio - No Music' in scenes:
            client.create_scene_item(scene, 'Recording Audio - No Music', True)
        rows = client.get_scene_item_list(scene).scene_items
        existing = next((r for r in rows if r['sourceName'] == source), None)
        if existing is not None:
            result.append({'scene': scene, 'source': source, 'created': False})
            continue
        if source in inputs:
            item_id = client.create_scene_item(scene, source, True).scene_item_id
        else:
            item_id = client.create_input(scene, source, 'image_source',
                {'file': (assets / filename).as_posix(), 'unload': True}, True).scene_item_id
            inputs[source] = 'image_source'
        client.set_scene_item_transform(scene, item_id, {
            'positionX': 0, 'positionY': 0, 'alignment': 5,
            'boundsType': 'OBS_BOUNDS_SCALE_INNER', 'boundsAlignment': 0,
            'boundsWidth': canvas.base_width, 'boundsHeight': canvas.base_height,
        })
        client.set_scene_item_locked(scene, item_id, True)
        result.append({'scene': scene, 'source': source, 'created': True})
    return result


def main():
    from lib.paths import load_project_env
    from lib.settings_backups import SettingsBackups
    load_project_env()
    import obs
    client = obs.get_obs()
    SettingsBackups().snapshot()
    result = install(client, ROOT / 'stream_brand' / 'exports')
    print(json.dumps({'installed': result, 'program_scene_changed_by_installer': False}))


if __name__ == '__main__':
    main()
