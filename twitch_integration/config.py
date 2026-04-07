import os

# ── Twitch ─────────────────────────────────────────────────────────────────────
TWITCH_CHANNEL     = os.environ.get("TWITCH_CHANNEL", "Udyrisabotlaner")
TWITCH_NICK        = os.environ.get("TWITCH_NICK", "Udyrisabotlaner")   # bot username in chat
TWITCH_OAUTH_TOKEN = os.environ.get("TWITCH_OAUTH_TOKEN", "")

# ── Connection ────────────────────────────────────────────────────────────────
IRC_SERVER         = "irc.chat.twitch.tv"
IRC_PORT           = 6697                 # TLS port
