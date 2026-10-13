"""Finite local raid cuts and measured beat score. Never loop or change originals."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'mini projects/twitch_celebrations'
# Spectral-onset measurements of these exact local recordings, not song-title BPMs.
# The Crab/Pedro sources repeat at 7.407/7.384 s; Nyan's phrase repeats at 6.760 s.
TRACKS = {
    'crab': ('crab-rave-party.mp3', 124.98, .370, [0,1,2,3,5,6,7,8,9,10,12]),
    'dragon': ('toothless-party.mp3', 134.94, .425, [0,1,2,3,5,7,8,9,10,11,13]),
    'cat': ('nyan-cat-party.mp3', 142.16, .060, [1,2,3,4,6,7,8,10,11,12,14]),
    'frog': ('pedro-party.mp3', 151.04, .050, [1,2,3,4,6,8,9,10,11,13,15]),
}
MOMENTS = [.65,1.13,1.71,2.1,3.35,4.2,4.48,4.9,5.28,6.22,7.24]


def main():
    ffmpeg = shutil.which('ffmpeg') or 'F:/ffmpeg/bin/ffmpeg.exe'
    score = {}
    for theme, (source, bpm, offset, indices) in TRACKS.items():
        beats = [round(offset+i*60/bpm, 6) for i in range(indices[-1]+1)]
        duration = round(beats[-1]+.42, 6)
        audio = f'raid-{theme}-single.wav'
        original = WEB/'media'/source
        subprocess.run([ffmpeg, '-v', 'error', '-y', '-i', str(original),
                        '-t', str(duration), '-af', f'afade=t=out:st={duration-.36}:d=0.36',
                        '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le',
                        str(WEB/'media'/audio)], check=True)
        score[theme] = dict(audio=audio, source=source,
                            source_sha256=hashlib.sha256(original.read_bytes()).hexdigest(),
                            bpm=bpm, beats=beats, duration=duration,
                            anchors=[[0,0]]+[[beats[i],moment] for i,moment in zip(indices,MOMENTS)]+[[duration,8]])
    (WEB/'raid_score.json').write_text(json.dumps(score, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({theme:s['duration'] for theme,s in score.items()}))


if __name__ == '__main__':
    main()
