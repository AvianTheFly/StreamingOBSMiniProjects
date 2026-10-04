# Twitch VOD and rewind startup check

Every launch of `hub.py` opens the configured `TWITCH_CHANNEL` stream settings in
normal Google Chrome, using the user's existing profile and Twitch login.
The Streaming Hub Twitch Startup Check extension enables Store past broadcasts,
Always Publish VODs and Stream Rewind, then reloads to verify saved settings.
Already enabled switches and all other Twitch preferences are left alone.
Rewind changes apply starting with the next stream.

## One-time setup in your logged-in Chrome profile

1. Open `chrome://extensions` and enable Developer mode.
2. Choose **Load unpacked** and select this checkout's
   `lib/twitch_stream_settings/extension` directory.
3. Click **Check again** under Twitch startup check on the Hub dashboard.

The extension runs only on Twitch stream-settings pages containing the Hub's
temporary startup marker. Ordinary dashboard visits do not change settings.
It never reads passwords, cookies or the Hub's existing Twitch API credentials.
Its background worker sends only the check result and an unpredictable one-use
marker to the local Hub. The Hub rejects stale markers and overlapping checks.
Its loopback host permission permits returning results for custom Hub ports.

The Hub dashboard reports verification, login needed, or extension/setup failure.
A check takes up to 75 seconds and does not block module startup. It checks once
per launch; if Twitch turns settings off later, the next launch checks again.
After successful verification is accepted by the Hub, the extension closes only
that marked setup tab. Failed checks and login prompts stay open for correction.
Other Chrome tabs stay open. Reload the unpacked extension in `chrome://extensions`
after updating its files to activate this behavior.
