"""Novelty follows verified evidence, and sparse reports never invent a story."""
import copy
import unittest
from league_stats.recap_narratives import project


class NarrativeTests(unittest.TestCase):
    def test_varied_deck_preserves_report_and_labels_context(self):
        report = dict(match=dict(champion='Udyr',duration=1200,metrics=dict(
            kills=7,assists=9,team_kills=20,kill_participation=80,damage_share_pct=25,
            damage_champions=18000,dead_seconds=100,deaths=3,q_casts=30,w_casts=40,e_casts=20,r_casts=10)),
            stories=dict(burst=dict(start=100,end=160,kills=2,assists=3),alive_pct=91.7,
                lane=[dict(minute=5,time=301,gold=-200),dict(minute=10,time=603,gold=700)],
                comparisons=[dict(key='cs_per_minute',label='Farm pace',change=-20,games=5,value=4,average=5,unit='CS/min')]),
            analysis=dict(farm_window=dict(start=120,end=360,cs=32,rate=8),
                peak_wallet=dict(time=900,wallet=2100),objectives=[dict(side='ally'),dict(side='enemy')]),
            visuals=dict(exact_build=False,build=[dict(time=110,name='Boots')]))
        before=copy.deepcopy(report)
        cards=project(report)
        self.assertEqual(report,before)
        self.assertEqual(len({card['id'] for card in cards}),len(cards))
        self.assertGreaterEqual(len(cards),12)
        indexed={card['id']:card for card in cards}
        self.assertEqual(indexed['burst']['value'],5)
        self.assertEqual(indexed['swing']['value'],'900')
        self.assertIn('below',indexed['baseline-cs_per_minute']['text'])
        self.assertIn('first observed',indexed['build']['unit'])
        self.assertIn('do not imply',indexed['objectives']['text'])

    def test_sparse_match_only_explains_capture(self):
        cards=project(dict(match=dict(champion='Udyr',duration=120)))
        self.assertEqual([c['id'] for c in cards],['capture'])
        self.assertNotIn('Win',cards[0]['text'])
        self.assertEqual(project({}),[])

    def test_invalid_metrics_never_get_percent_or_cast_claims(self):
        cards=project(dict(match=dict(duration=120,metrics=dict(kill_participation=float('nan'),
            damage_share_pct=101,q_casts=True,w_casts=1,e_casts=2,r_casts=3))))
        self.assertEqual([c['id'] for c in cards],['capture'])
