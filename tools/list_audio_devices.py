# list_audio_devices.py
# Lists all audio input/output devices detected by sounddevice.
#
#   python list_audio_devices.py
#
# Useful for diagnosing audio routing or finding a specific device index.

import sounddevice as sd

print(f"\n{'IDX':>4}  {'NAME':<45}  {'IN':>4}  {'OUT':>4}  SAMPLERATE")
print("-" * 75)
for i, dev in enumerate(sd.query_devices()):
    print(
        f"{i:>4}  {dev['name']:<45}  "
        f"{dev['max_input_channels']:>4}  "
        f"{dev['max_output_channels']:>4}  "
        f"{int(dev['default_samplerate'])}"
    )
print()
