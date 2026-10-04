"""Mood-owned durable artwork copies; explicit browser publication at startup."""
import os
from pathlib import Path
from .montage_catalog import SHOTS, shot_file

FILES = ('ram-charge.png', 'bear-attack.png', 'phoenix-hero.png', 'turtle.png',
         'UnifrakturCook-Bold.ttf', 'OFL.txt')
FILES += tuple(name+'-Regular.ttf' for name in
               ('CourierPrime','RubikDirt','RubikWetPaint','RubikBurned','BungeeShade','MetalMania','Eater'))


def asset_root():
    return Path(os.environ.get('LOCALAPPDATA', Path.home()/'AppData/Local'))/'StreamingHub/mood-cues/signal-v2'


def browser_files():
    root = asset_root()
    files={name: root/name for name in FILES if (root/name).is_file()}
    montage=root.parent/'signal-montage'
    for name in ['montage.json',*(shot_file(shot) for shot in SHOTS)]:
        if (montage/name).is_file():
            files[name]=montage/name
    return files
