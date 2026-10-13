"""Finite, additive installation of the League stage presentation."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

if __name__ == '__main__':
    from lib.paths import ensure_import_paths, load_project_env
    ensure_import_paths()
    load_project_env()
    import obs
    from league_api.stage_obs import install
    print(install(obs.get_obs(), Path(__file__).resolve().parents[1]/'mini projects/league_api/client_scenes.json'))
