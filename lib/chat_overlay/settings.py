"""Validated, independent chat preferences; never touch module/audio settings."""
import json
import re
import threading
from pathlib import Path
from urllib.parse import urlparse
from lib.paths import PROJECT_ROOT
from lib.json_store import write_json, json_transaction
from lib.settings_backups import SettingsBackups

PATH = PROJECT_ROOT / 'chat_overlay_settings.json'
LOCK = threading.RLock()
DEFAULTS = dict(channel='', theme='glass', font='Segoe UI', font_size=17,
                emote_size=34, opacity=32, max_messages=6, fade_seconds=60,
                accent='#76e4cf', motion=True, badges=True, hide_bots=True,
                hidden_users=['nightbot', 'streamelements', 'streamlabs'],
                replacements={}, show_header=False, focus_mode='auto',
                text_opacity=68, hover_opacity=94, natural_stickers=True, max_stickers=6,
                auto_start=False, message_gap=5, line_height=135)


def read():
    with LOCK, json_transaction(PATH):
        try:
            data = json.loads(PATH.read_text(encoding='utf-8'))
        except FileNotFoundError:
            data = {}
        if not isinstance(data, dict):
            raise ValueError('Chat settings are malformed; the personal file was preserved.')
        result = {**DEFAULTS, **data}
        if not result['channel']:
            import os
            result['channel'] = os.environ.get('TWITCH_CHANNEL', '').strip().lstrip('#').lower()
        return result


def image_url(value):
    if not isinstance(value, str) or len(value) > 2048:
        return False
    url = urlparse(value)
    return (url.scheme == 'https' and bool(url.netloc) and not url.username
            or value.startswith('/viewer_assets/') and '..' not in value)


def save(patch):
    with LOCK, json_transaction(PATH):
        result = read()
        if set(patch) - set(result) - set(DEFAULTS):
            raise ValueError('Unknown chat setting.')
        result.update(patch)
        channel = result['channel']
        if not isinstance(channel, str) or not re.fullmatch(r'[a-zA-Z0-9_]{1,25}', channel):
            raise ValueError('Enter a Twitch channel name (without a URL).')
        result['channel'] = channel.lower()
        if result['theme'] not in ('glass', 'minimal', 'neon'):
            raise ValueError('Unknown theme.')
        if result['focus_mode'] not in ('auto', 'game', 'desktop'):
            raise ValueError('Unknown readability mode.')
        if result['font'] not in ('Segoe UI', 'Arial', 'Verdana', 'Trebuchet MS', 'Consolas'):
            raise ValueError('Choose a supported font.')
        for name, low, high in [('font_size', 12, 32), ('emote_size', 20, 72),
                                ('opacity', 0, 90), ('max_messages', 1, 12),
                                ('fade_seconds', 0, 300), ('text_opacity', 55, 100),
                                ('hover_opacity', 55, 100), ('max_stickers', 1, 12),
                                ('message_gap', 0, 12), ('line_height', 115, 160)]:
            value = result[name]
            if isinstance(value, bool) or not isinstance(value, int) or not low <= value <= high:
                raise ValueError(f'{name} must be between {low} and {high}.')
        if not isinstance(result['accent'], str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', result['accent']):
            raise ValueError('Choose a valid accent color.')
        for key in ('motion', 'badges', 'hide_bots', 'show_header', 'natural_stickers', 'auto_start'):
            if not isinstance(result[key], bool):
                raise ValueError(f'{key} must be true or false.')
        users = result['hidden_users']
        if not isinstance(users, list) or len(users) > 100 or any(not isinstance(u, str) or not re.fullmatch(r'[a-zA-Z0-9_]{1,25}', u) for u in users):
            raise ValueError('Hidden users must be a list of Twitch usernames.')
        result['hidden_users'] = [u.lower() for u in users]
        replacements = result['replacements']
        if not isinstance(replacements, dict) or len(replacements) > 200:
            raise ValueError('Sticker replacements must be an object with at most 200 entries.')
        for word, url in replacements.items():
            if not isinstance(word, str) or not word.strip() or len(word) > 80 or any(ord(c) < 32 for c in word) or not image_url(url):
                raise ValueError('Each sticker needs a word or short phrase and an HTTPS image URL or /viewer_assets/ path.')
        SettingsBackups().snapshot()
        write_json(PATH, result)
        return result
