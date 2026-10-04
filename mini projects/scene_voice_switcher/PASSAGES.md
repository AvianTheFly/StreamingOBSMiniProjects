# Native lobby passages

Open **OBS → Tools → Scripts → passages.lua**. Choose a cinematic dissolve,
celestial aperture, stormglass gates or ember veil, then set a duration from
250–2000 ms. The installed default is a 950 ms aperture.

These effects animate the complete native location inside **Lobbies**, including
camera, screen, foreground and chat. Matching show/hide masks prevent empty gaps.
Full scene changes continue using the existing eight spirit performances. Native
passages work even when the Hub is closed.

The script preserves personal show/hide transitions already configured on an item.
It changes only its own named transitions on the nine authored locations. Filters,
transforms, audio levels, original items and the global selector remain. Unload
restores the prior empty transition metadata and releases its one OBS frontend
subscription. It has no worker, socket or timer; OBS owns its lifetime.

The finite installer snapshots external settings history, switches to an inactive
collection to preserve OBS's latest state, adds only its script entry, and returns
to the original collection without forcing a stale program scene. Run with this
checkout's Hub stopped and OBS open, streaming/recording inactive:

```powershell
py -3.11 tools/install_lobby_passages.py --collection-file 10326.json
```

The filename above is the currently observed active file for `live_duplicate`.
OBS has another personal file with the same collection name; verify the filename
in the OBS switch log before future maintenance. Never guess from the name alone.
The optional `--style dissolve|iris|gates|embers` and `--duration 950` arguments
provide a finite configuration contract for future control schemes. Normal design
changes use the OBS script properties and require no collection switching.

Native screenshots and verification results are saved under
`C:/Users/Michael/.codex/artifacts/starting-soon-production-20261003/native-lobbies`.
Use `tools/verify_lobby_passages.py --style iris` off-air with the Hub stopped;
verification uses an owned temporary scene and preserves original location visibility.
