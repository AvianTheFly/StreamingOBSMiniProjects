from __future__ import annotations

import json
import math
import re
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path
from typing import Optional


try:
    from rapidfuzz import fuzz, process
except ImportError:  # pragma: no cover
    fuzz = None
    process = None
    _warned_no_rapidfuzz = False
else:
    _warned_no_rapidfuzz = True


_STOPWORDS = frozenset(
    {
        "a", "an", "the", "to", "of", "in", "for", "on", "with", "is", "are",
        "was", "were", "be", "been", "being", "have", "has", "had", "do",
        "does", "did", "will", "would", "could", "should", "may", "might",
        "can", "i", "me", "my", "we", "our", "you", "your", "he", "she",
        "it", "they", "and", "but", "or", "so", "if", "as", "at", "by",
        "from", "up", "about", "not", "no", "just", "this", "that",
    }
)


def ensure_phrases_file(phrases_file: Path) -> None:
    if phrases_file.is_file():
        return

    starter = {
        "_comment": (
            "Keys are canonical asset file stems without extensions. "
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
    ensure_phrases_file(phrases_file)
    if not phrases_file.is_file():
        return {}

    try:
        raw = json.loads(phrases_file.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"[media_phrase_matcher] Could not load phrases file: {exc}")
        return {}

    if not isinstance(raw, dict):
        print("[media_phrase_matcher] phrases file must be a JSON object - ignoring.")
        return {}

    cleaned: dict[str, list[str]] = {}
    for key, value in raw.items():
        if str(key).startswith("_") or not isinstance(value, list):
            continue
        phrases = [str(item).strip() for item in value if str(item).strip()]
        cleaned[str(key).lower().strip()] = phrases
    return cleaned


def match_phrase(
    text: str,
    stems: list[str],
    *,
    phrases_file: Path,
    fuzzy_threshold: int = 75,
    semantic_gap: int = 15,
    matching_strategy: str = "hybrid",
    fuzzy_scorer: str = "WRatio",
    fuzzy_weight: float = 0.70,
    token_weight: float = 0.30,
    embedding_weight: float = 0.0,
    embedding_model: str = "",
    verbose: bool = True,
) -> Optional[str]:
    """Match voice/text input to a canonical asset stem."""
    if not text or not text.strip():
        return None

    lowered = _strip_apostrophes(text.lower().strip())
    normalized_stems = [stem.lower().strip() for stem in stems if stem and stem.strip()]
    phrases = load_phrases(phrases_file)

    if lowered in normalized_stems:
        if verbose:
            print(f"[media_phrase_matcher] Exact stem match: '{lowered}'")
        return lowered

    alias_hit = _alias_lookup(lowered, phrases)
    if alias_hit and alias_hit in normalized_stems:
        if verbose:
            print(f"[media_phrase_matcher] Alias match: '{lowered}' -> '{alias_hit}'")
        return alias_hit

    candidate_map = _build_candidate_map(normalized_stems, phrases)
    if not candidate_map:
        return None

    strategy = (matching_strategy or "hybrid").strip().lower()
    if strategy in {"weighted", "embedding", "token"}:
        return _weighted_match(
            lowered,
            normalized_stems,
            phrases,
            candidate_map,
            fuzzy_threshold=fuzzy_threshold,
            semantic_gap=semantic_gap,
            fuzzy_scorer=fuzzy_scorer,
            fuzzy_weight=fuzzy_weight,
            token_weight=token_weight,
            embedding_weight=embedding_weight if strategy == "embedding" else 0.0,
            embedding_model=embedding_model,
            verbose=verbose,
        )

    results = _fuzzy_extract(
        lowered,
        list(candidate_map.keys()),
        score_cutoff=fuzzy_threshold,
        limit=10,
        scorer_name=fuzzy_scorer,
    )
    if not results:
        if verbose:
            print(
                f"[media_phrase_matcher] No match for '{lowered}' "
                f"(threshold={fuzzy_threshold})"
            )
        return None

    top_phrase, top_score, _ = results[0]
    if len(results) == 1 or (top_score - results[1][1]) >= semantic_gap:
        matched_stem = candidate_map[top_phrase]
        if verbose:
            print(
                f"[media_phrase_matcher] Fuzzy match (score={int(top_score)}): "
                f"'{lowered}' -> '{matched_stem}'"
            )
        return matched_stem

    close_candidates = [
        (phrase, score)
        for phrase, score, _ in results
        if top_score - score < semantic_gap
    ]

    if verbose:
        close_stems = [candidate_map[phrase] for phrase, _score in close_candidates]
        print(
            f"[media_phrase_matcher] Ambiguous fuzzy results for '{lowered}' "
            f"(top={int(top_score)}, gap<{semantic_gap}): {close_stems} "
            "- running TF-IDF disambiguation."
        )

    stem_corpus = _build_stem_token_corpus(normalized_stems, phrases)
    idf = _build_idf(list(stem_corpus.values()))
    query_tokens = _tokenize(lowered)

    best_stem: str | None = None
    best_tfidf = -1.0
    for phrase, _score in close_candidates:
        stem = candidate_map[phrase]
        doc_tokens = stem_corpus.get(stem, _tokenize(stem))
        score = _tfidf_score(query_tokens, doc_tokens, idf)
        if verbose:
            print(f"[media_phrase_matcher]   TF-IDF '{stem}': {score:.4f}")
        if score > best_tfidf:
            best_tfidf = score
            best_stem = stem

    if best_stem is None or best_tfidf <= 0.0:
        best_stem = candidate_map[top_phrase]
        if verbose:
            print(
                "[media_phrase_matcher] TF-IDF produced no signal - "
                f"falling back to fuzzy top: '{best_stem}'"
            )
    elif verbose:
        print(
            f"[media_phrase_matcher] TF-IDF disambiguated (score={best_tfidf:.4f}): "
            f"'{lowered}' -> '{best_stem}'"
        )

    return best_stem


def _tokenize(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    return [word for word in words if word not in _STOPWORDS and len(word) > 1]


def _similarity(left: str, right: str) -> float:
    return SequenceMatcher(None, left, right).ratio() * 100


def _fuzzy_extract(
    query: str,
    candidates: list[str],
    *,
    score_cutoff: int,
    limit: int,
    scorer_name: str = "WRatio",
) -> list[tuple[str, float, int]]:
    global _warned_no_rapidfuzz

    if process is not None and fuzz is not None:
        scorer = _rapidfuzz_scorer(scorer_name)
        return process.extract(
            query,
            candidates,
            scorer=scorer,
            score_cutoff=score_cutoff,
            limit=limit,
        )

    if not _warned_no_rapidfuzz:
        print("[media_phrase_matcher] rapidfuzz not installed; using slower difflib fallback.")
        _warned_no_rapidfuzz = True

    scored = [
        (candidate, _similarity(query, candidate), index)
        for index, candidate in enumerate(candidates)
    ]
    return [
        item
        for item in sorted(scored, key=lambda result: result[1], reverse=True)
        if item[1] >= score_cutoff
    ][:limit]


def _rapidfuzz_scorer(name: str):
    if fuzz is None:
        return None
    lookup = {
        "ratio": fuzz.ratio,
        "partial_ratio": fuzz.partial_ratio,
        "token_sort_ratio": fuzz.token_sort_ratio,
        "token_set_ratio": fuzz.token_set_ratio,
        "wratio": fuzz.WRatio,
        "wration": fuzz.WRatio,
        "w_ratio": fuzz.WRatio,
    }
    return lookup.get((name or "WRatio").strip().lower(), fuzz.WRatio)


def _single_fuzzy_score(query: str, candidate: str, scorer_name: str) -> float:
    if fuzz is not None:
        scorer = _rapidfuzz_scorer(scorer_name)
        return float(scorer(query, candidate))
    return _similarity(query, candidate)


def _weighted_match(
    query: str,
    normalized_stems: list[str],
    phrases: dict[str, list[str]],
    candidate_map: dict[str, str],
    *,
    fuzzy_threshold: int,
    semantic_gap: int,
    fuzzy_scorer: str,
    fuzzy_weight: float,
    token_weight: float,
    embedding_weight: float,
    embedding_model: str,
    verbose: bool,
) -> str | None:
    weights = _normalized_weights(
        fuzzy=fuzzy_weight,
        token=token_weight,
        embedding=embedding_weight,
    )
    embedding_scores = _embedding_scores(
        query,
        list(candidate_map.keys()),
        model_name=embedding_model,
        enabled=weights["embedding"] > 0,
        verbose=verbose,
    )

    scored: dict[str, float] = {}
    detail: dict[str, tuple[float, float, float]] = {}
    query_tokens = _tokenize(query)
    stem_corpus = _build_stem_token_corpus(normalized_stems, phrases)

    for candidate, stem in candidate_map.items():
        fuzzy_score = _single_fuzzy_score(query, candidate, fuzzy_scorer)
        token_score = _token_overlap_score(query_tokens, stem_corpus.get(stem, _tokenize(stem))) * 100.0
        embedding_score = embedding_scores.get(candidate, 0.0) * 100.0
        total = (
            fuzzy_score * weights["fuzzy"]
            + token_score * weights["token"]
            + embedding_score * weights["embedding"]
        )
        if total > scored.get(stem, -1.0):
            scored[stem] = total
            detail[stem] = (fuzzy_score, token_score, embedding_score)

    ranked = sorted(scored.items(), key=lambda item: item[1], reverse=True)
    if not ranked or ranked[0][1] < fuzzy_threshold:
        if verbose:
            print(
                f"[media_phrase_matcher] No weighted match for '{query}' "
                f"(threshold={fuzzy_threshold})"
            )
        return None

    top_stem, top_score = ranked[0]
    if len(ranked) > 1 and top_score - ranked[1][1] < semantic_gap:
        if verbose:
            close = [stem for stem, score in ranked[:5] if top_score - score < semantic_gap]
            print(
                f"[media_phrase_matcher] Ambiguous weighted results for '{query}' "
                f"(top={top_score:.1f}, gap<{semantic_gap}): {close}"
            )
        return None

    if verbose:
        fuzzy_score, token_score, embedding_score = detail.get(top_stem, (0.0, 0.0, 0.0))
        print(
            f"[media_phrase_matcher] Weighted match (score={top_score:.1f}; "
            f"fuzzy={fuzzy_score:.1f}, token={token_score:.1f}, embedding={embedding_score:.1f}): "
            f"'{query}' -> '{top_stem}'"
        )
    return top_stem


def _normalized_weights(*, fuzzy: float, token: float, embedding: float) -> dict[str, float]:
    raw = {
        "fuzzy": max(0.0, _float_or_default(fuzzy, 0.70)),
        "token": max(0.0, _float_or_default(token, 0.30)),
        "embedding": max(0.0, _float_or_default(embedding, 0.0)),
    }
    total = sum(raw.values()) or 1.0
    return {key: value / total for key, value in raw.items()}


def _float_or_default(value: object, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _token_overlap_score(query_tokens: list[str], doc_tokens: list[str]) -> float:
    if not query_tokens or not doc_tokens:
        return 0.0
    query_set = set(query_tokens)
    doc_set = set(doc_tokens)
    return len(query_set & doc_set) / max(1, len(doc_set))


_EMBEDDING_MODEL_CACHE: dict[str, object] = {}


def _embedding_scores(
    query: str,
    candidates: list[str],
    *,
    model_name: str,
    enabled: bool,
    verbose: bool,
) -> dict[str, float]:
    if not enabled or not candidates:
        return {}
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore
    except Exception:
        if verbose:
            print(
                "[media_phrase_matcher] Embedding matching requested, but "
                "sentence-transformers is not installed. Continuing without it."
            )
        return {}

    name = model_name.strip() or "all-MiniLM-L6-v2"
    try:
        model = _EMBEDDING_MODEL_CACHE.get(name)
        if model is None:
            model = SentenceTransformer(name)
            _EMBEDDING_MODEL_CACHE[name] = model
        vectors = model.encode([query, *candidates], normalize_embeddings=True)
    except Exception as exc:
        if verbose:
            print(f"[media_phrase_matcher] Embedding model unavailable: {exc}")
        return {}

    query_vec = vectors[0]
    scores: dict[str, float] = {}
    for candidate, vector in zip(candidates, vectors[1:]):
        try:
            scores[candidate] = float(query_vec @ vector)
        except Exception:
            scores[candidate] = 0.0
    return scores


def _build_idf(corpus: list[list[str]]) -> dict[str, float]:
    total = len(corpus)
    if total == 0:
        return {}

    doc_counts: dict[str, int] = {}
    for doc in corpus:
        for word in set(doc):
            doc_counts[word] = doc_counts.get(word, 0) + 1

    return {
        word: math.log((total + 1) / (count + 1)) + 1.0
        for word, count in doc_counts.items()
    }


def _tfidf_score(query_tokens: list[str], doc_tokens: list[str], idf: dict[str, float]) -> float:
    if not doc_tokens or not query_tokens:
        return 0.0

    doc_counter = Counter(doc_tokens)
    doc_len = len(doc_tokens)
    score = 0.0
    for word in set(query_tokens):
        if word in doc_counter:
            score += (doc_counter[word] / doc_len) * idf.get(word, 1.0)
    return score


def _build_stem_token_corpus(
    normalized_stems: list[str],
    phrases: dict[str, list[str]],
) -> dict[str, list[str]]:
    corpus: dict[str, list[str]] = {}
    for stem in normalized_stems:
        tokens = _tokenize(stem)
        for alias in phrases.get(stem, []):
            tokens += _tokenize(alias)
        corpus[stem] = tokens
    return corpus


def _alias_lookup(text: str, phrases: dict[str, list[str]]) -> str | None:
    lowered = text.lower().strip()
    for stem, aliases in phrases.items():
        for alias in aliases:
            if alias.lower().strip() == lowered:
                return stem
    return None


def _strip_apostrophes(text: str) -> str:
    return text.replace("'", "").replace("\u2019", "")


def _build_candidate_map(
    stems: list[str],
    phrases: dict[str, list[str]],
) -> dict[str, str]:
    candidates: dict[str, str] = {}
    normalized_stems = {stem.lower().strip() for stem in stems if stem and stem.strip()}

    for stem in normalized_stems:
        candidates[stem] = stem
        stripped = _strip_apostrophes(stem)
        if stripped != stem:
            candidates[stripped] = stem

    for stem, aliases in phrases.items():
        if stem not in normalized_stems:
            continue
        for alias in aliases:
            normalized_alias = alias.lower().strip()
            if not normalized_alias:
                continue
            candidates[normalized_alias] = stem
            stripped = _strip_apostrophes(normalized_alias)
            if stripped != normalized_alias:
                candidates[stripped] = stem

    return candidates
