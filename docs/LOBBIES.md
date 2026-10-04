# Lobby controls

Open the supported Hub at http://127.0.0.1:7420/#projects/scene_voice_switcher.
The gallery contains eleven authored worlds and the animated Spirit Afterparty.
Spirit Arcade and Aurora Camp extend the existing tavern, future lounge, forge,
sanctuary, harbor, coast, observatory, reef and railway worlds.

- **Enter lobby** selects that world and restores its saved camera, chat and
  screen placement. It keeps your current desktop visibility.
- **Enter + screen** also reveals your desktop inside that world's screen.
- **Another lobby** chooses another enabled location in your rotation.
- **Show screen / Hide screen** operate the existing shared desktop gate.
  The `*-` and `-*` shortcuts continue to work. Gameplay keeps its own capture.
- **Find a lobby** searches names and descriptions.
- **Include in automatic rotation** controls automatic and random selection.
  You can still enter a world manually when its rotation checkbox is off.
- **Manage placement** saves screen, camera and chat rectangles for that world.
  Use **Restore saved placement** to repair a disturbed arrangement.
- **Customize clubhouse displays** opens the existing Afterparty studio; its
  media selections, custom text and animations remain owned by that studio.

The Live desk's **Scenes** control offers the same labeled worlds. Press backtick
and say a name (including “arcade,” “aurora camp,” or “afterparty”), “next lobby,”
or “game.” Automatic between-game returns hide the desktop and respect newer
manual choices and temporary presentations. There is no timed auto-tour that
can unexpectedly reveal your desktop or interrupt your current presentation.

Camera and desktop items reuse **FaceCamWithProps** and **Hub Display Capture**.
They do not create another device capture or change your camera's own filters,
crop, keying, microphone or volume. The actual camera feed must be available in
your existing camera setup. Each chat browser follows your existing Twitch
channel and uses the native dimensions of that world's chat board; inactive
chat browsers shut down. Existing CSS and unrelated source settings survive.

Feature-owned layer plans are published as complete data. SceneDirector accepts
the scene intent before shared mechanics prepare the chosen location. Rejected,
stale and deferred requests make no layout or desktop writes. Direct Hub scene
choices prepare first; native OBS scene events repair the already chosen
location without making another program-scene write. A repair snapshots settings
and touches only named layers. Correct layouts require no repeated writes.

The standalone `tools/install_lobby_scenes.py` installer can add missing layers
without rerunning capture or hotkey migrations by calling `install_locations`.
It preserves installed placement on reruns. `presentation.restore` explicitly
applies the saved layout when a repair is requested. OBS collection history stays
outside the repository in StreamingHub/settings-history.

Artwork was generated with the built-in imagegen tool. Its original prompts and
asset names are in `mini projects/scene_voice_switcher/art/expansion-prompts.json`.
The new static worlds have clear host spaces above their furniture, so they
need no foreground bitmap. Existing worlds retain their original foregrounds.

The researched inspiration was the described chat-lobby → cinematic → gameplay
flow ([reference](https://www.reddit.com/r/theburntpeanut/comments/1uqq6fo/streaming_question/)).
That community description does not establish the creator's private OBS wiring.
These original spirit settings reuse this Hub's existing scene and transition
owners.

The installed native passage list includes all twelve worlds. The passage
installer appends newly authored worlds while retaining custom scene names,
style, duration and unknown script settings; malformed location data stops the
upgrade. Existing personal show/hide transitions still take priority. Off-air
native QA accepts `--sources SpiritArcadeLobby AuroraCampLobby` and checks a
visible intermediate frame, preserved transforms and an ownership-checked return.
