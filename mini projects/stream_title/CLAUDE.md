# stream_title — CLAUDE.md

## What this project does

Voice-controlled Twitch stream title updater. Press `<` to open the mic;
whatever you say becomes the new Twitch stream title via the Twitch Helix API.
Uses OAuth 2.0 with automatic token refresh — no manual token rotation needed.

## Scene ownership

**Owns:** none

This project does not touch OBS at all. It only calls the Twitch Helix API.

## Key files

| File | Role |
|---|---|
| `main.py` | Hub entry point — PTT hotkey, Twitch API calls, token refresh |
| `config.py` | `PTT_KEY` (`<`), `RECORD_TIMEOUT_SECONDS` |
| `twitch_config.json` | Stored credentials: `access_token`, `refresh_token`, `client_id`, `client_secret`, `broadcaster_id`, `token_expiry` |

## Hotkey flow

```
Press <
    ├─ If recording  →  stop + send immediately
    └─ Open mic (VoicePTT, auto-sends after 2 s)
         └─ Transcription → set as new Twitch stream title via PATCH /channels
```

Press `C` to send early (handled by `VoicePTT`).

## Token management

Credentials are stored in `twitch_config.json` (next to `main.py`).
Token refresh happens automatically when the stored token is missing or within
60 seconds of expiry. The new token is persisted back to `twitch_config.json`.

If the token refresh fails (e.g. revoked refresh token), the project logs a
warning at startup but continues running — the title update will fail with
an error message when triggered.

**Required fields in `twitch_config.json`:**
```json
{
    "access_token":   "...",
    "refresh_token":  "...",
    "client_id":      "...",
    "client_secret":  "...",
    "broadcaster_id": "...",
    "token_expiry":   0
}
```

`token_expiry` is a Unix timestamp (seconds). Set to `0` to force a refresh on
next startup.

## No `interface.py`

This project has no `ProjectInterface` because it has no OBS state to revert.
`project_registry.revert_all()` will skip it.
