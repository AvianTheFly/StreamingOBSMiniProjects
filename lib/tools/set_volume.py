from __future__ import annotations

import argparse
import importlib
import sys
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from lib.paths import ensure_import_paths, load_project_env


def set_project_volume(project: str, db: float) -> None:
    ensure_import_paths()
    load_project_env()

    try:
        cfg_module = importlib.import_module(f"{project}.config")
    except ModuleNotFoundError:
        print(f"[set_volume] Project '{project}' not found under mini projects/")
        sys.exit(1)
    except Exception as exc:
        print(f"[set_volume] Could not import '{project}.config': {exc}")
        sys.exit(1)

    cfg = getattr(cfg_module, "CONFIG", None)
    if cfg is None:
        print(f"[set_volume] '{project}.config' has no CONFIG object.")
        sys.exit(1)

    from obs import list_sources, set_input_volume_db

    try:
        sources = list_sources(cfg.scene)
    except Exception as exc:
        print(f"[set_volume] Could not list sources in scene '{cfg.scene}': {exc}")
        sys.exit(1)

    targets = [name for name in sources if name.startswith(cfg.obs_source_prefix)]
    if not targets:
        print(
            f"[set_volume] No sources with prefix '{cfg.obs_source_prefix}' "
            f"found in scene '{cfg.scene}'."
        )
        return

    print(f"[set_volume] Setting {len(targets)} source(s) in '{cfg.scene}' to {db} dB...")
    ok = failed = 0
    for name in sorted(targets):
        try:
            set_input_volume_db(name, db)
            print(f"  OK    {name}")
            ok += 1
        except Exception as exc:
            print(f"  FAIL  {name}  ({exc})")
            failed += 1

    print(f"\n[set_volume] Done - {ok} updated, {failed} failed.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Set OBS volume for all sources in a mini project's scene.",
    )
    parser.add_argument("project", help="Mini-project folder name, e.g. soundboard")
    parser.add_argument("db", type=float, help="Target volume in dB, e.g. -20")
    args = parser.parse_args()

    set_project_volume(args.project, args.db)


if __name__ == "__main__":
    main()
