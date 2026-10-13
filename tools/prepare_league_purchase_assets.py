"""Finite Data Dragon item-art installer and original soft cash-register cue.

No game polling or settings edits. All downloads finish before Hub gameplay.
"""
import io
import argparse
import json
import math
from pathlib import Path
import struct
import sys
import wave
from concurrent.futures import ThreadPoolExecutor
import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from lib.json_store import write_json


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--region',default='na',help='Data Dragon realm (default: na)')
    parser.add_argument('--version',help='Explicit item data version; otherwise use the regional realm')
    args=parser.parse_args()
    folder = ROOT / 'mini projects/league_api/media/purchases'
    folder.mkdir(parents=True, exist_ok=True)
    def fetch(url):
        r = requests.get(url, timeout=25)
        r.raise_for_status()
        return r
    realm_url=f'https://ddragon.leagueoflegends.com/realms/{args.region}.json'
    version = args.version or fetch(realm_url).json()['n']['item']
    base = f'https://ddragon.leagueoflegends.com/cdn/{version}'
    catalog = fetch(base + '/data/en_US/item.json').json()
    saved=folder/'catalog.json'
    same_version=saved.is_file() and json.loads(saved.read_text(encoding='utf-8')).get('version')==version
    def download(pair):
        identity, item = pair
        target = folder / f'{identity}.png'
        if same_version and target.is_file():
            return
        data = fetch(base + '/img/item/' + item['image']['full']).content
        Image.open(io.BytesIO(data)).verify()
        temporary=target.with_suffix('.download')
        temporary.write_bytes(data)
        temporary.replace(target)
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(download, catalog['data'].items()))
    write_json(folder / 'catalog.json', catalog)
    write_json(folder / 'provenance.json', dict(version=version,
               region=args.region, version_source='explicit' if args.version else realm_url,
               source=base + '/data/en_US/item.json', audio='Original synthesized two-part cash-register chime'))
    rate = 44100
    samples = []
    for i in range(int(rate * .65)):
        t = i / rate
        value = 0
        for delay, frequency, gain, decay in [(0, 1350, .18, 34), (.09, 2100, .26, 12), (.095, 3150, .08, 18)]:
            a = t - delay
            if a >= 0:
                value += gain * min(1, a / .003) * math.exp(-a * decay) * math.sin(2 * math.pi * frequency * a)
        samples.append(struct.pack('<h', int(max(-1, min(1, value)) * 32767)))
    with wave.open(str(folder / 'ka-ching.wav'), 'wb') as out:
        out.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
        out.writeframes(b''.join(samples))
    print(f'Prepared {len(catalog["data"])} item icons, Data Dragon {version}, and soft ka-ching.')


if __name__ == '__main__':
    main()
