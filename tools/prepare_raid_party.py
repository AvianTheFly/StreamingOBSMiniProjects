"""Finite preparation of local silent raid dance atlases; originals stay intact."""
import json
from pathlib import Path
import re
import subprocess
import requests

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'mini projects/twitch_celebrations'
OUT = WEB / 'media'
SOURCES = {
    'toothless': 'https://tenor.com/view/toothless-dance-toothless-dance-toothless-dancing-meme-gif-transparent-gif-1646950359065166559',
    'mob': 'https://tenor.com/view/mob-psycho100-mob-anime-fortnite-default-dance-gif-16198946',
    'spin-cat': 'https://tenor.com/view/oiiai-cat-spinning-cat-gif-1612071084703334682',
    'dance-cat': 'https://tenor.com/view/%E7%8C%AB-%E8%B8%8A%E3%82%8B-gif-4389291444870408137',
}

def main():
    staging = ROOT / 'output/raid-party/sources'
    staging.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for name, page in SOURCES.items():
        response = requests.get(page, timeout=30)
        response.raise_for_status()
        urls = list(dict.fromkeys(re.findall(r'https://media[^\s"<>]+?\.gif', response.text)))
        if not urls:
            raise RuntimeError(f'No GIF on {page}')
        url = urls[0]
        data = requests.get(url, timeout=30)
        data.raise_for_status()
        original = staging / (name + '.gif')
        original.write_bytes(data.content)
        print(name, url, len(data.content), flush=True)
        # A clocked PNG atlas avoids unsynchronized GIFs and competing decoders.
        # Spin plays at half speed; lighting is authored separately without strobes.
        stretch = 'setpts=2*PTS,' if name == 'spin-cat' else ''
        key = ',colorkey=0x00ff00:0.30:0.10' if name == 'dance-cat' else ',colorkey=0xffffff:0.10:0.04' if name in ('toothless', 'spin-cat') else ''
        filters = stretch + 'fps=12,scale=160:160:force_original_aspect_ratio=decrease,format=rgba' + key + ',pad=160:160:(ow-iw)/2:(oh-ih)/2:color=0x00000000,tile=12x12'
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(original), '-vf', filters, '-frames:v', '1', str(OUT / ('raid-' + name + '.png'))], check=True)
        probe = subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(original)])
        duration = float(json.loads(probe)['format']['duration']) * (2 if name == 'spin-cat' else 1)
        manifest[name] = dict(file='raid-' + name + '.png', frames=min(144, max(1, int(duration * 12))), fps=12, size=160, columns=12, source=page, download=url)
    for name, filename in [('crab','crab-rave-dance.mp4'),('minions','minions-dance.mp4'),('tobey','tobey-dance.mp4'),('squidward','squidward-dab.mp4'),('pedro','pedro-dance.mp4')]:
        original = OUT / filename
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(original), '-t', '8', '-vf', 'fps=12,scale=160:160:force_original_aspect_ratio=decrease,format=rgba,pad=160:160:(ow-iw)/2:(oh-ih)/2:color=0x00000000,tile=12x12', '-frames:v', '1', str(OUT / ('raid-' + name + '.png'))], check=True)
        probe = subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(original)])
        duration = min(8, float(json.loads(probe)['format']['duration']))
        manifest[name] = dict(file='raid-' + name + '.png', frames=max(1, int(duration*12)), fps=12, size=160, columns=12, source='Existing local ' + filename)
    import shutil
    for source, destination in [('penguin.png', 'raid-penguin.png'), ('penguin-frames.json', 'raid-penguin-frames.json')]:
        shutil.copyfile(ROOT / 'hub_ui/app/spirit-lobby/art' / source, OUT / destination)
    (OUT / 'raid-dancers.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')

if __name__ == '__main__':
    main()
