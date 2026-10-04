"""Finite maintenance owner: install seven OFL typefaces with their licenses on C:."""
import hashlib
from pathlib import Path
import sys
import tempfile
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from lib.paths import ensure_import_paths
ensure_import_paths()
from love_me.assets import asset_root
from lib.json_store import write_json

FONTS=['CourierPrime','RubikDirt','RubikWetPaint','RubikBurned','BungeeShade','MetalMania','Eater']

def main():
    folder=asset_root();folder.mkdir(parents=True,exist_ok=True)
    records=[]
    for name in FONTS:
        source=f'https://raw.githubusercontent.com/google/fonts/main/ofl/{name.lower()}/'
        for filename,remote in [(name+'-Regular.ttf',name+'-Regular.ttf'),(name+'-OFL.txt','OFL.txt')]:
            path=folder/filename
            if not path.exists():
                with urllib.request.urlopen(source+remote,timeout=20) as response:data=response.read(2*1024*1024+1)
                if len(data)>2*1024*1024:raise ValueError('Font exceeds bounded asset size.')
                if remote.endswith('.ttf') and data[:4] not in [b'\x00\x01\x00\x00',b'OTTO']:raise ValueError('Invalid font asset.')
                with tempfile.NamedTemporaryFile(dir=folder,delete=False) as handle:
                    handle.write(data);temp=Path(handle.name)
                temp.replace(path)
            records.append({'file':filename,'source':source+remote,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
        print(name,flush=True)
    write_json(folder/'font-provenance.json',{'fonts':records,'license':'SIL Open Font License 1.1; individual licenses included.'})

if __name__=='__main__':main()
