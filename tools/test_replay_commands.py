import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths, load_project_env
ensure_import_paths(); load_project_env()
from instant_replay.main import _parse_command

class ReplayCommands(unittest.TestCase):
    def test_random_voice_variations(self):
        for text in ('random', 'Random.', 'play random.', 'random replay', 'play a random clip', 'surprise me!'):
            with self.subTest(text=text):
                self.assertEqual(_parse_command(text), ('play', 'random', 0, False))

    def test_existing_commands(self):
        self.assertEqual(_parse_command('play game 3.'), ('play', 'game 3', 0, False))
        self.assertEqual(_parse_command('save 30.'), ('save', '', 30, False))
        self.assertEqual(_parse_command('mark')[0], 'mark')
        self.assertEqual(_parse_command('save full')[3], True)

if __name__ == '__main__': unittest.main()
