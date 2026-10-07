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
    for path in sorted(source.rglob('*')):
        if path.suffix not in {'.js','.html','.css','.png','.webp'}:continue
        content=path.read_bytes()
        relative=path.relative_to(source)
        (target/relative).parent.mkdir(parents=True,exist_ok=True)
        (target/relative).write_bytes(content)
        manifest[relative.as_posix()]={'source':path.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(content).hexdigest()}
    (target/'shared').mkdir(exist_ok=True)
    for name in ('world-motion.js','display-frame.js'):
        shared=ROOT/'lib/browser_effects/web'/name
        (target/'shared'/name).write_bytes(shared.read_bytes())
        manifest['shared/'+name]={'source':shared.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(shared.read_bytes()).hexdigest()}
    (target/'build.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print('Published',len(manifest),'living-world files to',target)

if __name__=='__main__':build()
