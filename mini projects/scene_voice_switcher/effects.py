"""Stateless action policy for the currently displayed living world."""
import json
import time
import uuid
from pathlib import Path
from .motion import WORLDS


def catalog(source):
    data = json.loads(Path(__file__).with_name('motion-actions.json').read_text(encoding='utf-8'))
    result = data.get(source, {'world': None, 'actions': []})
    if result['world'] != WORLDS.get(source):
        raise ValueError('Lobby action catalog needs rebuilding')
    return dict(result)


def envelope(source, action):
    data = catalog(source)
    if action not in {item['id'] for item in data['actions']}:
        raise ValueError('Choose an effect for this lobby')
    return {'id': str(uuid.uuid4()), 'source': source, 'world': data['world'],
            'action': action, 'issuedAt': time.time()}
