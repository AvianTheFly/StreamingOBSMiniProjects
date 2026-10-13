"""Feature-owned command rotation and deadlines, sampled by the module lifetime.

No worker, chat socket or persistent command copy. Commands serializes access.
"""
import random
import time
from .policy import match, render

PRIORITY = ('!opgg', '!build', '!discord', '!8ball', '!commands')
TEXT_HINTS = {
    '!opgg': ('op.gg/', 'player profile'),
    '!rank': ('op.gg/', 'rank profile link'),
    '!lastgame': ('op.gg/', 'match history link'),
    '!build': ('guide', 'Udyr build guide'),
    '!runes': ('rune', 'rune guide'),
    '!discord': ('discord.gg/', 'join Discord'),
    '!socials': ('discord', 'social links'),
    '!specs': ('cpu:', 'PC specifications'),
    '!patch': ('patch-notes', 'League patch notes'),
}


def candidates(data, *, clips_ready=False):
    """Prove each advertised name matches a supported, usable handler and role."""
    result = []
    for row in data['commands']:
        permission = row.get('permission', 'everyone')
        if permission not in {'everyone', 'moderator'}:
            continue
        message = dict(channel=data['channel'], user='command_preview',
                       moderator=permission == 'moderator', text=row['command'])
        if match(data, message) is not row:
            continue
        kind = row.get('kind', 'text')
        if kind == 'clip':
            if not clips_ready:
                continue
        else:
            try:
                usable = kind in {'text', 'time', '8ball', 'index'} and render(row, data, message).strip()
            except (ValueError, LookupError):
                usable = False
            if not usable:
                continue
        result.append(row)
    return result


def describe(row):
    # Built-in descriptions follow the handler. Text commands show actual copy.
    if row.get('kind') == 'clip':
        return 'save a Twitch clip'
    if row.get('kind') in {'time', '8ball', 'index'}:
        return {'time': 'Eastern time', '8ball': 'ask the spirits', 'index': 'browse commands'}[row['kind']]
    text = ' '.join(row.get('response', '').split())
    hint = TEXT_HINTS.get(row['command'])
    if hint and hint[0] in text.lower():
        return hint[1]
    return text[:26].rstrip() + ('…' if len(text) > 26 else '')


def format_message(rows):
    parts = []
    for row in rows:
        role = 'Mods' if row.get('permission') == 'moderator' else 'Everyone'
        parts.append(f"{row['command']} ({role}): {describe(row)}")
    return '[COMMAND GUIDE] ' + ' | '.join(parts)


def runtime_ready(channel):
    """Use existing shared owners; offline/unknown state never announces."""
    from lib import twitch_chat
    from obs import get_stream_status
    try:
        chat = twitch_chat.status()
        return bool(chat.get('channel') == channel and chat.get('connected')
                    and chat.get('delivery', {}).get('ready')
                    and get_stream_status().get('active'))
    except Exception:
        return False


def clips_available():
    from lib.twitch_clip_session import clip_sessions
    session = clip_sessions.get()
    try:
        return bool(session and not session.stop.is_set() and session.available())
    except Exception:
        return False


class Announcements:
    def __init__(self, send, *, clock=time.monotonic, rng=None):
        self.send, self.clock = send, clock
        self.rng = rng or random.Random()
        self.due = None
        self.last = ''
        self.count = 0
        self.seen = {}

    def reset(self):
        self.due = None

    def snapshot(self):
        return dict(next_in_seconds=max(0, round(self.due-self.clock())) if self.due is not None else None,
                    queued=self.count, last_message=self.last)

    def wait_seconds(self):
        return min(30, max(.1, self.due-self.clock())) if self.due is not None else 30

    def tick(self, data, *, ready, clips_ready, allowed):
        if not ready or not data['enabled'] or not data.get('announcements_enabled', False):
            self.reset()
            return False
        now = self.clock()
        if self.due is None:
            self.due = now + self.rng.uniform(1800, 3600)
            return False
        if now < self.due:
            return False
        # Always move forward, including empty catalogs / unavailable delivery.
        # Never replay missed intervals or retry uncertain chat writes.
        self.due = now + self.rng.uniform(1800, 3600)
        rows = candidates(data, clips_ready=clips_ready)
        self.seen = {c['command']: self.seen.get(c['command'], 0) for c in rows}
        self.rng.shuffle(rows)
        rows.sort(key=lambda c: (self.seen[c['command']],
                  PRIORITY.index(c['command']) if not self.count and c['command'] in PRIORITY else len(PRIORITY)))
        selected = rows[:5]
        if not selected:
            return False
        text = format_message(selected)
        if self.send(data['channel'], text, allowed=allowed):
            self.count += 1
            for row in selected:
                self.seen[row['command']] = self.count
            self.last = text
            return True
        return False
