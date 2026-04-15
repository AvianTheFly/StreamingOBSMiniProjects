from __future__ import annotations

from shared_media.media_phrase_matcher import match_phrase
from .config import CONFIG


def match_clip(text: str, stems: list[str], *, verbose: bool = True):
    return match_phrase(
        text,
        stems,
        phrases_file=CONFIG.phrases_file,
        fuzzy_threshold=CONFIG.fuzzy_threshold,
        verbose=verbose,
    )