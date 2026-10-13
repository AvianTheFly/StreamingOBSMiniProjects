"""Finite additive queue-display installation; never writes the program scene."""
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from lib.paths import ensure_import_paths, load_project_env
ensure_import_paths()
load_project_env()


def install():
    from obs import get_obs
    from lib.settings_backups import SettingsBackups
    from lib.json_store import update_json
    from scene_voice_switcher import settings
    from scene_voice_switcher.screen_content import SOURCES, ORIGINAL_UDYR, blueprint, choice, install as attach
    from lib.display_capture import apply_content
    client = get_obs()
    if client.get_stream_status().output_active:
        raise ValueError('Install the lobby display while off-stream')
    scene = client.get_current_program_scene().current_program_scene_name
    originals = [ORIGINAL_UDYR, *(name for key, name in SOURCES.items() if key != 'udyr')]
    before = {name: client.get_input_settings(name).input_settings for name in originals}
    SettingsBackups().snapshot()
    attach(client)
    def merge(data):
        choice(data)
        return {**data, 'screen_content': 'udyr'}
    saved = update_json(settings.PATH, merge, default={})
    apply_content(blueprint(saved), client=client)
    after = {name: client.get_input_settings(name).input_settings for name in originals}
    if before != after:
        raise RuntimeError('Original input settings changed during installation')
    if client.get_current_program_scene().current_program_scene_name != scene:
        raise RuntimeError('Program scene changed during installation')
    return {'scene_unchanged': scene, 'default': 'udyr', 'original_settings_preserved': True}


if __name__ == '__main__':
    print(json.dumps(install()))
