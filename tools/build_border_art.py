"""Finite self-contained art build. No Hub, settings, OBS or image edits.

PNG originals remain untouched. Embedding allows existing static module routes
to deliver artwork atomically without a new service or runtime HTTP route.
"""
import base64
import json
import os
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JOBS = [
    ('lib/browser_effects/art', 'sound-scenes.js', '../web/rave.js',
     {'momFrog': 'mom-frog-views.png', 'spamLizard': 'spam-lizard.png',
      'spamGary': 'spam-gary.png', 'spamQuack': 'spam-quack.png',
      'spamBonk': 'spam-bonk.png', 'spamPiuw': 'spam-piuw.png'}),
    ('mini projects/league_api/production/art', 'event-scenes.js', '../web/event-relics.js',
     {}),
    ('mini projects/twitch_celebrations/art', 'celebration-scenes.js', '../raid_art.js',
     {}),
]

def build():
    for directory, source, output, files in JOBS:
        base = ROOT / directory
        code = (base / source).read_text(encoding='utf-8')
        frames = base / source.replace('-scenes.js', '-frames.js')
        if '/* @FRAME_ART@ */' in code:
            code = code.replace('/* @FRAME_ART@ */', frames.read_text(encoding='utf-8'))
        if '/* @LIBRARY_ART@ */' in code:
            code = code.replace('/* @LIBRARY_ART@ */', (base / 'library-scenes.js').read_text(encoding='utf-8'))
        if '/* @CUE_ART@ */' in code:
            code = code.replace('/* @CUE_ART@ */', (base / 'cue-worlds.js').read_text(encoding='utf-8'))
        if '/* @MOM_FROG_ART@ */' in code:
            code = code.replace('/* @MOM_FROG_ART@ */', (base / 'mom-frog.js').read_text(encoding='utf-8'))
        if '/* @ARENA_ART@ */' in code:
            code = code.replace('/* @ARENA_ART@ */', (base / 'arena-legacy.js').read_text(encoding='utf-8'))
        if '/* @NIGHT_RUN_ART@ */' in code:
            code = code.replace('/* @NIGHT_RUN_ART@ */', (base / 'night-run.js').read_text(encoding='utf-8'))
        if '/* @HOORAY_ART@ */' in code:
            code = code.replace('/* @HOORAY_ART@ */', (base / 'hooray.js').read_text(encoding='utf-8'))
        if '/* @AUTHORED_CUES@ */' in code:
            code = code.replace('/* @AUTHORED_CUES@ */', (base / 'authored-cues.js').read_text(encoding='utf-8'))
        for name in ('ink', 'lizard', 'gary', 'quack', 'bonk', 'piuw', 'cues'):
            code = code.replace('/* @SPAM_' + name.upper() + '@ */',
                                (base / ('spam-' + name + '.js')).read_text(encoding='utf-8'))
        for name in ('frog', 'piuw'):
            marker = '/* @' + name.upper() + '_BORDER@ */'
            if marker in code:
                code = code.replace(marker, (base/(name+'-border.js')).read_text(encoding='utf-8'))
        for marker, filename in [('CUE_INK','cue-ink.js'),('CHARACTER_CUES','character-cues.js'),('REACTION_CUES','reaction-cues.js'),('CUE_ACCENTS','cue-accents.js'),('LIBRARY_TECH','library-tech.js'),('LIBRARY_PLAY','library-play.js'),('LIBRARY_MOOD','library-mood.js'),('LIBRARY_ACCENTS','library-accents.js')]:
            if '/* @' + marker + '@ */' in code:
                code = code.replace('/* @' + marker + '@ */', (base / filename).read_text(encoding='utf-8'))
        for marker, filename in [('EVENT_INK', 'event-ink.js'), ('ELEMENT_PERFORMANCES', 'element-performances.js'),
                                 ('VOID_PERFORMANCES', 'void-performances.js'), ('STRUCTURE_PERFORMANCES', 'structure-performances.js'),
                                 ('SOUL_PERFORMANCE', 'soul-performance.js'), ('EVENT_PROPS', 'event-props.js'),
                                 ('COMBAT_PERFORMANCES', 'combat-performances.js'), ('VITAL_PERFORMANCES', 'vital-performances.js'),
                                 ('PROGRESS_PERFORMANCES', 'progress-performances.js'), ('ECONOMY_PERFORMANCES', 'economy-performances.js'),
                                 ('LIFECYCLE_PERFORMANCES', 'lifecycle-performances.js'), ('INFERENCE_PERFORMANCES', 'inference-performances.js')]:
            if '/* @' + marker + '@ */' in code:
                code = code.replace('/* @' + marker + '@ */', (base / filename).read_text(encoding='utf-8'))
        for marker, filename in [('PARTY_INK','celebration-ink.js'), ('PARTY_PROPS','celebration-props.js'),
                                 ('SUPPORTER_PERFORMANCES','supporter-performances.js'),
                                 ('RAID_PERFORMANCES','raid-performances.js'), ('CHEER_PERFORMANCES','cheer-performances.js')]:
            if '/* @' + marker + '@ */' in code:
                code = code.replace('/* @' + marker + '@ */', (base / filename).read_text(encoding='utf-8'))
        if '/* @ATLAS_DATA@ */' in code:
            images = {key: 'data:image/png;base64,' + base64.b64encode((base / name).read_bytes()).decode('ascii')
                      for key, name in files.items()}
            code = code.replace('/* @ATLAS_DATA@ */', 'const ATLAS_DATA=' + json.dumps(images, separators=(',', ':')) + ';')
        result = code
        target = base / output
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=target.parent,
                                         prefix=target.name + '.', suffix='.tmp', delete=False) as stream:
            temporary = Path(stream.name)
            stream.write('// Generated by tools/build_border_art.py; edit art/' + source + '.\n' + result)
        try:
            os.replace(temporary, target)
        finally:
            if temporary.exists():
                temporary.unlink()
        print(f'Built {output}: {len(result):,} bytes')

if __name__ == '__main__':
    build()
