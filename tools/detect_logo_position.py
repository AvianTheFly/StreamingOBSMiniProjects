"""
detect_logo_position.py
=======================
Reads the current position, scale, and 3D Block filter settings of a named
source in a given OBS scene and writes them to a JSON config file.

Usage:
    python tools/detect_logo_position.py
    python tools/detect_logo_position.py --scene MyScene --source MyLogo
    python tools/detect_logo_position.py --output tools/my_logo_config.json
"""

import json
import sys
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from obs.client import get_obs

DEFAULT_SCENE   = "InstantReplay"
DEFAULT_SOURCE  = "InstantReplayLogo"
DEFAULT_OUTPUT  = str(ROOT / "tools" / "logo_config.json")
FILTER_NAME     = "3D Block"


def main():
    p = argparse.ArgumentParser(description="Detect logo position + 3D Block filter settings")
    p.add_argument("--scene", default=DEFAULT_SCENE, help=f"Scene name (default: {DEFAULT_SCENE})")
    p.add_argument("--source", default=DEFAULT_SOURCE, help=f"Source name (default: {DEFAULT_SOURCE})")
    p.add_argument("--output", default=DEFAULT_OUTPUT, help="Output JSON path")
    args = p.parse_args()

    try:
        client = get_obs()
        client.get_version()
    except RuntimeError as e:
        print(f"[ERROR] {e}")
        sys.exit(1)

    # ── Get scene item transform ──────────────────────────────────────────
    scene_items = client.get_scene_item_list(args.scene)
    found = None
    for item in scene_items.scene_items:
        if item.get("sourceName") == args.source:
            found = item
            break

    if found is None:
        print(f"[ERROR] '{args.source}' not found in scene '{args.scene}'")
        sys.exit(1)

    st = found.get("sceneItemTransform", {})
    position = st.get("positionX", 0), st.get("positionY", 0)
    scale    = st.get("scaleX", 1.0), st.get("scaleY", 1.0)
    rotation = st.get("rotation", 0)
    print(f"Position : x={position[0]:.0f}  y={position[1]:.0f}")
    print(f"Scale    : x={scale[0]:.4f}  y={scale[1]:.4f}")
    print(f"Rotation : {rotation:.1f}")

    # ── Get 3D Block filter settings ──────────────────────────────────────
    filters = client.get_source_filter_list(args.source)
    filter_settings = None
    for f in filters.filters:
        if f.get("filterName") == FILTER_NAME:
            filter_settings = f.get("filterSettings", {})
            break

    if filter_settings is None:
        print(f"[WARN] '{FILTER_NAME}' filter not found on '{args.source}'")
        print("  Saving position/scale without filter settings.")
        filter_settings = {}
    else:
        print(f"\n{FILTER_NAME} filter settings:")
        for k, v in sorted(filter_settings.items()):
            print(f"  {k}: {v}")

    # ── Write JSON ────────────────────────────────────────────────────────
    config = {
        "scene": args.scene,
        "source": args.source,
        "positionX": st.get("positionX", 0),
        "positionY": st.get("positionY", 0),
        "scaleX": st.get("scaleX", 1.0),
        "scaleY": st.get("scaleY", 1.0),
        "rotation": st.get("rotation", 0),
        "filter_3d_block": filter_settings,
    }

    with open(args.output, "w") as f:
        json.dump(config, f, indent=4)

    print(f"\nSaved to {args.output}")


if __name__ == "__main__":
    main()
