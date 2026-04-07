"""
detect_positions.py
===================
Reads current position/scale of specific scene items in OBS and saves them
to a configurable JSON file. Run this manually whenever you move things
around in the OBS scene layout.

Usage:
    python tools/detect_positions.py
    python tools/detect_positions.py --scene MyOtherScene
    python tools/detect_positions.py --output tools/my_positions.json
"""

import json
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from obs.client import get_obs

# ── Which sources to detect ─────────────────────────────────────────────
# Edit this list to match whatever you want to track.
DEFAULT_SOURCES = [
    "BearTriangle",
    "TurtleTriangle",
    "RamTriangle",
    "PhoenixTriangle",
]

DEFAULT_SCENE = "LeagueGameAssets"
DEFAULT_OUTPUT = str(ROOT / "obs" / "positions.json")


def detect(scene: str, sources: list[str]) -> dict:
    """Read current positions from OBS and return a clean dict."""
    client = get_obs()
    result: dict[str, dict] = {}

    for name in sources:
        try:
            item = client.get_scene_item_list(scene)
            for entry in item.scene_items:
                if entry.get("sourceName") == name:
                    st = entry.get("sceneItemTransform", {})
                    result[name] = {
                        "positionX": st.get("positionX", 0),
                        "positionY": st.get("positionY", 0),
                        "scaleX": st.get("scaleX", 1.0),
                        "scaleY": st.get("scaleY", 1.0),
                    }
                    print(f"  Found {name}: x={result[name]['positionX']:.0f}  y={result[name]['positionY']:.0f}")
                    break
            else:
                print(f"  WARNING: {name} not found in scene '{scene}'")
        except Exception as e:
            print(f"  ERROR reading {name}: {e}")

    return result


def main():
    p = argparse.ArgumentParser(description="Detect source positions in OBS scene")
    p.add_argument("--scene", default=DEFAULT_SCENE, help=f"Scene name (default: {DEFAULT_SCENE})")
    p.add_argument("--sources", default=None, help="Comma-separated source names (default: all)")
    p.add_argument("--output", default=DEFAULT_OUTPUT, help="Output JSON path")
    args = p.parse_args()

    sources = args.sources.split(",") if args.sources else DEFAULT_SOURCES

    print(f"Connecting to OBS…")
    try:
        client = get_obs()
        client.get_version()
    except RuntimeError as e:
        print(f"[ERROR] {e}")
        sys.exit(1)

    print(f"\nDetecting positions in scene '{args.scene}'")
    data = detect(args.scene, sources)

    output = {
        "scene": args.scene,
        "sources": data,
    }

    with open(args.output, "w") as f:
        json.dump(output, f, indent=4)

    print(f"\nSaved to {args.output}")


if __name__ == "__main__":
    main()
