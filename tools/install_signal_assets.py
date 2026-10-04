"""Finite maintenance owner: copy approved spirit art into Mood cues' C: store."""
import hashlib
import json
from pathlib import Path
import shutil
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from lib.paths import ensure_import_paths
ensure_import_paths()
from love_me.assets import asset_root, FILES


def main():
    target = asset_root()
    target.mkdir(parents=True, exist_ok=True)
    source = ROOT/'mini projects/twitch_celebrations/spirit_assets'
    manifest = {'version':2, 'files':{}}
    for name in FILES:
        path = target/name
        if not path.exists():
            if name.endswith('.png'):
                shutil.copy2(source/name, path)
            else:
                urllib.request.urlretrieve('https://raw.githubusercontent.com/google/fonts/main/ofl/unifrakturcook/'+name, path)
        manifest['files'][name] = {'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                                  'source':str(source/name) if name.endswith('.png') else 'Google Fonts / UnifrakturCook (OFL.txt)'}
    from lib.json_store import write_json
    write_json(target/'manifest.json', manifest)
    print('Signal assets ready:',target)


if __name__ == '__main__':
    main()
