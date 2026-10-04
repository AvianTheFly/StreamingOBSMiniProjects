"""Cache Riot Data Dragon champion icons for the local champ-select overlay."""
from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[1] / 'mini projects' / 'league_api'
BASE = 'https://ddragon.leagueoflegends.com'


def fetch(url):
    with urlopen(url, timeout=20) as response:
        return response.read()


def main():
    version = json.loads(fetch(BASE + '/api/versions.json'))[0]
    data = json.loads(fetch(f'{BASE}/cdn/{version}/data/en_US/champion.json'))['data']
    folder = ROOT / 'media' / 'champions'
    folder.mkdir(parents=True, exist_ok=True)
    portraits = ROOT / 'media' / 'champion-portraits'
    portraits.mkdir(parents=True, exist_ok=True)
    catalog = {str(int(item['key'])): {'name': item['name'], 'slug': item['id']}
               for item in data.values()}

    def save(entry):
        champion_id, item = entry
        target = folder / f'{champion_id}.png'
        if not target.is_file():
            content = fetch(f"{BASE}/cdn/{version}/img/champion/{item['slug']}.png")
            if not content.startswith(b'\x89PNG\r\n\x1a\n'):
                raise ValueError(f'Invalid icon for {champion_id}')
            temporary = target.with_suffix('.tmp')
            temporary.write_bytes(content)
            temporary.replace(target)
        portrait = portraits / f'{champion_id}.jpg'
        if not portrait.is_file():
            content = fetch(f"{BASE}/cdn/img/champion/loading/{item['slug']}_0.jpg")
            if not content.startswith(b'\xff\xd8'):
                raise ValueError(f'Invalid portrait for {champion_id}')
            temporary = portrait.with_suffix('.tmp')
            temporary.write_bytes(content)
            temporary.replace(portrait)

    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(save, entry) for entry in catalog.items()]
        for future in as_completed(futures):
            future.result()
    target = ROOT / 'champion_catalog.json'
    target.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Cached {len(catalog)} champion icons from Riot Data Dragon {version}')


if __name__ == '__main__':
    main()
