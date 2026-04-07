# list_audio_devices.py
# Run this once from the hub root to find your VB-Cable device index.
#
#   python list_audio_devices.py
#
# Look for a device with "CABLE Output" in the name — that's the one.
# Copy its index number into specific_song/config.py as BASS_DEVICE_INDEX.

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
print("Look for 'CABLE Output (VB-Audio Virtual Cable)' with IN > 0.")
print("Use that index as BASS_DEVICE_INDEX in specific_song/config.py.")