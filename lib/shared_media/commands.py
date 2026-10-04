"""Pure trigger and voice-command parsing shared by media adapters."""
from __future__ import annotations


def _parse_trigger_sequences(raw: str) -> list[list[str]]:
    if not str(raw or "").strip():
        return []
    sequences: list[list[str]] = []
    for part in str(raw).split(";"):
        text = part.strip()
        if not text:
            continue
        seq = [item for item in text.split(" ") if item] if " " in text else list(text)
        if seq:
            sequences.append(seq)
    return sequences

def _match_category_name(query: str, categories: list[str]) -> str | None:
    if not query or not categories:
        return None
    query_folded = query.strip().lower()
    for category in categories:
        if category.lower() == query_folded:
            return category
    scored = [
        (category, _simple_ratio(query_folded, category.lower()))
        for category in categories
    ]
    best = max(scored, key=lambda item: item[1], default=(None, 0.0))
    return best[0] if best[0] and best[1] >= 0.62 else None

def _simple_ratio(left: str, right: str) -> float:
    from difflib import SequenceMatcher

    return SequenceMatcher(None, left, right).ratio()

def _parse_runtime_command(text: str) -> tuple[str, str] | None:
    norm = " ".join(str(text or "").lower().strip().split())
    if not norm:
        return None
    aliases = {
        "random": ("random", "shuffle", "play random", "start random"),
        "next": ("next", "skip", "skip it", "next one", "next clip"),
        "stop": ("stop", "stop it", "abort", "cancel"),
        "reload": ("reload", "refresh", "reload media", "refresh media"),
    }
    for command, values in aliases.items():
        for alias in values:
            if norm == alias:
                return command, ""
            if command == "random" and norm.startswith(alias + " "):
                return command, norm[len(alias):].strip()
    return None
