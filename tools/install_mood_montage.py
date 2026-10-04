"""Finite maintenance owner: collect publicly served still images on C:.

Copies originals without bitmap edits. Records source pages, hashes and sizes;
does not fetch movie/video files or start feature playback.
"""
import hashlib
import io
from pathlib import Path
import sys
import tempfile
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from lib.paths import ensure_import_paths
ensure_import_paths()
from lib.json_store import write_json
from love_me.assets import asset_root
from love_me.montage_catalog import SHOTS, shot_file


def main():
    from PIL import Image
    folder=asset_root().parent/'signal-montage'
    folder.mkdir(parents=True,exist_ok=True)
    shots=[]
    for shot in SHOTS:
        path=folder/shot_file(shot)
        if not path.exists():
            request=urllib.request.Request(shot['image'],headers={'User-Agent':'Mozilla/5.0'})
            with urllib.request.urlopen(request,timeout=25) as response:
                data=response.read(12*1024*1024+1)
            if len(data)>12*1024*1024:
                raise ValueError('Still exceeds image budget: '+shot['id'])
            with Image.open(io.BytesIO(data)) as picture:
                picture.verify()
            with tempfile.NamedTemporaryFile(dir=folder,delete=False,suffix='.image') as stream:
                temporary=Path(stream.name)
                stream.write(data)
            try:
                temporary.replace(path)
            finally:
                temporary.unlink(missing_ok=True)
        with Image.open(path) as picture:
            width,height=picture.size
        if width<600 or height<300:
            raise ValueError('Still is too small: '+shot['id'])
        shots.append({**shot,'file':shot_file(shot),'width':width,'height':height,
                      'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
        print(shot['id'],width,height,flush=True)
    write_json(folder/'montage.json',{'version':1,'reference_photo_opacity':.3488,'shots':shots})
    print('Montage ready:',folder)


if __name__=='__main__':
    main()
