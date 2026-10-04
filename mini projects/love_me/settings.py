"""Lossless variation persistence and atomic user-audio import."""
import base64
import hashlib
import json
import math
from pathlib import Path
import re
import tempfile

from lib.json_store import json_transaction, update_json
from lib.settings_backups import SettingsBackups
from .catalog import presets
from .assets import asset_root

ROOT = Path(__file__).resolve().parent
FILE = ROOT/'variations.json'
EXTENSIONS = {'.mp3', '.wav', '.ogg', '.m4a'}
MAX_AUDIO = 20 * 1024 * 1024


class Conflict(ValueError):
    pass


def _raw(path):
    if not path.exists():
        return {'variations': {}}
    value = json.loads(path.read_text(encoding='utf-8-sig'))
    if not isinstance(value, dict) or not isinstance(value.get('variations'), dict):
        raise ValueError('Variations settings need repair; the original file has been preserved.')
    if any(not isinstance(row, dict) for row in value['variations'].values()):
        raise ValueError('A saved variation is malformed; the original file has been preserved.')
    return value


def revision(raw):
    return hashlib.sha256(json.dumps(raw, sort_keys=True).encode()).hexdigest()[:20]


def validate(row):
    if not re.fullmatch(r'[a-z][a-z0-9_]{0,47}', row.get('id', '')):
        raise ValueError('Invalid variation ID.')
    if not isinstance(row.get('name'), str) or not 1 <= len(row['name'].strip()) <= 80:
        raise ValueError('Give this variation a name (up to 80 characters).')
    key = row.get('hotkey', '')
    if not isinstance(key, str) or key == '987' or (key and (not 2 <= len(key) <= 8 or not key.isascii() or not key.isalnum())):
        raise ValueError('Use a 2–8 letter/digit sequence; 987 belongs to the original Love Me.')
    if row.get('style') not in {'signal','heart','golden','afterglow'}:
        raise ValueError('Unknown artwork direction.')
    if row.get('mode') not in {'once','repeat','continuous'} or row.get('position') not in {'top','left','right'}:
        raise ValueError('Unknown playback mode or placement.')
    for field, low, high in [('duration',4,60),('bpm',40,200),('opacity',.1,1),('scale',.5,1.15),
                             ('audio_start',0,14400),('audio_anchor',0,60),('audio_rate',.5,2),
                             ('volume_db',-60,6),('repeats',2,20),('lyric_offset',-30,30),
                             ('font_interval',.07,.5),('hold_fade',.2,3)]:
        value = row.get(field)
        if isinstance(value, bool) or not isinstance(value, (int,float)) or not math.isfinite(value) or not low <= value <= high:
            raise ValueError(f'{field.replace("_"," ")} must be between {low} and {high}.')
    cues=row.get('lyric_cues')
    onset=row.get('image_onset')
    if onset is not None and (isinstance(onset,bool) or not isinstance(onset,(int,float)) or not math.isfinite(onset) or not 0<=onset<=14400):
        raise ValueError('Image hit must be original-file seconds, or empty to follow the first word.')
    if not isinstance(cues,list) or len(cues)>150:
        raise ValueError('Use up to 150 timed words.')
    last_end=-1
    for cue in cues:
        if not isinstance(cue,dict) or not isinstance(cue.get('text'),str) or not 1<=len(cue['text'])<=60:
            raise ValueError('Each timed word needs short text.')
        start,end=cue.get('start'),cue.get('end')
        if any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) for v in (start,end)) or not 0<=start<end<=14400 or start<last_end:
            raise ValueError('Word cues need ordered, non-overlapping start/end times in original-file seconds.')
        last_end=end
    if int(row['repeats']) != row['repeats']:
        raise ValueError('Repeats must be a whole number.')
    if row['audio_anchor'] >= row['duration']:
        raise ValueError('The cue anchor must be inside the excerpt.')
    if not isinstance(row.get('words'), list) or len(row['words']) != 3 or any(not isinstance(w,str) or len(w)>60 for w in row['words']):
        raise ValueError('Use three short text lines (up to 60 characters each).')
    for key in ('record_audio','reduced_motion'):
        if not isinstance(row.get(key), bool):
            raise ValueError(f'{key} must be true or false.')
    if not isinstance(row.get('audio_file'), str):
        raise ValueError('Audio file must be a path.')
    return row


