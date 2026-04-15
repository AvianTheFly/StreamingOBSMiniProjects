# specific_song/matcher.py
#
# Matches a transcribed user utterance against the songs database.
#
# Each song has a canonical `name` and an optional list of `aliases`.
# Matching checks the query against BOTH the name and every alias,
# keeping the best per-song score.
#
# Algorithm
# ---------
#   1. Exact substring check (very fast, score = 1.0).
#   2. Word-coverage: fraction of the candidate's words found in the query.
#   3. Fuzzy ratio (difflib SequenceMatcher).
#   Final score = weighted blend of (2) and (3).
#
# No embeddings, no ML — intentional. This project is about *specific* song
# lookup, so a fast, deterministic fuzzy matcher is the right tool.

from __future__ import annotations

import difflib
import re


# ── Internal helpers ──────────────────────────────────────────────────────────

def _norm(text: str) -> str:
    """Lowercase + collapse punctuation to spaces."""
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _score_pair(query_norm: str, candidate_norm: str) -> float:
    """
    Return a 0–1 similarity score between a normalised query and a normalised
    candidate string (song name or alias).
    """
    if not candidate_norm:
        return 0.0

    # Exact substring → perfect match, but only when lengths are comparable.
    # A short candidate (e.g. "run") matching inside a long query
    # (e.g. "running up that hill") should NOT score 1.0 — it would beat
    # the real match.  Require the shorter string to be at least 60% the
    # length of the longer one before awarding the full score.
    if candidate_norm in query_norm or query_norm in candidate_norm:
        shorter = min(len(candidate_norm), len(query_norm))
        longer  = max(len(candidate_norm), len(query_norm))
        if longer == 0 or shorter / longer >= 0.6:
            return 1.0
        # Lengths too different — fall through to scored matching

    q_words = set(query_norm.split())
    c_words = set(candidate_norm.split())

    # Word coverage: how many of the candidate's words appear in the query?
    coverage = len(c_words & q_words) / len(c_words) if c_words else 0.0

    # Character-level fuzzy ratio
    ratio = difflib.SequenceMatcher(None, query_norm, candidate_norm).ratio()

    # Blend: weight coverage a bit more because the user names songs loosely
    return coverage * 0.55 + ratio * 0.45


# ── Public API ────────────────────────────────────────────────────────────────

def find_best_match(
    query: str,
    library: list[dict],
    threshold: float = 0.40,
) -> tuple[dict, float] | None:
    """
    Return (song_record, score) for the best match, or None if nothing clears
    `threshold`.

    `library` is the list loaded from songs.json.  Each record must have at
    least 'name'; 'aliases' is optional.
    """
    if not library or not query.strip():
        return None

    q_norm = _norm(query)
    best_song  = None
    best_score = -1.0

    for song in library:
        # Collect all strings to match against: name + every alias
        candidates_to_try = [song.get("name", "")]
        candidates_to_try += song.get("aliases", [])

        song_best = max(
            (_score_pair(q_norm, _norm(c)) for c in candidates_to_try if c),
            default=0.0,
        )

        if song_best > best_score:
            best_score = song_best
            best_song  = song

    if best_score >= threshold:
        return best_song, best_score

    return None


def rank_matches(
    query: str,
    library: list[dict],
    top_n: int = 5,
) -> list[tuple[dict, float]]:
    """
    Return all songs sorted by descending score, for debug / fallback display.
    Includes songs below threshold.
    """
    if not library:
        return []

    q_norm = _norm(query)
    results = []

    for song in library:
        candidates_to_try = [song.get("name", "")] + song.get("aliases", [])
        score = max(
            (_score_pair(q_norm, _norm(c)) for c in candidates_to_try if c),
            default=0.0,
        )
        results.append((song, score))

    results.sort(key=lambda x: x[1], reverse=True)
    return results[:top_n]