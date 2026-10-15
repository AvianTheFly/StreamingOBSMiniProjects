"""Draft labels reflect exposed client identity without guessing hidden players."""
import unittest
from .champ_select import project


class DraftNameTests(unittest.TestCase):
    def labels(self, players, side='allies'):
        session={'myTeam' if side=='allies' else 'theirTeam':players}
        return [slot['label'] for slot in project(session,{})[side]]

    def test_ranked_alias_wins_over_other_name_fields(self):
        aliases=['Gromp','Krugs','Murk Wolf','Raptors','Scuttle Crab']
        players=[{'obfuscatedSummonerName':alias,'gameName':'Other name',
                  'summonerName':'Older name'} for alias in aliases]
        self.assertEqual(self.labels(players),aliases)

    def test_normal_names_and_riot_names_are_available_on_both_teams(self):
        players=[{'gameName':'Spirit Walker','summonerName':'Older name'},
                 {'summonerName':'Bot Lane Buddy'}, {'riotIdGameName':'Fox'},
                 {'obfuscatedSummonerName':'  ','gameName':'  River Scout  '},
                 {'gameName':'','summonerName':'Support Main'}]
        for side in ('allies','enemies'):
            with self.subTest(side=side):
                self.assertEqual(self.labels(players,side),
                    ['Spirit Walker','Bot Lane Buddy','Fox','River Scout','Support Main'])

    def test_hidden_or_malformed_names_keep_numbered_fallback(self):
        players=[{'summonerId':42,'puuid':'unexposed'},
                 {'obfuscatedSummonerName':'  ','gameName':None},
                 {'gameName':123,'summonerName':{}}, None, {}]
        self.assertEqual(self.labels(players),[f'Teammate {i}' for i in range(1,6)])
        self.assertEqual(self.labels(players,'enemies'),[f'Opponent {i}' for i in range(1,6)])

    def test_labels_are_bounded_literal_unicode_strings(self):
        players=[{'gameName':'雪の狐'}, {'gameName':'<img src=x>'}, {'gameName':'x'*100}]
        self.assertEqual(self.labels(players)[:3],['雪の狐','<img src=x>','x'*64])


if __name__=='__main__':
    unittest.main()
