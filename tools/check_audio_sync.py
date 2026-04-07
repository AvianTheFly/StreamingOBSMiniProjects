# tools/check_audio_sync.py
# Checks the audio sync offset on every OBS input.
# Run from the hub directory:
#   python check_audio_sync.py
# Add --reset to set all offsets back to 0.

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import obsws_python as obs
from obs.obs_config import OBS_HOST, OBS_PORT, OBS_PASSWORD


def main():
    reset_mode = "--reset" in sys.argv

    client = obs.ReqClient(host=OBS_HOST, port=OBS_PORT, password=OBS_PASSWORD, timeout=10)

    resp = client.get_input_list()
    raw = getattr(resp, "inputs", [])

    # Extract just the names
    names = []
    for item in raw:
        if isinstance(item, dict):
            names.append(item.get("inputName", str(item)))
        else:
            names.append(getattr(item, "input_name", str(item)))

    print(f"Found {len(names)} inputs\n")

    for name in names:
        try:
            r = client.send("GetInputAudioSyncOffset", {"inputName": name})
            offset_ms = getattr(r, "inputAudioSyncOffset", None)
        except Exception as e:
            print(f"  [skip] {name!r} — {e}")
            continue

        status = "ok"
        if offset_ms and offset_ms != 0:
            status = "!! DELAYED !!" if abs(offset_ms) >= 500 else "non-zero"
        print(f"  {name!r}: {offset_ms or 0:>6} ms  ({status})")

        if reset_mode and offset_ms and offset_ms != 0:
            try:
                client.send("SetInputAudioSyncOffset", {
                    "inputName": name,
                    "inputAudioSyncOffset": 0,
                })
                print(f"    -> RESET to 0 ms")
            except Exception as e:
                print(f"    -> FAILED: {e}")


if __name__ == "__main__":
    main()
