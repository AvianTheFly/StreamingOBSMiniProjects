"""Finite asset preparation: copy the user's existing lobby poses without edits."""
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
NAMES = ('kirby', 'goose', 'crewmate', 'climber', 'hornet', 'boo', 'creeper', 'salvager')


def main():
    source = ROOT / 'mini projects/scene_voice_switcher/web/art/prepared'
    target = ROOT / 'mini projects/twitch_celebrations/media'
    records = []
    for name in NAMES:
        for pose in range(3):
            original = source / f'game-{name}-{pose}.png'
            destination = target / f'raid-game-{name}-{pose}.png'
            digest = hashlib.sha256(original.read_bytes()).hexdigest()
            if destination.exists():
                if hashlib.sha256(destination.read_bytes()).hexdigest() != digest:
                    raise RuntimeError(f'Preserve existing changed asset: {destination}')
            else:
                shutil.copy2(original, destination)
            records.append({'file': destination.name, 'source': original.relative_to(ROOT).as_posix(), 'sha256': digest})
    # Generated provenance only; this tool never reads or writes personal settings.
    (target / 'raid-game-provenance.json').write_text(json.dumps({
        'description': 'Unmodified feature-local copies of the user-generated lobby character poses.',
        'source_provenance': 'mini projects/scene_voice_switcher/web/art/game-guests-provenance.json',
        'assets': records,
    }, indent=2) + '\n', encoding='utf-8')
    print(f'Verified {len(records)} unchanged character poses.')


if __name__ == '__main__':
    main()
