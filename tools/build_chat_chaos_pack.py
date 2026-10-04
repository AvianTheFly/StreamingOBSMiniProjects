"""Finite installer from captured public 7TV metadata; preserves personal data."""
import argparse
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.chat_overlay.chaos_pack import build, install


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--kesha', type=Path, required=True)
    parser.add_argument('--discovery', type=Path, required=True)
    args = parser.parse_args()
    pack = build(json.loads(args.kesha.read_text(encoding='utf-8')),
                 json.loads(args.discovery.read_text(encoding='utf-8')))
    pack = install(pack)
    print(f"Installed {len(pack['emotes'])} animated codes / {len({e['id'] for e in pack['emotes'].values()})} unique animations.")
    print(f"All {len(pack['requested'])} requested examples included; {len(pack['aliases'])} natural energy phrases.")
    print('Sources:',pack['sources'])


if __name__ == '__main__':
    main()