class VariationStore:
    def __init__(self, root=ROOT, *, media_root=None):
        self.root = Path(root)
        self.path = self.root/'variations.json'
        self.media_root = (Path(media_root) if media_root is not None else
                           asset_root().parent/'audio' if self.root.resolve()==ROOT else self.root/'audio')

    def snapshot(self):
        with json_transaction(self.path):
            raw = _raw(self.path)
            rows = {row['id']:row for row in presets()}
            for key, value in raw['variations'].items():
                rows[key] = {'image_onset':None,'lyric_cues':[],'lyric_offset':0,'font_interval':.12,'hold_fade':.75,
                             **rows.get(key, {}), **value, 'id':key}
            keys = set()
            for row in rows.values():
                validate(row)
                key = row['hotkey'].lower()
                if key and key in keys:
                    raise ValueError('Two mood variations use the same hotkey. Saved data was preserved.')
                keys.add(key)
            return {'revision':revision(raw), 'variations':list(rows.values())}

    def get(self, identity):
        row = next((r for r in self.snapshot()['variations'] if r['id']==identity), None)
        if row is None:
            raise ValueError('Unknown variation.')
        return row

    def audio_path(self, row):
        value = row['audio_file']
        if not value:
            matches = [p for p in (self.root/'audio').glob(row['id']+'.*') if p.suffix.lower() in EXTENSIONS]
            if len(matches)>1:
                raise ValueError('Multiple audio files match this variation. Choose one in the editor.')
            return matches[0] if matches else None
        path = Path(value)
        path = path if path.is_absolute() else self.root/path
        if path.suffix.lower() not in EXTENSIONS or not path.is_file():
            raise ValueError('Audio file is missing or unsupported. Choose MP3, WAV, OGG or M4A.')
        return path.resolve()

    def save(self, body):
        identity = str(body.get('id',''))
        changes = body.get('changes')
        if not isinstance(changes, dict):
            raise ValueError('Expected variation edits.')
        editable = {'name','hotkey','mode','repeats','opacity','scale','position','reduced_motion',
                    'words','duration','bpm','audio_file','audio_start','audio_anchor','audio_rate','volume_db','record_audio',
                    'image_onset','lyric_cues','lyric_offset','font_interval','hold_fade'}
        if set(changes)-editable:
            raise ValueError('Unknown variation control.')
        SettingsBackups().snapshot()
        with json_transaction(self.path):
            current = self.snapshot()
            if body.get('revision') != current['revision']:
                raise Conflict('Settings changed. Reload before saving your edits.')
            if identity not in {r['id'] for r in current['variations']}:
                clone = body.get('clone_from')
                row = {**self.get(clone), 'id':identity, 'hotkey':''}
            else:
                row = self.get(identity)
            row = validate({**row, **changes})
            if row['hotkey'] and any(r['id']!=identity and r['hotkey'].lower()==row['hotkey'].lower() for r in current['variations']):
                raise ValueError('That hotkey already belongs to another mood variation.')
            def update(raw):
                raw = raw if raw is not None else {'variations':{}}
                raw['variations'][identity] = {**raw['variations'].get(identity,{}), **row}
                return raw
            update_json(self.path, update, default={'variations':{}})
            return self.snapshot()

    def import_audio(self, body):
        row = self.get(body.get('id'))
        extension = Path(str(body.get('filename',''))).suffix.lower()
        if extension not in EXTENSIONS:
            raise ValueError('Choose MP3, WAV, OGG or M4A audio.')
        try:
            data = base64.b64decode(body.get('data',''), validate=True)
        except (ValueError,TypeError) as exc:
            raise ValueError('Invalid audio upload.') from exc
        if not 0 < len(data) <= MAX_AUDIO:
            raise ValueError('Choose an audio file smaller than 20 MB.')
        folder = self.media_root
        folder.mkdir(parents=True, exist_ok=True)
        name = row['id']+'-'+hashlib.sha256(data).hexdigest()[:16]+extension
        with tempfile.NamedTemporaryFile(dir=folder, suffix=extension, delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(data)
        try:
            temporary.replace(folder/name)
            stored=folder/name
            try:
                value=stored.relative_to(self.root).as_posix()
            except ValueError:
                value=str(stored.resolve())
            return self.save(dict(id=row['id'], revision=body.get('revision'), changes={'audio_file':value}))
        finally:
            temporary.unlink(missing_ok=True)
