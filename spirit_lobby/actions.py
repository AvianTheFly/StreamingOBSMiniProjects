"""Stateless lobby accent policy; delivery uses the Hub's existing SSE transport."""
import json
import re
import time
import uuid
from pathlib import Path


def catalog():
    return json.loads(Path(__file__).with_name('action-catalog.json').read_text(encoding='utf-8'))


def envelope(body):
    if not isinstance(body, dict):
        raise ValueError('Choose a lobby action.')
    action = body.get('action')
    if not isinstance(action, str) or action not in {item['id'] for item in catalog()}:
        raise ValueError('Unknown lobby action.')
    cue_id = body.get('id') or str(uuid.uuid4())
    if not isinstance(cue_id, str) or not re.fullmatch(r'[a-fA-F0-9-]{32,36}', cue_id):
        raise ValueError('Invalid action ID.')
    return {'id': cue_id, 'action': action, 'issuedAt': time.time()}
