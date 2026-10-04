"""Pure voice matching and command interpretation; no runtime resources."""
import re
from difflib import SequenceMatcher

def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _compact(text: str) -> str:
    return _normalize(text).replace(" ", "")


def _similar(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def _camel_split(name: str) -> list[str]:
    """Split a CamelCase / PascalCase name into lowercase words."""
    spaced = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", name)
    return [w.lower() for w in spaced.split() if w]


def _match_lobbies_source(raw_text: str, lobbies: dict[str, list[str]]) -> str | None:
    normalized = _normalize(raw_text)
    compact = _compact(raw_text)

    if not normalized:
        return None

    ranked = {}
    for source_name, aliases in lobbies.items():
        for alias in aliases:
            alias_norm = _normalize(alias)
            alias_compact = _compact(alias)

            if not alias_norm: continue
            if normalized == alias_norm or compact == alias_compact:
                score = (3, len(alias_norm))
            elif re.search(r'\b'+re.escape(alias_norm)+r'\b',normalized):
                score = (2, len(alias_norm))
            else:
                similarity = max(_similar(normalized, alias_norm), _similar(compact, alias_compact))
                if similarity < .86 and _similar(normalized,alias_norm) < .82: continue
                score = (1, similarity)
            ranked[source_name] = max(ranked.get(source_name,(0,0)),score)
    if not ranked: return None
    best=max(ranked.values())
    winners=[name for name,score in ranked.items() if score==best]
    return winners[0] if len(winners)==1 else None


def _is_game_command(raw_text: str) -> bool:
    normalized = _normalize(raw_text)
    return normalized in {
        "game", "the game", "go game", "switch game",
        "scene game", "game scene", "test", "go test",
    }

