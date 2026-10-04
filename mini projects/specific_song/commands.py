"""Interpret song control commands and category qualifiers."""
from __future__ import annotations

import difflib
import re

# ── Voice command aliases ──────────────────────────────────────────────────────
_CMD_ALIASES: dict[str, list[str]] = {
    "abort": [
        "abort", "aborted", "a board", "a bore", "a port", "aborting",
        "cancel", "cancel it",
    ],
    "random": [
        "random", "randomly", "randomize", "random mode",
        "ran dumb", "ran dom", "ran dum",
        "shuffle", "shuffled", "shuffling", "shovel",
        "play random", "start random", "go random",
    ],
    "next": [
        "next", "necks", "next one", "next song",
        "skip", "skipped", "skit", "skip it", "skip song",
        "text",
    ],
    "stop": [
        "stop", "stopped", "stop it", "stop music", "stop song",
        "store", "top",
    ],
    "reload": [
        "reload", "reloaded", "reload songs", "re-load",
        "refresh", "refreshed",
    ],
}

_CMD_FUZZY_THRESHOLD = 0.72
_CAT_FUZZY_THRESHOLD = 0.60

_CAT_STOP_WORDS = re.compile(
    r"\b(from|in|of|the|a|an|some|just|mode|category)\b"
)


def _norm_text(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _fuzzy_ratio(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, a, b).ratio()


def match_category(query: str, cats: dict[str, list[str]]) -> str | None:
    if not cats:
        return None
    q_raw = _norm_text(query)
    q_clean = _CAT_STOP_WORDS.sub("", q_raw).strip()

    for attempt in ([q_clean, q_raw] if q_clean != q_raw else [q_raw]):
        if not attempt:
            continue
        for name in cats:
            if name.lower() == attempt:
                return name
        best_name, best_score = None, 0.0
        for name in cats:
            score = _fuzzy_ratio(attempt, name.lower())
            if score > best_score:
                best_score = score
                best_name = name
        if best_score >= _CAT_FUZZY_THRESHOLD:
            return best_name
    return None


def parse_command(text: str) -> tuple[str, str] | None:
    norm = _norm_text(text)
    words = norm.split()
    if not words:
        return None

    for cmd, aliases in _CMD_ALIASES.items():
        for alias in aliases:
            alias_n = _norm_text(alias)
            if norm == alias_n:
                return cmd, ""
            if _fuzzy_ratio(norm, alias_n) >= _CMD_FUZZY_THRESHOLD:
                return cmd, ""

    for prefix_len in (1, 2):
        if len(words) <= prefix_len:
            break
        prefix = " ".join(words[:prefix_len])
        remainder = " ".join(words[prefix_len:])
        for alias in _CMD_ALIASES["random"]:
            alias_n = _norm_text(alias)
            if not alias_n:
                continue
            if prefix == alias_n or _fuzzy_ratio(prefix, alias_n) >= _CMD_FUZZY_THRESHOLD:
                return "random", remainder

    return None


