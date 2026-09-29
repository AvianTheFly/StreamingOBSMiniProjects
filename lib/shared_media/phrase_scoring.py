"""Pure song-name scoring shared by playback and the editor's match preview."""
import re
from difflib import SequenceMatcher


def normalize_phrase(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def coverage_score(query: str, candidate: str) -> float:
    """Score normalized phrases with 55% word coverage and 45% similarity."""
    if not candidate:
        return 0.0
    if candidate in query or query in candidate:
        # Short substrings such as "run" must not beat the full song title.
        if min(len(candidate), len(query)) / max(len(candidate), len(query)) >= 0.6:
            return 1.0
    query_words, candidate_words = set(query.split()), set(candidate.split())
    coverage = len(candidate_words & query_words) / len(candidate_words) if candidate_words else 0.0
    return coverage * 0.55 + SequenceMatcher(None, query, candidate).ratio() * 0.45
