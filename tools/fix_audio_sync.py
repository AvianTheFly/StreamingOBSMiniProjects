# tools/fix_audio_sync.py
# Fixes desktop audio sync issue caused by VB-Cable / instant_replay audio routing.
# Run from hub directory: python tools/fix_audio_sync.py

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import obsws_python as obs
from obs.obs_config import OBS_HOST, OBS_PORT, OBS_PASSWORD

client = obs.ReqClient(host=OBS_HOST, port=OBS_PORT, password=OBS_PASSWORD, timeout=10)


def get_audio_inputs():
    """Get all inputs that actually support audio."""
    resp = client.get_input_list()
    raw = getattr(resp, "inputs", [])
    names = []
    for item in raw:
        if isinstance(item, dict):
            names.append(item.get("inputName", str(item)))
        else:
            names.append(getattr(item, "input_name", str(item)))

    audio_inputs = []
    for name in names:
        try:
            client.send("GetInputAudioSyncOffset", {"inputName": name})
            audio_inputs.append(name)
        except Exception:
            pass
    return audio_inputs


print("[1] Finding audio inputs...")
audio_inputs = get_audio_inputs()
audio_inputs = [n for n in audio_inputs if n not in audio_inputs[:audio_inputs.index(n)]]
for name in audio_inputs:
    print(f"  - {name}")

print("\n[2] Checking + fixing sync offsets...")
for name in audio_inputs:
    try:
        r = client.send("GetInputAudioSyncOffset", {"inputName": name})
        offset = getattr(r, "inputAudioSyncOffset", 0)
        print(f"  {name}: {offset} ms", end=" ")
        if offset != 0:
            client.send("SetInputAudioSyncOffset", {
                "inputName": name,
                "inputAudioSyncOffset": 0,
            })
            print("-> RESET to 0 ms")
        else:
            print()
    except Exception as e:
        print(f"  {name}: error - {e}")

print("\n[3] Restoring volumes on Desktop Audio...")
for name in audio_inputs:
    if "desktop" in name.lower() or "speaker" in name.lower():
        try:
            r = client.get_input_volume(name)
            db = getattr(r, "input_volume_db", 0)
            mul = getattr(r, "input_volume_mul", 1.0)
            print(f"  {name}: currently {db:.1f} dB ({mul:.2f}x)", end=" -> ")
            client.set_input_volume(name, 1.0, None)  # 0 dB = 100%
            print("restored to 0 dB (100%)")
        except Exception as e:
            print(f"  {name}: failed - {e}")

print("\n[4] All volumes:")
for name in audio_inputs:
    try:
        r = client.get_input_volume(name)
        db = getattr(r, "input_volume_db", 0)
        mul = getattr(r, "input_volume_mul", 1.0)
        print(f"  {name}: {db:.1f} dB ({mul:.3f}x)")
    except Exception:
        pass

print("\n[5] Done.")
if not any("desktop" in n.lower() for n in audio_inputs):
    print("  WARNING: No 'Desktop Audio' input found. You may need to add one in OBS.")
