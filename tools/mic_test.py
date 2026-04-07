"""
mic_test.py
===========
Run this directly to diagnose microphone issues:
  python mic_test.py

It will:
1. List all available audio input devices
2. Try to record 3 seconds from each viable device
3. Report RMS levels so you can see which one is actually picking up audio
"""

import time
import numpy as np

try:
    import sounddevice as sd
except ImportError:
    print("sounddevice not installed — run: pip install sounddevice")
    raise SystemExit

SAMPLE_RATE   = 16_000
CHUNK_SAMPLES = 512
RECORD_SECS   = 3

print("=" * 60)
print("  Available input devices")
print("=" * 60)

devices = sd.query_devices()
input_devices = []

for i, d in enumerate(devices):
    if d["max_input_channels"] > 0:
        marker = "  <-- default" if i == sd.default.device[0] else ""
        print(f"  [{i:2d}]  {d['name']}{marker}")
        print(f"         channels={d['max_input_channels']}  "
              f"default_samplerate={d['default_samplerate']:.0f}")
        input_devices.append(i)

print()
print(f"  sounddevice default input : {sd.default.device[0]}")
print(f"  sounddevice default output: {sd.default.device[1]}")
print()

def test_device(device_idx):
    d = devices[device_idx]
    name = d["name"]
    native_rate = int(d["default_samplerate"])

    # Try 16kHz first (Whisper requirement), fall back to native rate
    for rate in ([16_000] if native_rate == 16_000 else [16_000, native_rate]):
        chunks = []
        ok = True
        try:
            def cb(indata, frames, t, status):
                chunks.append(indata[:, 0].copy())

            with sd.InputStream(
                device=device_idx,
                samplerate=rate,
                channels=1,
                dtype="float32",
                blocksize=CHUNK_SAMPLES,
                callback=cb,
            ):
                print(f"  Recording {RECORD_SECS}s from [{device_idx}] {name!r} "
                      f"@ {rate} Hz ... speak now!")
                time.sleep(RECORD_SECS)

        except Exception as e:
            print(f"    ERROR at {rate} Hz: {e}")
            ok = False

        if ok and chunks:
            audio = np.concatenate(chunks)
            rms   = float(np.sqrt(np.mean(audio ** 2)))
            peak  = float(np.max(np.abs(audio)))
            print(f"    rate={rate}  chunks={len(chunks)}  RMS={rms:.5f}  peak={peak:.5f}")
            if rms > 0.001:
                print(f"    ✅  Audio detected at {rate} Hz!")
            else:
                print(f"    ⚠️   Silence / very quiet at {rate} Hz")
            return rate, rms

    return None, 0.0


print("=" * 60)
print("  Testing default device first")
print("=" * 60)
default_idx = sd.default.device[0]
if default_idx >= 0:
    rate, rms = test_device(default_idx)
    if rms > 0.001:
        print()
        print(f"  Default device [{default_idx}] works fine at {rate} Hz.")
        print(f"  Set MIC_DEVICE = {default_idx} and MIC_SAMPLE_RATE = {rate} in hub_config.py")
        raise SystemExit

print()
print("  Default device silent — testing all input devices...")
print()

best_idx, best_rms, best_rate = -1, 0.0, 16_000
for idx in input_devices:
    if idx == default_idx:
        continue
    rate, rms = test_device(idx)
    print()
    if rms > best_rms:
        best_rms, best_idx, best_rate = rms, idx, rate

if best_idx >= 0 and best_rms > 0.001:
    print("=" * 60)
    print(f"  Best device: [{best_idx}] {devices[best_idx]['name']!r}")
    print(f"  Add these to hub_config.py:")
    print(f"    MIC_DEVICE      = {best_idx}")
    print(f"    MIC_SAMPLE_RATE = {best_rate}")
    print("=" * 60)
else:
    print("=" * 60)
    print("  No device returned audio above silence threshold.")
    print("  Check that your mic is not muted in Windows Sound settings.")
    print("=" * 60)
