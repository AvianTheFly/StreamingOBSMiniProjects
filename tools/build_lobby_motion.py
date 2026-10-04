"""Finite publisher of owner-authored web files and public rendering mechanics."""
from pathlib import Path
import hashlib
import json
import sys
ROOT=Path(__file__).resolve().parents[1]

def build():
    source=ROOT/'mini projects/scene_voice_switcher/web'
    target=ROOT/'hub_ui/app/lobby-motion'
    target.mkdir(parents=True,exist_ok=True)
    manifest={}
    for path in sorted(source.iterdir()):
        if path.suffix not in {'.js','.html','.css'}:continue
        content=path.read_bytes()
        (target/path.name).write_bytes(content)
        manifest[path.name]={'source':path.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(content).hexdigest()}
    shared=ROOT/'lib/browser_effects/web/world-motion.js'
    (target/'shared').mkdir(exist_ok=True)
    (target/'shared/world-motion.js').write_bytes(shared.read_bytes())
    manifest['shared/world-motion.js']={'source':shared.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(shared.read_bytes()).hexdigest()}
    (target/'build.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print('Published',len(manifest),'living-world files to',target)

if __name__=='__main__':build()
