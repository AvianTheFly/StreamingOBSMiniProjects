"""Authored selection and personal persistence for the animated chaos library."""
import json
import re
from pathlib import Path

from lib.json_store import json_transaction, write_json
from lib.paths import PROJECT_ROOT
from lib.settings_backups import SettingsBackups

PATH = PROJECT_ROOT / 'chat_sticker_pack.json'
REQUESTED = '''chunguswaga RaveTime ALERT SALAMIhand AAAA ADHD ABDULpls Ahri AlienPls3 alcoholic ApuChaCha BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAT BabyRave baffyPov BANGER beePls binocularsSpin bitch BearHug blalalala BongTime BlobDance caramellPls catRAVE catJAM catKISS catpls cannySilly catDisco CatGuitar Cheergi COCKA crabPls dance Dance deadass dansi danse dani dancer Drill DONUT DROOL EDM glorprave fucking h Headbang haha hyperEDM HYPERCATJAM Jigglin jorkin juh modCheck Nerd MONKE Milk NOOOO NOPERS NOTED PartyPug PartyKirby partE peepoDJ PeepoG2 peepoGiggles peepoSitPizza SCHIZO WAYTOODANK wagang wow WonBet zyzzRave borpaSpin'''.split()
# Keep the requested memes and the large animated inventory suited to this pack.
# Other unrelated adult-themed entries in the source set aren't part of its theme.
UNRELATED = re.compile(r'cum|penis|cock|pussy|sex|wank|fap|masturb|goon|coom|thrust|booba|gawk|buss|twerk|retard', re.I)
THEMES = ('rave', 'dance', 'jam', 'EDM', 'party', 'spin', 'headbang', 'hyper', 'wiggle', 'disco')
ENERGY_ALIASES = {
    'rave': 'RaveTime', 'raving': 'RaveTime', 'rave time': 'RaveTime', 'lets rave': 'BabyRave',
    'let’s rave': 'BabyRave', "let's rave": 'BabyRave', 'party time': 'PartyKirby',
    'party mode': 'PartyPug', 'dance party': 'BlobDance', 'dance break': 'catDisco',
    'dancing': 'dance', 'dancin': 'dansi', 'boogie': 'ApuChaCha', 'boogy': 'ApuChaCha',
    'headbanging': 'Headbang', 'head bang': 'Headbang', 'metal': 'Headbang',
    'edm': 'EDM', 'techno': 'hyperEDM', 'bass': 'hyperEDM', 'drop the bass': 'hyperEDM',
    'bass drop': 'HYPERCATJAM', 'beat drop': 'HYPERCATJAM', 'beatdrop': 'HYPERCATJAM',
    'hardstyle': 'zyzzRave', 'eurobeat': 'caramellPls', 'caramelldansen': 'caramellPls',
    'disco': 'catDisco', 'dj': 'peepoDJ', 'dj time': 'peepoDJ', 'spin': 'borpaSpin',
    'spinning': 'binocularsSpin', 'nyoom': 'binocularsSpin', 'zoomies': 'HYPERCATJAM',
    'hyper': 'hyperEDM', 'chaos': 'ADHD', 'chaotic': 'ADHD', 'crazy': 'SCHIZO',
    'going crazy': 'ADHD', 'losing it': 'AAAA', 'aaaaaaaa': 'AAAA',
    'aaaa': 'AAAA', 'adhd': 'ADHD', 'full send': 'RaveTime', 'send it': 'RaveTime',
    'max energy': 'ADHD', 'big energy': 'BANGER', 'absolute banger': 'BANGER',
    'banging': 'BANGER', 'certified banger': 'BANGER', 'vibing hard': 'catRAVE',
    'monke': 'MONKE', 'salami': 'SALAMIhand', 'chungus': 'chunguswaga',
    'baby rave': 'BabyRave', 'dance with me': 'PartyKirby', 'rave cat': 'catRAVE',
    'rave dog': 'PartyPug', 'kirby party': 'PartyKirby', 'bear hug': 'BearHug',
    'hug the bear': 'BearHug', 'alien party': 'AlienPls3', 'crab rave': 'crabPls',
}


