"""Repair the custom champion-select OBS scene in the current OBS collection."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths, load_project_env

load_project_env()
ensure_import_paths()

import obs
from league_api.champ_select_obs import install


if __name__ == '__main__':
    print(install(obs.get_obs()))
