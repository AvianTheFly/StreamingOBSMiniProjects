from __future__ import annotations

import json
import math
import re
from collections import Counter
from pathlib import Path
from typing import Optional

try:
    from rapidfuzz import process, fuzz
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        "[media_phrase_matcher] rapidfuzz is required: pip install rapidfuzz"
    ) from exc

# Words that carry little discriminating power on their own.
_STOPWORDS = frozenset({
    "a", "an", "the", "to", "of", "in", "for", "on", "with", "is", "are",
    "was", "were", "be", "been", "being", "have", "has", "had", "do", "does",
    "did", "will", "would", "could", "should", "may", "might", "can",
    "i", "me", "my", "we", "our", "you", "your", "he", "she", "it", "they",
    "and", "but", "or", "so", "if", "as", "at", "by", "from", "up", "about",
    "not", "no", "just", "this", "that",
})


def _tokenize(text: str) -> list[str]:
    """Lowercase, extract alphanumeric tokens, strip stopwords and single chars."""
    words = re.findall(r"[a-z0-9]+", text.lower())
    return [w for w in words if w not in _STOPWORDS and len(w) > 1]


def _build_idf(corpus: list[list[str]]) -> dict[str, float]:
    """
    Smoothed IDF: log((N+1) / (df+1)) + 1.
    Words common across many documents get lower weight;
    words unique to one document get higher weight.
    """
    N = len(corpus)
    if N == 0:
        return {}
    df: dict[str, int] = {}
    for doc in corpus:
        for word in set(doc):
            df[word] = df.get(word, 0) + 1
    return {word: math.log((N + 1) / (count + 1)) + 1.0 for word, count in df.items()}


def _tfidf_score(query_tokens: list[str], doc_tokens: list[str], idf: dict[str, float]) -> float:
    """TF-IDF overlap: sum TF*IDF for every query token that appears in the doc."""
    if not doc_tokens or not query_tokens:
        return 0.0
    doc_counter = Counter(doc_tokens)
    doc_len = len(doc_tokens)
    score = 0.0
    for word in set(query_tokens):
        if word in doc_counter:
            tf = doc_counter[word] / doc_len
            score += tf * idf.get(word, 1.0)
    return score


def _build_stem_token_corpus(
    normalized_stems: list[str],
    phrases: dict[str, list[str]],
) -> dict[str, list[str]]:
    """
    One 'document' per stem = stem tokens + all alias tokens for that stem.
    Gives each file the richest possible word representation for IDF scoring.
    """
    corpus: dict[str, list[str]] = {}
    for stem in normalized_stems:
        tokens = _tokenize(stem)
        for alias in phrases.get(stem, []):
            tokens = tokens + _tokenize(alias)
        corpus[stem] = tokens
    return corpus


