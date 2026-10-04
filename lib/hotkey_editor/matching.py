"""Recorded voice transcription and phrase scoring for the editor."""
from __future__ import annotations
from pathlib import Path
from lib.shared_media.phrase_scoring import coverage_score
from lib.shared_media.phrase_scoring import normalize_phrase


def _transcribe_audio(audio_bytes: bytes, content_type: str='', *, word_timestamps=False):
    from voice.service import service
    return (service.transcribe_upload(audio_bytes, content_type, word_timestamps=True)
            if word_timestamps else service.transcribe_upload(audio_bytes, content_type))

def _score_phrase(phrase: str, stems: list[str], phrases_file: Path | None=None, *, strategy: str | None=None) -> list[dict]:
    """Return stems ranked by fuzzy score for the given phrase."""
    if not phrase or not stems:
        return []
    phrase_lower = phrase.lower().strip()
    phrases: dict[str, list[str]] = {}
    if phrases_file and phrases_file.is_file():
        try:
            from lib.shared_media.media_phrase_matcher import load_phrases
            phrases = load_phrases(phrases_file)
        except Exception:
            pass
    candidate_map: dict[str, str] = {}
    for stem in stems:
        sl = stem.lower().strip()
        candidate_map[sl] = stem
        for alias in phrases.get(sl, []):
            key = alias.lower().strip()
            if key:
                candidate_map[key] = stem
    if strategy == 'coverage_difflib':
        query = normalize_phrase(phrase_lower)
        scores = ((cand, coverage_score(query, normalize_phrase(cand))) for cand in candidate_map)
    else:
        try:
            from rapidfuzz import fuzz, process as rfprocess
            ranked = rfprocess.extract(phrase_lower, list(candidate_map), scorer=fuzz.WRatio, limit=None)
            scores = ((cand, score / 100) for cand, score, _ in ranked)
        except ImportError:
            from difflib import SequenceMatcher
            scores = ((cand, SequenceMatcher(None, phrase_lower, cand).ratio()) for cand in candidate_map)
    stem_scores: dict[str, float] = {}
    for candidate, score in scores:
        stem = candidate_map[candidate]
        stem_scores[stem] = max(stem_scores.get(stem, 0.0), score)
    return sorted([{'stem': stem, 'score': round(score, 3)} for stem, score in stem_scores.items()], key=lambda item: item['score'], reverse=True)
