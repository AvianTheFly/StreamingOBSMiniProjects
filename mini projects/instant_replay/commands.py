"""Replay voice-command parsing and tag aliases; no OBS or playback ownership."""
from __future__ import annotations
import difflib
from .config import SAVE_TAG_ALIASES


_SAVE_ALIASES: list[str] = [
    "save", "saved", "safe", "say", "dave", "wave",
    "shave", "cave", "face", "base", "slave", "gave",
]
_MARK_ALIASES: list[str] = [
    "mark", "marked", "marks", "marc", "march", "dark",
    "park", "bark", "arc", "spark", "heart",
]
_PLAY_ALIASES: list[str] = [
    "play", "playing", "played", "player", "clay",
    "blade", "place", "plane", "plain", "please", "plague",
]


def _match_tag(token: str) -> str:
    """
    Return the best matching save tag for a single token, or "" if nothing
    is confident enough.

    Strategy (first match wins):
      1. Exact alias substring check (token contains an alias, or alias contains
         the token) — catches the common cases and known Whisper mishears.
      2. difflib fuzzy match against all alias strings — catches novel mishears
         that aren't in the explicit list.  Requires a similarity ratio ≥ 0.72
         to avoid false positives on short tokens like "a" or "the".
    """
    t = token.lower().rstrip(".,!?;:\"'")
    if not t:
        return ""

    # Match whole aliases. Substring matching made ordinary words such as
    # "inside" silently become a win tag because "in" was an alias.
    for tag, aliases in SAVE_TAG_ALIASES.items():
        if t == tag or t in aliases:
            return tag

    # 2. Fuzzy fallback — build flat alias list with tag labels
    all_aliases: list[str] = [a for aliases in SAVE_TAG_ALIASES.values() for a in aliases]
    close = difflib.get_close_matches(t, [a for a in all_aliases if len(a) >= 4],
                                      n=1, cutoff=0.78) if len(t) >= 4 else []
    if close:
        best_alias = close[0]
        for tag, aliases in SAVE_TAG_ALIASES.items():
            if best_alias in aliases:
                print(f"[instant_replay] 🔍 Fuzzy tag match: {t!r} → {best_alias!r} → [{tag}]")
                return tag

    return ""


_WORD_TO_SECONDS: dict[str, float] = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
    "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19,
    "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50,
    "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
    "hundred": 100, "a hundred": 100, "one hundred": 100,
    "two hundred": 200,
}


def parse_command(text: str) -> tuple[str | None, str, float, bool]:
    """
    Return (command, spec, clip_seconds, full_save).

    Commands: 'save', 'mark', 'play', 'stop'.

    For 'save':
      spec        — matched tag ('win', 'escape', 'fail') or "".
      clip_seconds — explicit clip duration in seconds (0 = not specified).
                    A numeric token ("30") or word-number ("thirty") sets this.
                    When non-zero, it overrides kill/mark anchors and saves
                    exactly that many seconds from the end of the buffer.
      full_save   — True when the user says "save full" (entire buffer).

    Priority in _on_save (highest first):
      full_save > clip_seconds > manual mark > kill anchor > full buffer

    For 'play':
      spec — the play spec string ('all', 'highlights', 'win', …) or "".
    """
    lowered = " ".join(text.lower().strip().rstrip(".,!?;:").split())
    if lowered in {'quick replay', 'replay that', 'replay only', 'replay this moment'} or lowered.startswith('quick replay '):
        duration = lowered.removeprefix('quick replay ').removesuffix(' seconds').removesuffix(' second')
        seconds = _WORD_TO_SECONDS.get(duration, 0)
        if not seconds:
            try:
                seconds = float(duration)
            except ValueError:
                seconds = 15
        return ('quick_replay', '', seconds, False)
    if lowered in {'save and replay', 'save then replay', 'save & replay'}:
        return ('save_replay', '', 0, False)
    if lowered in {'showcase', 'showcase clip', 'showcase latest'}:
        return ('play', 'showcase', 0, False)
    if lowered in {"replay", "instant replay", "show replay"}:
        return ("play", "replay", 0, False)
    if lowered in {"clip", "play clip", "latest clip"}:
        return ("play", "last", 0, False)
    if lowered in {"next", "skip", "next clip", "skip clip"}:
        return ("next", "", 0, False)
    if lowered in {"screen on", "show screen", "show desktop", "desktop on"}:
        return ("screen", "on", 0, False)
    if lowered in {'live view on', 'show live view', 'live view'}:
        return ('view', 'live', 0, False)
    if lowered in {"screen off", "hide screen", "hide desktop", "desktop off"}:
        return ("screen", "off", 0, False)
    if lowered in {"stop", "stop replay", "leave", "leave replay", "exit", "exit replay",
                   "end replay", "cancel replay", "quit replay"}:
        return ("stop", "", 0, False)
    # Group names may contain command words (e.g. "save the day").
    if lowered.startswith("play intro ") or lowered.startswith("play group "):
        return ("play", lowered[5:], 0, False)
    if lowered in {"random", "random replay", "random clip", "surprise me", "play random replay", "play a random replay", "play a random clip"}:
        return ("play", "random", 0, False)
    tokens = lowered.split()

    # Detect command
    cmd: str | None = None
    if any(a in lowered for a in _SAVE_ALIASES):
        cmd = "save"
    elif any(a in lowered for a in _MARK_ALIASES):
        cmd = "mark"
    elif any(a in lowered for a in _PLAY_ALIASES):
        cmd = "play"

    if cmd == "save":
        # Find the index of the save word
        save_idx = 0
        for i, tok in enumerate(tokens):
            if any(a in tok for a in _SAVE_ALIASES):
                save_idx = i
                break

        clip_seconds: float = 0
        tag = ""
        full_save = False

        for tok in tokens[save_idx + 1:]:
            stripped = tok.rstrip(".,!?;:\"'")

            if stripped in ("full", "whole", "entire", "all", "everything"):
                full_save = True
                continue

            # Numeric literal — e.g. "30", "45.5"
            try:
                clip_seconds = float(stripped)
                continue
            except ValueError:
                pass

            # Word number — e.g. "thirty", "sixty"
            if stripped in _WORD_TO_SECONDS and not tag:
                # Only treat as a number if it doesn't also resolve to a tag,
                # so "save five" means 5 seconds, not a failed tag match.
                clip_seconds = _WORD_TO_SECONDS[stripped]
                continue

            # Tag match (exact aliases + fuzzy)
            if not tag:
                tag = _match_tag(stripped)

        return ("save", tag, clip_seconds, full_save)

    if cmd == "play":
        play_idx = 0
        for i, tok in enumerate(tokens):
            if any(a in tok for a in _PLAY_ALIASES):
                play_idx = i
                break
        rest = " ".join(tokens[play_idx + 1:]).strip()
        return ("play", rest, 0, False)

    return (cmd, "", 0, False)
