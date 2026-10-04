"""Discover configured OBS lobby sources and their voice aliases."""
import obs
from .commands import _camel_split
from .config import LOBBIES_SCENE, SOURCE_ALIASES
from .layouts import REPLACEMENTS, legacy_exclusions
from .settings import rotation
from . import presentation, settings
from .layouts import LAYOUTS
from lib.coordination.lobbies import lobby_catalog

def publish_inventory(lobbies):
    with presentation.lock:
        chosen = rotation(lobbies)
        data=settings.read()
        plans={name:presentation.plan(name,data) for name in lobbies if name in LAYOUTS}
        exclusions = ('LOL champ select', *legacy_exclusions(lobbies),
                      *(name for name in lobbies if name not in chosen))
        lobby_catalog.publish('scene_voice_switcher', LOBBIES_SCENE, chosen, exclusions=exclusions,layouts=plans)
        return chosen

def _discover_lobbies() -> dict[str, list[str]]:
    """
    Query OBS for every source/group in LOBBIES_SCENE and build a voice-alias
    map  {obs_source_name: [alias, alias, ...]}.
    """
    # Nested scenes and groups can both be locations. Audio, chat, stickers and
    # champion select are overlays, not selectable lobbies.
    sources = [i['sourceName'] for i in obs.get_obs().get_scene_item_list(LOBBIES_SCENE).scene_items
               if i['sourceName'].lower().endswith('lobby') or i['sourceName']=='Spirit Afterparty']
    sources = [name for name in sources if name not in legacy_exclusions(sources)]

    if not sources:
        print(
            f"[scene_voice_switcher] No sources found in '{LOBBIES_SCENE}'. "
            "Is the scene name correct and is OBS connected?"
        )

    result: dict[str, list[str]] = {}

    for name in sources:
        aliases: set[str] = set()
        words = _camel_split(name)
        aliases.add(name.lower())
        aliases.add(" ".join(words))
        aliases.update(w for w in words if w not in {'lobby', 'lobbies'})
        for alias in SOURCE_ALIASES.get(name, ()):
            aliases.add(alias.lower())
        for old, new in REPLACEMENTS.items():
            if new == name:
                aliases.update(SOURCE_ALIASES.get(old, ()))
                aliases.add(old.lower())
                aliases.add(' '.join(_camel_split(old)))
        result[name] = sorted(aliases)

    for name, extra_aliases in SOURCE_ALIASES.items():
        if name not in result:
            print(f"[scene_voice_switcher] Skipping missing lobby '{name}'.")

    print(f"[scene_voice_switcher] Discovered {len(result)} lobby source(s):")
    for src, aliases in result.items():
        print(f"    - {src} -> {aliases}")

    return result

