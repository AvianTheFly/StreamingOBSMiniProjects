# Native OBS playback

`spirit_transition.c` registers `hub_spirit_transition`; `playback.h` owns the
four-entry shuffled bag. The C source is GPL-2.0-or-later, and its audio mixing
and color-space integration follow the [OBS 32.1.1 stinger implementation](https://github.com/obsproject/obs-studio/blob/32.1.1/plugins/obs-transitions/transition-stinger.c).

Build with `py -3.11 tools/build_spirit_native.py` from the repository root.
The builder reads exports from the installed `obs.dll`; it does not change PATH
or install a compiler globally. Prerequisites under
`%LOCALAPPDATA%/StreamingHub/build-cache`:

- [OBS 32.1.1 source](https://github.com/obsproject/obs-studio/archive/refs/tags/32.1.1.zip), extracted as `obs-studio-32.1.1`.
- [Zig 0.16.0 Windows x86_64](https://ziglang.org/download/0.16.0/zig-x86_64-windows-0.16.0.zip), extracted as `zig-x86_64-windows-0.16.0`. Archive SHA256: `68659eb5f1e4eb1437a722f1dd889c5a322c9954607f5edcf337bc3684a75a7e`.

The ignored `build` directory contains generated headers, import library, test
executables and DLL. Install the DLL while OBS is closed at
`C:/ProgramData/obs-studio/plugins/hub-spirit-transition/bin/64bit/hub-spirit-transition.dll`.
The plugin also has a sibling `data` directory. Restart OBS, then use the parent
module's transactional installer to configure the active collection.

Each v4 transition instance creates eight private fixed-path media children. A
start stops any interrupted child, selects the next spirit, and restarts only
that child. Each spirit alternates two performances from a randomized initial
variant; old collections without `variant_count=2` retain four-file compatibility.
A stop releases its active-child reference and does nothing else.
There is deliberately no end timer and no media-path update callback. This
prevents tail-triggered phantom playback and repeated animals on rapid starts.

The properties callback exposes each spirit's bounded scene-cut control and
also makes OBS persist the configurable transition in scene collections.
`runtime_serial`, `runtime_spirit`, `runtime_clip`, and `runtime_playing` are diagnostic settings;
they do not drive playback and reset when the transition is recreated.

The scene render callback selects the old/new scene at the covered 4-second cut
and applies impact shake. Scene cuts use media playback position, which avoids
cutting early when decoding starts after the OBS transition clock. `clock.h`
atomically holds the greatest decoded position through natural media end; a
timestamp reset cannot select the old scene/audio during the tail. Playback
epochs reject late samples from an interrupted start. Negate dimensions only after casting to float;
negating unsigned widths moves the entire scene off-screen. Media alpha and
sRGB rendering must be preserved. Validate this with actual OBS screenshots,
not just the browser preview or decoded media.

For changes to the spirit set, update the media IDs, queue size, camera cues,
export/installer contracts and tests together. Media directory and duration are creation-time settings. Per-spirit cut values
update through Properties and are latched on the next start. Covered ranges and
cuts are authored per spirit in `web/timing.json` and installed from the manifest.
Do not re-enable the old Lua selector alongside the native module.