def category(code):
    name = code.lower()
    for label, words in [('Rave / EDM', ('rave', 'edm', 'bass', 'dj', 'disco', 'party')),
                         ('Dance / jam', ('dance', 'dans', 'jam', 'pls', 'guitar', 'headbang', 'boogie', 'wiggle', 'strut')),
                         ('Spin / hyper', ('spin', 'hyper', 'adhd', 'shake', 'jiggl', 'overheat')),
                         ('Animals', ('cat', 'dog', 'pug', 'bear', 'monk', 'kirby', 'bee', 'frog', 'rat', 'duck', 'glorp'))]:
        if any(word in name for word in words):
            return label
    return 'Chaos / reactions'


def build(kesha, searches):
    selected = {}
    for entry in kesha['emote_set']['emotes']:
        code, data = entry['name'], entry['data']
        if not data.get('animated') or len(code) > 80 or code.startswith('!'):
            continue
        if code not in REQUESTED and (UNRELATED.search(code) or UNRELATED.search(data.get('name', ''))):
            continue
        files = data.get('host', {}).get('files', [])
        file = next((f for f in files if f['name'] == '2x.webp' and f.get('frame_count', 0) > 1), None)
        if not file:
            continue
        base = 'https:' + data['host']['url'] if data['host']['url'].startswith('//') else data['host']['url']
        selected[code] = dict(id=data['id'], url=base + '/' + file['name'],
                              static_url=base + '/' + file['static_name'], animated=True,
                              frames=file['frame_count'], size=file.get('size', 0),
                              zero_width=bool(entry.get('flags', 0) & 1 or data.get('flags', 0) & 256),
                              provider='7TV · Chaos pack', source='KeshaEuw', category=category(code))
    known = {asset['id'] for asset in selected.values()}
    for theme in THEMES:
        for data in searches.get(theme, []):
            if data['id'] in known or data['flags'].get('nsfw') or UNRELATED.search(data['defaultName']):
                continue
            files = data['images']
            file = next((f for f in files if f['scale'] == 2 and f['mime'] == 'image/webp' and f['frameCount'] > 1), None)
            still = next((f for f in files if f['scale'] == 2 and f['mime'] == 'image/webp' and f['frameCount'] == 1), None)
            if not file or not still:
                continue
            original = data['defaultName']
            if not re.fullmatch(r'[\w-]{2,60}', original):
                continue
            code = original
            number = 2
            while code in selected:
                code = f'{original}_{number:02d}'
                number += 1
            selected[code] = dict(id=data['id'], url=file['url'], static_url=still['url'], animated=True,
                                  frames=file['frameCount'], size=file['size'],
                                  zero_width=data['flags'].get('defaultZeroWidth', False),
                                  provider='7TV · Chaos pack', source='7TV discovery', category=category(theme),
                                  original_code=original)
            known.add(data['id'])
    missing = [code for code in REQUESTED if code not in selected]
    if missing:
        raise ValueError(f'Requested animated stickers missing: {missing}')
    # Unambiguous spellings bypass a personal phrase alias with the same name.
    # Existing replacements remain user data (e.g. their older "haha" rule).
    for code in REQUESTED:
        selected['Kesha_' + code] = {**selected[code], 'original_code': code}
    return dict(schema=1, title='Rave & Chaos', emotes=selected, aliases=ENERGY_ALIASES,
                sources=[dict(channel='keshaeuw', url='https://www.twitch.tv/keshaeuw',
                              set_id=kesha['emote_set']['id'],
                              set_url='https://7tv.app/emote-sets/' + kesha['emote_set']['id'])],
                requested=REQUESTED)


def read():
    with json_transaction(PATH):
        try:
            result = json.loads(PATH.read_text(encoding='utf-8'))
        except FileNotFoundError:
            return dict(title='Rave & Chaos', emotes={}, aliases={})
        if not isinstance(result, dict) or not isinstance(result.get('emotes'), dict) or not isinstance(result.get('aliases', {}), dict):
            raise ValueError('Sticker pack is malformed; the personal file was preserved.')
        return result


def install(pack):
    with json_transaction(PATH):
        current = read()
        merged = {**current, **pack, 'emotes': {**pack['emotes'], **current['emotes']},
                  'aliases': {**pack.get('aliases', {}), **current.get('aliases', {})}}
        SettingsBackups().snapshot()
        write_json(PATH, merged)
        return merged


def catalog_entries():
    pack = read()
    emotes = pack['emotes']
    aliases = {alias: emotes[code]['url'] for alias, code in pack.get('aliases', {}).items() if code in emotes}
    return emotes, aliases, pack.get('title', 'Rave & Chaos')
