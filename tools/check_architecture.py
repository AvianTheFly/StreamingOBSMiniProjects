"""Check executable boundaries in the supported Hub, without importing features.

Run `py -3.11 tools/check_architecture.py`. These checks enforce ownership, not
arbitrary file-size limits. Keep standalone maintenance exceptions documented.
"""
from __future__ import annotations
import ast
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from lib.project_registry import SUPPORTED_RUNTIME_PROJECTS

SCENE_OWNER = 'lib/coordination/scenes.py'
CONNECTION_OWNERS = {
    'obs/client.py', 'obs/outputs.py', 'lib/coordination/scene_events.py',
    'lib/performance_monitor.py',
    # Standalone user-invoked maintenance; never part of Hub startup.
    'mini projects/specific_song/full_sync.py',
}


# Explicit composition adapters may import only the feature they expose.
FEATURE_ADAPTERS = {
    'hub_ui/routes/spirit_lobby.py': 'spirit_lobby',  # Public lobby display library; feature owns assets/persistence.
    'hub_ui/routes/mood_cues.py': 'love_me',  # Public mood authoring/audio composition; feature owns playback.
    'hub_ui/routes/twitch_commands.py': 'twitch_commands',  # Public command editor composition.
    'hub_ui/routes/league_stats.py': 'league_stats',  # Public tracker API composition.
    'hub_ui/routes/starting_soon.py': 'starting_soon',
    'hub_ui/routes/songs.py': 'specific_song',
    'hub_ui/routes/scenes.py': 'scene_voice_switcher',
    'hub_ui/routes/sound_effects.py': 'sound_effects',
    'hub_ui/routes/replay.py': 'instant_replay',
    'hub_ui/replay_trim.py': 'instant_replay',  # Legacy public facade.
}

def application_files(root=ROOT):
    for name in ('hub.py', 'main.py', 'coordinator.py', 'shared.py', 'events.py',
                 'hub_actions.py', 'hub_rules.py', 'hub_config.py'):
        yield root / name
    for folder in ('lib', 'obs', 'voice', 'hub_ui', 'footage_manager', 'spirit_lobby'):
        yield from (root / folder).rglob('*.py')
    for project in sorted(SUPPORTED_RUNTIME_PROJECTS):
        yield from (root / 'mini projects' / project).rglob('*.py')


def inspect_source(source, relative):
    errors = []
    tree = ast.parse(source, filename=relative)
    parts = Path(relative).parts
    feature = parts[1] if parts[0] == 'mini projects' else None
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported = [alias.name.split('.')[0] for alias in node.names]
        elif isinstance(node, ast.ImportFrom) and node.level == 0:
            imported = [(node.module or '').split('.')[0]]
        else:
            imported = []
        for name in imported:
            if name in SUPPORTED_RUNTIME_PROJECTS and name != feature and FEATURE_ADAPTERS.get(relative) != name:
                errors.append((node.lineno, f'Importing feature {name!r}; use an interface, event, or shared contract'))
        if (relative.startswith('hub_ui/') and isinstance(node, ast.ImportFrom)
                and any(alias.name == '_live' for alias in node.names)):
            errors.append((node.lineno, 'HTTP adapters must use public feature APIs, not private live state'))
        if not isinstance(node, ast.Call):
            continue
        action = node.func.attr if isinstance(node.func, ast.Attribute) else None
        if action == 'set_current_program_scene' and relative != SCENE_OWNER:
            errors.append((node.lineno, 'Program-scene writes belong to SceneDirector'))
        if action == 'send' and any(isinstance(v, ast.Constant) and v.value == 'SetCurrentProgramScene'
                                    for v in node.args):
            errors.append((node.lineno, 'Raw program-scene writes bypass SceneDirector'))
        if action in {'ReqClient', 'EventClient'} and relative not in CONNECTION_OWNERS:
            errors.append((node.lineno, 'OBS connections belong to shared transport/lifecycle owners'))
        if action in {'pause_all', 'resume_all'}:
            errors.append((node.lineno, 'Use a scoped pause claim; bulk pause/resume loses ownership'))
        if action in {'request_to_play', 'announce_finished'} and relative != 'lib/coordination/playback.py':
            errors.append((node.lineno, 'Use PlaybackTicket completion rather than a project name'))
    return errors


def check(root=ROOT):
    errors, checked = [], 0
    for path in application_files(root):
        if path.name.startswith('test_') or 'tools' in path.relative_to(root).parts:
            continue
        relative = path.relative_to(root).as_posix()
        checked += 1
        try:
            errors.extend(f'{relative}:{line}: {message}' for line, message in
                          inspect_source(path.read_text(encoding='utf-8-sig'), relative))
        except SyntaxError as exc:
            errors.append(f'{relative}:{exc.lineno}: {exc.msg}')
    return checked, errors


if __name__ == '__main__':
    checked, errors = check()
    for error in errors:
        print(error)
    print(f'Architecture: {checked} modules checked, {len(errors)} violations')
    raise SystemExit(bool(errors))
