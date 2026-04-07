"""
discover_from_existing.py
=========================
Dumps raw filter response to understand the API format.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from obs.client import get_obs
from obs.obs_config import OBS_HOST, OBS_PORT, OBS_PASSWORD

TRIANGLES = ["BearTriangle", "TurtleTriangle", "RamTriangle", "PhoenixTriangle"]


def main():
    try:
        client = get_obs()
        print("Connected to OBS")
    except Exception as e:
        print(f"ERROR: {e}")
        return

    for tri in TRIANGLES:
        print(f"\n=== {tri} ===")
        try:
            resp = client.get_source_filter_list(tri)
            print(f"  Response type: {type(resp)}")
            print(f"  Response dir: {[a for a in dir(resp) if not a.startswith('_')]}")

            # Try filters attribute
            if hasattr(resp, "filters"):
                filters = resp.filters
                print(f"  filters: {filters}")
                print(f"  filters type: {type(filters)}")

                if filters:
                    for i, f in enumerate(filters):
                        print(f"\n  Filter #{i}:")
                        print(f"    type: {type(f)}")
                        print(f"    dir: {[a for a in dir(f) if not a.startswith('_')]}")

                        # If it's a dataclass-like object
                        for attr in dir(f):
                            if attr.startswith("_"):
                                continue
                            try:
                                val = getattr(f, attr)
                                if not callable(val):
                                    print(f"    {attr} = {val}")
                            except Exception:
                                pass

                else:
                    print("  (no filters)")
            else:
                # Print all attributes
                for attr in dir(resp):
                    if attr.startswith("_"):
                        continue
                    try:
                        val = getattr(resp, attr)
                        if not callable(val):
                            print(f"  {attr} = {val}")
                    except Exception:
                        pass

        except Exception as e:
            import traceback
            print(f"  ERROR: {e}")
            traceback.print_exc()


if __name__ == "__main__":
    main()