def ensure_phrases_file(phrases_file: Path) -> None:
    """
    Create a starter phrases.json if it does not exist.
    """
    if phrases_file.is_file():
        return

    starter = {
        "_comment": (
            "Keys are canonical asset file stems (no extension). "
            "Values are alternate phrases that should trigger that asset."
        )
    }

    try:
        phrases_file.write_text(
            json.dumps(starter, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        print(f"[media_phrase_matcher] Created missing phrases file: {phrases_file}")
    except Exception as exc:
        print(f"[media_phrase_matcher] Could not create phrases file: {exc}")


def load_phrases(phrases_file: Path) -> dict[str, list[str]]:
    """
    Load phrases JSON and ignore metadata keys starting with '_'.
    Returns {} on failure.
    """
    ensure_phrases_file(phrases_file)

    if not phrases_file.is_file():
        return {}

    try:
        raw = json.loads(phrases_file.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            print("[media_phrase_matcher] phrases file must be a JSON object — ignoring.")
            return {}

        cleaned: dict[str, list[str]] = {}
        for key, value in raw.items():
            if str(key).startswith("_"):
                continue
            if not isinstance(value, list):
                continue

            phrases: list[str] = []
            for item in value:
                s = str(item).strip()
                if s:
                    phrases.append(s)

            cleaned[str(key).lower().strip()] = phrases

        return cleaned

    except Exception as exc:
        print(f"[media_phrase_matcher] Could not load phrases file: {exc}")
        return {}


def _alias_lookup(text: str, phrases: dict[str, list[str]]) -> str | None:
    lowered = text.lower().strip()
    for stem, aliases in phrases.items():
        for alias in aliases:
            if alias.lower().strip() == lowered:
                return stem
    return None


def _build_candidate_map(
    stems: list[str],
    phrases: dict[str, list[str]],
) -> dict[str, str]:
    candidates: dict[str, str] = {}

    normalized_stems = {s.lower().strip() for s in stems if s and s.strip()}

    for stem in normalized_stems:
        candidates[stem] = stem

    for stem, aliases in phrases.items():
        if stem not in normalized_stems:
            continue
        for alias in aliases:
            a = alias.lower().strip()
            if a:
                candidates[a] = stem

    return candidates


def match_phrase(
    text: str,
    stems: list[str],
    *,
    phrases_file: Path,
    fuzzy_threshold: int = 75,
    semantic_gap: int = 15,
    verbose: bool = True,
) -> Optional[str]:
    """
    Match voice/text input to a canonical asset stem.

    Two-stage strategy:
      1. Fuzzy match (rapidfuzz WRatio) across all stems + aliases.
         If the top candidate leads the second by >= semantic_gap points,
         it wins outright.
      2. When multiple candidates fall within semantic_gap of each other,
         TF-IDF word-importance scoring breaks the tie.
         Words shared across many filenames (e.g. "league") get low weight;
         words unique to one file (e.g. "welcome", "stop", "playing") get high
         weight, so the query's distinctive words steer the final pick.
    """
    if not text or not text.strip():
        return None

    lowered = text.lower().strip()
    normalized_stems = [s.lower().strip() for s in stems if s and s.strip()]
    phrases = load_phrases(phrases_file)

    # Fast path: exact stem match
    if lowered in normalized_stems:
        if verbose:
            print(f"[media_phrase_matcher] Exact stem match: '{lowered}'")
        return lowered

    # Fast path: exact alias match
    alias_hit = _alias_lookup(lowered, phrases)
    if alias_hit and alias_hit in normalized_stems:
        if verbose:
            print(f"[media_phrase_matcher] Alias match: '{lowered}' → '{alias_hit}'")
        return alias_hit

    candidate_map = _build_candidate_map(normalized_stems, phrases)
    if not candidate_map:
        return None

    # Stage 1 — fuzzy matching, keep up to 10 candidates above threshold
    results = process.extract(
        lowered,
        list(candidate_map.keys()),
        scorer=fuzz.WRatio,
        score_cutoff=fuzzy_threshold,
        limit=10,
    )

    if not results:
        if verbose:
            print(
                f"[media_phrase_matcher] No match for '{lowered}' "
                f"(threshold={fuzzy_threshold})"
            )
        return None

    top_phrase, top_score, _ = results[0]

    # Clear winner: only one candidate, or the top leads by >= semantic_gap
    if len(results) == 1 or (top_score - results[1][1]) >= semantic_gap:
        matched_stem = candidate_map[top_phrase]
        if verbose:
            print(
                f"[media_phrase_matcher] Fuzzy match (score={int(top_score)}): "
                f"'{lowered}' → '{matched_stem}'"
            )
        return matched_stem

    # Stage 2 — TF-IDF disambiguation among close candidates
    close_candidates = [
        (phrase, score)
        for phrase, score, _ in results
        if top_score - score < semantic_gap
    ]

    if verbose:
        close_stems = [candidate_map[p] for p, _ in close_candidates]
        print(
            f"[media_phrase_matcher] Ambiguous fuzzy results for '{lowered}' "
            f"(top={int(top_score)}, gap<{semantic_gap}): {close_stems} "
            f"— running TF-IDF disambiguation."
        )

    # Build IDF from the full stem vocabulary so common words are downweighted
    stem_corpus = _build_stem_token_corpus(normalized_stems, phrases)
    idf = _build_idf(list(stem_corpus.values()))
    query_tokens = _tokenize(lowered)

    best_stem: str | None = None
    best_tfidf: float = -1.0

    for phrase, _ in close_candidates:
        stem = candidate_map[phrase]
        doc_tokens = stem_corpus.get(stem, _tokenize(stem))
        score = _tfidf_score(query_tokens, doc_tokens, idf)
        if verbose:
            print(f"[media_phrase_matcher]   TF-IDF '{stem}': {score:.4f}")
        if score > best_tfidf:
            best_tfidf = score
            best_stem = stem

    # Fall back to fuzzy top if TF-IDF produced no signal (all zeros)
    if best_stem is None or best_tfidf <= 0.0:
        best_stem = candidate_map[top_phrase]
        if verbose:
            print(
                f"[media_phrase_matcher] TF-IDF produced no signal — "
                f"falling back to fuzzy top: '{best_stem}'"
            )
    else:
        if verbose:
            print(
                f"[media_phrase_matcher] TF-IDF disambiguated (score={best_tfidf:.4f}): "
                f"'{lowered}' → '{best_stem}'"
            )

    return best_stem
