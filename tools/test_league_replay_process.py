"""Replay discovery works without the optional Riot replay API."""
import unittest
from unittest.mock import Mock, patch
import psutil
from lib.league_client import LeagueClient
from lib.process_inventory import ProcessEntry


class ReplayProcessTests(unittest.TestCase):
    def process(self, name, args):
        process = Mock(info={'name': name})
        process.name.return_value = name
        process.cmdline.return_value = args
        return process

    def test_only_game_process_with_replay_file_matches(self):
        client = LeagueClient()
        for name, args, expected in (
            ('League of Legends.exe', ['game.exe', 'C:/Replays/NA1-123.ROFL', '-Region=NA'], True),
            ('League of Legends.exe', ['game.exe', 'live-game', '-GameID=123'], False),
            ('LeagueClient.exe', ['client.exe', 'C:/Replays/game.rofl'], False),
            ('League of Legends.exe', ['game.exe', '-log=C:/Replays/game.rofl.txt'], False),
        ):
            with self.subTest(name=name, args=args), patch('lib.process_inventory.process_snapshot', return_value=[ProcessEntry(12,name,0,1)]), patch('psutil.Process', return_value=self.process(name,args)):
                self.assertIs(client.replay_active(), expected)

    def test_exit_is_false_and_access_denied_is_unknown(self):
        process = self.process('League of Legends.exe', [])
        with patch('lib.process_inventory.process_snapshot', return_value=[ProcessEntry(12,'League of Legends.exe',0,1)]), patch('psutil.Process', return_value=process):
            process.cmdline.side_effect = psutil.NoSuchProcess(12)
            self.assertIs(LeagueClient().replay_active(), False)
            process.cmdline.side_effect = psutil.AccessDenied(12)
            self.assertIsNone(LeagueClient().replay_active())

    def test_closed_replay_does_not_require_client_or_game_api(self):
        with patch('lib.process_inventory.process_snapshot', return_value=[]):
            self.assertIs(LeagueClient().replay_active(), False)

    def test_reused_discovery_pid_cannot_admit_a_non_game(self):
        process = self.process('other.exe', ['other.exe', 'fake.rofl'])
        with patch('lib.process_inventory.process_snapshot', return_value=[ProcessEntry(12,'League of Legends.exe',0,1)]), patch('psutil.Process', return_value=process):
            self.assertIs(LeagueClient().replay_active(), False)
        process.cmdline.assert_not_called()
