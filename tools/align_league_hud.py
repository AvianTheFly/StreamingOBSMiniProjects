"""Finite OBS calibration for the user's 2560x1440 League HUD at saved UI scale.

Run without arguments to build scene-sized masks; --apply updates only these
scenes' capture crops and existing mask settings after snapshotting settings.
Shared capture inputs, parent placement, audio, and other filters are preserved.
"""
import argparse
import json
from pathlib import Path
import sys

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

CENTERS = {'LeagueHUD': 2239, 'LeagueHUD3': 2330,
           'LeagueHUD2': 2421, 'LeagueHUD4': 2512}
TOP, WIDTH, HEIGHT = 928, 86, 111


def build_mask(center, path):
    # OBS scales each cropped capture uniformly into its 1920x1080 scene,
    # leaving transparent horizontal margins. Match that geometry exactly.
    supersample = 3
    scale = 1080 / HEIGHT
    offset = (1920 - WIDTH * scale) / 2
    left = center - WIDTH / 2
    mask = Image.new('L', (1920 * supersample, 1080 * supersample))
    draw = ImageDraw.Draw(mask)

    def box(coords):
        x1, y1, x2, y2 = coords
        return ((offset + (x1 - left) * scale) * supersample,
                (y1 - TOP) * scale * supersample,
                (offset + (x2 - left) * scale) * supersample,
                (y2 - TOP) * scale * supersample)

    # Gold portrait outline and its spell/status bubble. Preserve the actual
    # black empty bar interiors: color keying would remove useful HUD content.
    draw.ellipse(box((center-41.5, 940, center+41.5, 1023)), fill=255)
    draw.ellipse(box((center-15.5, 929, center+15.5, 960)), fill=255)
    draw.rectangle(box((center-36.5, 1007.5, center+36.5, 1037)), fill=255)
    mask.resize((1920, 1080), Image.Resampling.LANCZOS).convert('RGB').save(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    masks = ROOT / 'mini projects' / 'league' / 'hud_masks'
    masks.mkdir(exist_ok=True)
    for name, center in CENTERS.items():
        build_mask(center, masks / (name + '.png'))
    if not args.apply:
        print(f'Built {len(CENTERS)} calibrated masks in {masks}')
        return
    from lib.paths import load_project_env
    from lib.settings_backups import SettingsBackups
    load_project_env()
    SettingsBackups().snapshot()
    import obs
    client = obs.get_obs()
    before = {}
    for scene in (*CENTERS, 'leagueMAP'):
        before[scene] = {
            'items': client.send('GetSceneItemList', {'sceneName': scene}, raw=True),
            'filters': client.send('GetSourceFilterList', {'sourceName': scene}, raw=True)}
    backup = ROOT / 'output' / 'league-hud-20261002'
    backup.mkdir(exist_ok=True)
    # Never replace the original calibration recovery copy on a rerun.
    original = backup / 'calibration-original.json'
    if not original.exists():
        original.write_text(json.dumps(before, indent=2), encoding='utf-8')
    for scene, center in CENTERS.items():
        item = next(i for i in before[scene]['items']['sceneItems']
                    if i.get('inputKind') == 'monitor_capture')
        client.set_scene_item_transform(scene, item['sceneItemId'], {
            'cropLeft': center-WIDTH//2, 'cropRight': 2560-(center+WIDTH//2),
            'cropTop': TOP, 'cropBottom': 1440-(TOP+HEIGHT)})
        client.set_source_filter_settings(scene, 'Image Mask/Blend', {
            'image_path': (masks/(scene+'.png')).as_posix(),
            'type': 'mask_color_filter.effect', 'stretch': True}, overlay=True)
    item = next(i for i in before['leagueMAP']['items']['sceneItems']
                if i.get('inputKind') == 'monitor_capture')
    client.set_scene_item_transform('leagueMAP', item['sceneItemId'], {
        'cropLeft': 2173, 'cropTop': 1056, 'cropRight': 2, 'cropBottom': 2})
    print('Applied portrait/bar masks and map crop; separate scenes and all parent transforms preserved.')


if __name__ == '__main__':
    main()
