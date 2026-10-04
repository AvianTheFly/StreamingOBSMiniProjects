from __future__ import annotations

PTT_KEY = "`"
RECORD_TIMEOUT_SECONDS: float = 2.0

# Scene routing
LOBBIES_SCENE = "Lobbies"
GAME_SCENE = "Test"

# ---------------------------------------------------------------------------
# Optional voice-alias overrides
# ---------------------------------------------------------------------------
# At startup the switcher auto-discovers every source/group inside LOBBIES_SCENE
# and generates aliases from the name (e.g. "TavernLobby" → "tavern lobby",
# "tavern", "tavernlobby").
#
# Add entries here ONLY when you need aliases that can't be derived from the
# source name — e.g. common Whisper mishears or shorthand nicknames.
#
# Format:
#   "OBS source name": ("alias one", "alias two", …)
#
# You do NOT need to add new lobbies here when you create them in OBS — just
# name them clearly in PascalCase and the auto-discovery will handle the rest.
# ---------------------------------------------------------------------------
SOURCE_ALIASES: dict[str, tuple[str, ...]] = {
    'TavernWorldLobby': ('lobby of legends','legends','tavern'),
    'FutureWorldLobby': ('future lounge','future'),
    'SpiritArcadeLobby': ('arcade','spirit arcade','neon arcade'),
    'AuroraCampLobby': ('aurora','aurora camp','campfire','camp'),
    'Spirit Afterparty': ('afterparty','spirit afterparty','clubhouse','party lobby'),
    'ReefLobby': ('reef', 'turtle reef', 'underwater', 'turtle'),
    'SpiritRailLobby': ('spirit railway', 'railway', 'train', 'station'),
    'StormCoastLobby': ('storm coast', 'coast', 'storm retreat', 'beach'),
    'PhoenixObservatoryLobby': ('phoenix observatory', 'observatory', 'desert', 'phoenix lobby'),
    'ForgeLobby': ('forge', 'mountain forge', 'spirit forge'),
    'SanctuaryLobby': ('sanctuary', 'moonlit sanctuary', 'moon lobby'),
    'SkyHarborLobby': ('sky harbor', 'sky harbour', 'harbor', 'airship'),
    "FutureLobby": (
        "feature lobby",
        "futur lobby",
        "futur",
        "future lobbies",
    ),
    "TavernLobby": (
        "tabern",
        "tavern lobbies",
        "tavern lobbie",
    ),
}
