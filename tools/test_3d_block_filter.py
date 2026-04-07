"""
test_3d_block_filter.py
========================
Live test — constantly cycles 3D Block filter values on triangle sources
so you can verify programmatic control from within this terminal.

Press Ctrl+C to stop.
"""

import sys
import time
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from obs.client import get_obs

TRIANGLES = ["BearTriangle", "TurtleTriangle", "RamTriangle", "PhoenixTriangle"]
FILTER_NAME = "3D Block"

CYCLE_SECONDS = 10  # how long each value phase lasts


def main():
    try:
        client = get_obs()
        client.get_version()
    except RuntimeError as e:
        print(f"[ERROR] Cannot connect to OBS: {e}")
        sys.exit(1)

    print(f"[OBS] Connected. Cycling filter values…")
    print("Press Ctrl+C to stop.\n", flush=True)

    def dump():
        for tri in TRIANGLES:
            try:
                filters = client.get_source_filter_list(tri)
                for f in filters.filters:
                    if f.get("filterName") == FILTER_NAME:
                        s = f.get("filterSettings", {})
                        print(f"  {tri}: {s}")
                        break
            except Exception as e:
                print(f"  {tri}: error — {e}")

    t0 = time.time()

    while True:
        elapsed = time.time() - t0

        # Cycle through different parameters to showcase
        scale = 60 + 80 * (0.5 + 0.5 * math.sin(elapsed * 0.5))
        tilt_x = 60 * math.sin(elapsed * 0.7)
        tilt_y = 60 * math.cos(elapsed * 0.7)
        tilt_z = 45 * math.sin(elapsed * 0.3)
        wiggle = int(5 + 25 * (0.5 + 0.5 * math.sin(elapsed * 0.6)))
        thickness = int(10 + 60 * (0.5 + 0.5 * math.cos(elapsed * 0.4)))
        light_angle = int(360 * (0.5 + 0.5 * math.sin(elapsed * 0.2)))
        wx = 50 * math.sin(elapsed * 0.9)
        wy = 50 * math.cos(elapsed * 0.9)

        settings = {
            "scale": scale,
            "tilt_x_deg": tilt_x,
            "tilt_y_deg": tilt_y,
            "tilt_z_deg": tilt_z,
            "wiggle": wiggle,
            "wiggle_rot": int(elapsed // CYCLE_SECONDS) % 2 == 0,
            "thickness": thickness,
            "light_position": light_angle,
            "pos_x_percent": wx,
            "pos_y_percent": wy,
        }

        label = f"t={elapsed:.0f}s  scale={scale:.0f}  tilt=({tilt_x:.0f},{tilt_y:.0f},{tilt_z:.0f})  wiggle={wiggle}  thick={thickness}  light={light_angle}°  pos=({wx:.0f},{wy:.0f})  rot={'ON' if settings['wiggle_rot'] else 'OFF'}"

        ok = 0
        for tri in TRIANGLES:
            try:
                client.set_source_filter_settings(tri, FILTER_NAME, settings)
                ok += 1
            except Exception as e:
                print(f"  ERROR {tri}: {e}")

        print(f"[{ok}/{len(TRIANGLES)}] {label}", flush=True)

        time.sleep(0.5)


if __name__ == "__main__":
    main()
