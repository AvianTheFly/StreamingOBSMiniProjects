from __future__ import annotations

PTT_KEY = "`"
RECORD_TIMEOUT_SECONDS: float = 10.0

# Scene routing
LOBBIES_SCENE = "Lobbies"
GAME_SCENE = "Test"

# Voice aliases for source activation inside the Lobbies scene.
# Each key is the OBS source name; the tuple contains accepted spoken phrases.
# Add more entries here as you create more groups/sources.
SOURCE_ALIASES: dict[str, tuple[str, ...]] = {
    "FutureLobby": (
        "future",
        "future lobby",
        "future lobbies",
        "lobbies future lobby",
        "lobby future lobby",
        "futurelobby",
        "feature lobby",
        "futur lobby",
        "futur",
    ),
    "TavernLobby": (
        "tavern",
        "tavern lobby",
        "tavern lobbies",
        "tavernlobby",
        "tabern",
        "tavern lobbie",
    ),
}