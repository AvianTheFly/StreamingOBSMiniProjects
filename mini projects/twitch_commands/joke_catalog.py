"""Validated one-message jokes and durable no-repeat history."""
import json
from pathlib import Path
from lib.json_store import update_json

CATALOG = Path(__file__).with_name('jokes.json')
HISTORY = Path(__file__).with_name('joke_history.json')


def read(path=CATALOG):
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    rows = data.get('jokes')
    if type(data.get('enabled')) is not bool or not isinstance(rows,list) or not 2 <= len(rows) <= 500:
        raise ValueError('Joke catalog needs an enabled switch and 2–500 entries.')
    ids, texts = set(), set()
    for row in rows:
        identity, text = row.get('id'), row.get('text')
        if (not isinstance(identity,str) or not identity or identity in ids or
                not isinstance(text,str) or not text.strip() or len(text)>300 or
                any(ord(c)<32 for c in text) or text.lstrip().startswith(('/', '.')) or text in texts):
            raise ValueError('Jokes need unique IDs and unique plain single-line messages under 301 characters.')
        ids.add(identity); texts.add(text)
    return data


def reserve(rows, path, rng):
    """Reserve before enqueue: uncertain writes are never replayed after a crash."""
    selected = []
    def edit(current):
        if not isinstance(current,dict) or not isinstance(current.get('used',[]),list):
            raise ValueError('Joke history is malformed; preserved without sending.')
        used = current.get('used',[])
        if any(not isinstance(x,str) for x in used):
            raise ValueError('Joke history is malformed; preserved without sending.')
        known = {r['id'] for r in rows}
        used = list(dict.fromkeys(x for x in used if x in known))
        available = [r for r in rows if r['id'] not in used]
        if not available:
            used = []
            available = [r for r in rows if r['id'] != current.get('last')]
        row = rng.choice(available)
        selected.append(row)
        return {**current,'used':[*used,row['id']],'last':row['id']}
    update_json(path,edit,default={})
    return selected[0]
