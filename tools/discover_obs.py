"""
discover_obs.py
===============
Standalone diagnostic — connects to your OBS instance and prints a full
inventory of every scene, group, source, and filter.

Usage:
    python discover_obs.py

No other hub scripts need to be running.
"""

from __future__ import annotations

import sys
from pathlib import Path

# ── Resolve the obs package from the project root ──────────────────────────
ROOT = Path(__file__).resolve().parents[1]          # …/Streaming Scripts v2
sys.path.insert(0, str(ROOT))

from obs.client import get_obs

SEPARATOR = "=" * 72


def _pretty(v, indent=0):
    pad = " " * indent
    if isinstance(v, dict):
        lines = []
        for k, sub in v.items():
            lines.append(f"{pad}{k}: {_pretty(sub, indent + 2)}")
        return "\n".join(lines)
    if isinstance(v, (list, tuple)):
        elements = ", ".join(_pretty(x) for x in v)
        return f"[{elements}]"
    return repr(v) if isinstance(v, str) else str(v)


def main():
    try:
        client = get_obs()
    except RuntimeError as e:
        print(f"[ERROR] {e}")
        sys.exit(1)

    # ── Scenes ─────────────────────────────────────────────────────────────
    scenes_resp = client.get_scene_list()
    scenes = [s["sceneName"] for s in scenes_resp.scenes]

    print(SEPARATOR)
    print(f"  OBS INVENTORY  —  {len(scenes)} scene(s)")
    print(SEPARATOR)

    for scene_name in scenes:
        print(f"\n{'─' * 50}")
        print(f"📁 SCENE: {scene_name}")
        print(f"{'─' * 50}")

        # ── Sources in scene ───────────────────────────────────────────
        items_resp = client.get_scene_item_list(scene_name)
        items = items_resp.scene_items

        if not items:
            print("  (no sources)")
            continue

        for item in items:
            item_id = item["sceneItemId"]
            src_name = item["sourceName"]
            src_kind = item.get("inputKind", item.get("sourceType", "?"))
            enabled = item.get("sceneItemEnabled", True)
            locked = item.get("isGroup", False)
            blend_mode = item.get("blendMode", "OBS_BLEND_NORMAL")

            status = "VISIBLE" if enabled else "hidden"
            marker = " 🔒" if locked else ""

            # Transform
            tx = item.get("sceneItemTransform", {})
            pos = tx.get("positionX", "?"), tx.get("positionY", "?")
            scl = tx.get("scaleX", "?"), tx.get("scaleY", "?")

            print(f"\n  └─ 🔹 {src_name}")
            print(f"       ID: {item_id}  |  Kind: {src_kind}")
            print(f"       Status: {status}{marker}")
            print(f"       Pos: {pos}  |  Scale: {scl}")
            print(f"       Blend: {blend_mode}")

            # ── Filters on this source ───────────────────────────────
            try:
                filters_resp = client.get_source_filter_list(src_name)
                filters = filters_resp.filters
            except Exception:
                filters = []

            if filters:
                print(f"       Filters ({len(filters)}):")
                for f in filters:
                    f_name = f.get("name", "?")
                    f_kind = f.get("kind", "?")
                    f_en = f.get("enabled", False)
                    print(f"         ✦ {f_name} [{f_kind}] {'ON' if f_en else 'OFF'}")
            else:
                print(f"       Filters: (none)")

            # ── If it's a group, recurse into its children ───────────
            if item.get("isGroup", False):
                try:
                    group_items = client.get_group_scene_item_list(
                        src_name
                    ).scene_items
                    if group_items:
                        print(f"       Group children ({len(group_items)}):")
                        for gi in group_items:
                            print(
                                f"         └─ {gi['sourceName']} "
                                f"({gi.get('inputKind', '?')})"
                            )
                except Exception:
                    pass

    # ── Raw inputs (things not tied to a specific scene) ───────────────────
    print(f"\n{'─' * 50}")
    print("ALL INPUTS (cross-scene)")
    print(f"{'─' * 50}")

    try:
        inputs_resp = client.get_input_list()
        inputs = inputs_resp.inputs  # may be list of dicts
        input_names = []
        for i in inputs:
            if isinstance(i, dict):
                input_names.append(i["inputName"])
            else:
                name = getattr(i, "input_name", None)
                if name:
                    input_names.append(name)
        for name in sorted(input_names):
            print(f"  • {name}")
    except Exception as e:
        print(f"  Could not fetch inputs: {e}")

    print(f"\n{SEPARATOR}")
    print("Done.")


if __name__ == "__main__":
    main()
