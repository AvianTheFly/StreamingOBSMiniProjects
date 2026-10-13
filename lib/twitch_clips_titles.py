"""Readable public clip titles from a save label or current channel context."""
from datetime import datetime
import re


def _clean(value):
    text = re.sub(r'https?://\S+|www\.\S+', '', str(value or ''))
    return ' '.join(''.join(c for c in text if c.isprintable() or c.isspace()).split()).strip(' |–—-')


def clip_title(label='', *, channel=None, now=None):
    channel = channel or {}
    label = _clean(label)
    if label.casefold() in {'instant replay', 'stream highlight', 'untagged'}:
        label = ''
    subject = label or _clean(channel.get('title')) or 'Stream Highlight'
    category = _clean(channel.get('game_name'))
    context = f' — {category[:35]}' if category and category.casefold() not in subject.casefold() else ''
    moment = now or datetime.now().astimezone()
    stamp = moment.strftime('%b %d · %I:%M %p').replace(' 0', ' ')
    suffix = context + ' | ' + stamp
    budget = 100 - len(suffix)
    if len(subject) > budget:
        subject = subject[:budget - 1].rstrip(' |–—-') + '…'
    return subject + suffix
