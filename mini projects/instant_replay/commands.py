"""Pure replay grammar: leading actions, shared capture options, literal names."""
from __future__ import annotations

import difflib
import math
import re
from .config import SAVE_TAG_ALIASES

NO_COMMAND = (None, '', 0, False)
# Compatibility is confined to whole leading words, never substrings of speech.
_VERBS = {
    'save': ('save', 'saved', 'safe'),
    'mark': ('mark', 'marked', 'marc'),
    'play': ('play', 'playing', 'played'),
}
_SHORTCUTS = {
    'replay': ('play', 'replay'), 'instant replay': ('play', 'replay'), 'show replay': ('play', 'replay'),
    'clip': ('play', 'last'), 'play clip': ('play', 'last'), 'latest clip': ('play', 'last'),
    'showcase': ('play', 'showcase'), 'showcase clip': ('play', 'showcase'), 'showcase latest': ('play', 'showcase'),
    'random': ('play', 'random'), 'random replay': ('play', 'random'), 'random clip': ('play', 'random'),
    'surprise me': ('play', 'random'),
    'next': ('next', ''), 'skip': ('next', ''), 'next clip': ('next', ''), 'skip clip': ('next', ''),
    **{s: ('stop', '') for s in ('stop', 'stop replay', 'leave', 'leave replay', 'exit', 'exit replay', 'end replay', 'cancel replay', 'quit replay')},
    **{s: ('pause', '') for s in ('pause', 'pause replay')},
    **{s: ('resume', '') for s in ('resume', 'resume replay', 'continue replay')},
    **{s: ('screen', 'on') for s in ('screen on', 'show screen', 'show desktop', 'desktop on')},
    **{s: ('screen', 'off') for s in ('screen off', 'hide screen', 'hide desktop', 'desktop off')},
    **{s: ('view', 'live') for s in ('live view on', 'show live view', 'live view')},
}
_QUICK = ('replay now', 'quick replay', 'replay that', 'replay only', 'replay this moment')
_NUMBERS = dict(zip(('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty').split(), range(1, 21)))
_NUMBERS.update(twenty=20, thirty=30, forty=40, fifty=50, sixty=60, seventy=70, eighty=80, ninety=90, hundred=100)


def _match_tag(token: str) -> str:
    """Keep personal tag aliases; matching is whole-word with bounded fuzziness."""
    token = token.lower().strip(".,!?;:\"'")
    for tag, aliases in SAVE_TAG_ALIASES.items():
        if token == tag or token in aliases:
            return tag
    aliases = {a: tag for tag, group in SAVE_TAG_ALIASES.items() for a in group if len(a) >= 4}
    close = difflib.get_close_matches(token, aliases, n=1, cutoff=.78) if len(token) >= 4 else []
    return aliases[close[0]] if close else ''


def _number(tokens: list[str]) -> float | None:
    if len(tokens) == 1:
        try:
            return float(tokens[0])
        except ValueError:
            return _NUMBERS.get(tokens[0])
    if len(tokens) == 2 and tokens[0] in _NUMBERS and tokens[1] in _NUMBERS:
        tens, ones = _NUMBERS[tokens[0]], _NUMBERS[tokens[1]]
        if tens >= 20 and tens % 10 == 0 and ones < 10:
            return tens + ones
        if ones == 100 and tens < 10:
            return tens * 100
    return None


def _capture_options(rest: str):
    """Invalid/ambiguous options fail closed instead of silently saving defaults."""
    named = re.search(r'\b(?:name|named)\b\s*:?\s*', rest, re.IGNORECASE)
    label = ''
    if named:
        label = ''.join(c for c in rest[named.end():] if c.isprintable()).strip(" .,!?;:\"'")[:160].rstrip()
        if not label:
            return None
        rest = rest[:named.start()]
    tokens = [word.strip(",!?;:\"'") for word in
              re.sub(r'(?<=[a-z])-(?=[a-z])', ' ', rest.lower()).strip(" .,!?;:").split()]
    tag, seconds, full = '', 0, False
    while tokens:
        word = tokens.pop(0)
        if word in ('full', 'whole', 'entire', 'all', 'everything'):
            if full or seconds:
                return None
            full = True
            continue
        if word in ('second', 'seconds', 'buffer', 'replay'):
            if (word in ('second', 'seconds') and seconds) or (word in ('buffer', 'replay') and full):
                continue
            return None
        value = _number([word, tokens[0]]) if tokens else None
        if value is not None:
            tokens.pop(0)
        else:
            value = _number([word])
        if value is not None:
            if tokens and tokens[0] in ('minute', 'minutes'):
                tokens.pop(0)
                value *= 60
            if not math.isfinite(value) or not 3 <= value <= 120 or seconds or full:
                return None
            seconds = value
            continue
        matched = _match_tag(word)
        if not matched or tag:
            return None
        tag = matched
    return label or tag, seconds, full


def parse_command(text: str) -> tuple[str | None, str, float, bool]:
    """Return (action, selection/title, seconds, full); no runtime side effects.

    mark/save/replay now share [seconds|full] [tag] [name literal title].
    Save and replay accepts the same options. Play preserves its entire target.
    Unnamed legacy tags and concise shortcuts remain compatible.
    """
    spoken = ' '.join(text.strip().split()).rstrip('.,!?;:')
    lowered = spoken.lower()
    if lowered in _SHORTCUTS:
        action, spec = _SHORTCUTS[lowered]
        return action, spec, 0, False
    if re.match(r'^name(?:d)?\b', lowered):
        options = _capture_options(spoken)
        return ('save', *options) if options else NO_COMMAND
    for phrase in _QUICK:
        matched = re.match(re.escape(phrase) + r'(?=$|[\s,.:!?;])[\s,.:!?;]*', spoken, re.IGNORECASE)
        if matched:
            options = _capture_options(spoken[matched.end():])
            if options:
                label, seconds, full = options
                return 'quick_replay', label, seconds or (0 if full else 15), full
            return NO_COMMAND
    word, _, rest = spoken.partition(' ')
    action = next((a for a, aliases in _VERBS.items() if word.lower().rstrip('.,!?;:') in aliases), None)
    if action == 'play':
        spec = rest.lower()
        if spec in ('a random replay', 'a random clip', 'random replay', 'random clip'):
            spec = 'random'
        elif spec in ('latest', 'latest clip', 'last clip'):
            spec = 'last'
        return 'play', spec, 0, False
    if action in ('save', 'mark'):
        # Only interpret "and replay" before a literal name.
        name = re.search(r'\bname(?:d)?\b', rest, re.IGNORECASE)
        boundary = name.start() if name else len(rest)
        policy, title = rest[:boundary], rest[boundary:]
        combined = re.search(r'(?:\band|\bthen|&)\s+(?:replay|play)\b', policy, re.IGNORECASE)
        if action == 'save' and combined:
            action = 'save_replay'
            rest = (policy[:combined.start()] + policy[combined.end():] + ' ' + title).strip()
        options = _capture_options(rest)
        return (action, *options) if options else NO_COMMAND
    return NO_COMMAND
