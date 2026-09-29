"""Deterministic song lookup using names and aliases.

Comparable substrings score 1.0; other matches blend word coverage (55%)
and character similarity (45%). Ties preserve library order.
"""
from __future__ import annotations

from collections.abc import Iterator

from lib.shared_media.phrase_scoring import (
    normalize_phrase as _norm,
    coverage_score as _score_pair,
)


def _score_library(query: str, library: list[dict]) -> Iterator[tuple[dict, float]]:
    query_norm = _norm(query)
    for song in library:
        candidates = [song.get("name", "")] + song.get("aliases", [])
        yield song, max(
            (_score_pair(query_norm, _norm(candidate)) for candidate in candidates if candidate),
            default=0.0,
        )


def find_best_match(
    query: str,
    library: list[dict],
    threshold: float = 0.40,
) -> tuple[dict, float] | None:
    """Return the best original song record and score if it meets the threshold."""
    if not library or not query.strip():
        return None
    best = max(_score_library(query, library), key=lambda item: item[1])
    return best if best[1] >= threshold else None


def rank_matches(
    query: str,
    library: list[dict],
    top_n: int = 5,
) -> list[tuple[dict, float]]:
    """Rank songs for suggestions, including matches below the playback threshold."""
    if not library:
        return []
    return sorted(_score_library(query, library), key=lambda item: item[1], reverse=True)[:top_n]
