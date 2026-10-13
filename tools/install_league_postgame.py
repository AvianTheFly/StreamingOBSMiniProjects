"""Standalone composition: attach recap to the user's existing idle destination."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


if __name__ == '__main__':
    from lib.paths import ensure_import_paths, load_project_env, PROJECT_ROOT
    ensure_import_paths()
    load_project_env()
    from league_stats.obs_presentation import install
    from league_api.scene_routing import destination
    import obs
    settings=json.loads((PROJECT_ROOT/'mini projects/league_api/client_scenes.json').read_text(encoding='utf-8'))
    client=obs.get_obs()
    before=client.get_current_program_scene().current_program_scene_name
    result=install(client,destination(settings,'idle'))
    after=client.get_current_program_scene().current_program_scene_name
    print(json.dumps(dict(**result,scene_before=before,scene_after=after)))
