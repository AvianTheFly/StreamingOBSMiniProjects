"""Requirements checks for the full illustrated comparison, independent of Hub."""
from pathlib import Path
import unittest
from stream_brand.spirit_slideshow.timeline import load_plan


class SlideshowRequirements(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.plan = load_plan(Path(__file__).resolve().parents[1] / 'stream_brand/spirit_slideshow/timeline.json')

    def test_full_image_sequence_and_useful_holds(self):
        shots = self.plan['shots']
        self.assertEqual(len({s['sha256'] for s in shots}), 34)
        self.assertEqual(shots[0]['start_frame'], 0)
        self.assertEqual(shots[-1]['end_frame'], 1000)
        self.assertTrue(all(a['end_frame'] == b['start_frame'] for a,b in zip(shots, shots[1:])))
        self.assertTrue(all(.5 <= s['frames']/25 <= 2.7 for s in shots))

    def test_action_build_contact_and_consequence_order(self):
        ids = [s['id'][3:] for s in self.plan['shots']]
        groups = [('center-ignition','branching-floor','statues-awaken','statue-beams','growing-empowerment','overload-cracks'),
                  ('bear-form-build','bear-sprint','claw-contact','gate-collapse','danger-look-up'),
                  ('turtle-races','shield-impact','shield-relief','only-wall-left'),
                  ('ram-resolve','ram-pov-lowering','ram-charge','ram-contact','breach-to-void','fall-lookback'),
                  ('phoenix-hint','phoenix-storm','wings-unfurl','glide-home','touchdown','walk-to-edge','seated-vista')]
        for group in groups:
            positions = [ids.index(value) for value in group]
            self.assertEqual(positions, sorted(positions))


class ExpandedSlideshowRequirements(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = Path(__file__).resolve().parents[1]/'stream_brand/spirit_slideshow/v2'
        cls.plan = load_plan(cls.root/'timeline.json')

    def test_expanded_artwork_and_ram_motion_holds(self):
        shots = self.plan['shots']
        self.assertEqual(len({s['sha256'] for s in shots}), 58)
        self.assertEqual(sum(s['role']=='new illustration' for s in shots), 33)
        self.assertEqual((shots[0]['start_frame'],shots[-1]['end_frame']), (0,1000))
        ram_actions = ('new-12-ram-crouch','23-ram-pov-lowering','new-13-ram-lock',
                       'new-14-ram-push','new-32-ram-alternate','24-ram-charge','new-16-ram-close')
        self.assertTrue(all(.16 <= s['frames']/25 <= .6 for s in shots if s['id'] in ram_actions))
        peak = next(s for s in shots if s['id']=='new-05-four-spirit-peak')
        self.assertGreater(peak['frames']/25,1.5)

    def test_bridge_failure_and_transformations_have_visible_stages(self):
        ids = [s['id'] for s in self.plan['shots']]
        groups = [('new-02-descent-bridge','new-05-four-spirit-peak','11-overload-cracks'),
                  ('new-06-bear-condense','new-07-bear-push','new-08-bear-stride',
                   'new-09-claw-windup','15-claw-contact','16-gate-collapse'),
                  ('new-11-shield-dissolves','new-12-ram-crouch','new-32-ram-alternate',
                   '25-ram-contact','new-17-wall-opens','new-18-bridge-footfall',
                   'new-19-bridge-break','new-20b-fall-damaged-sanctuary','new-21-fall-lookback'),
                  ('new-22-phoenix-sparks','new-23-phoenix-coil','new-24-phoenix-windup',
                   'new-25-storm-release','new-26-wing-powerstroke','new-28-landing-approach',
                   'new-29-landing-recovery','new-34-walk-after-landing','new-31-epic-vista')]
        for group in groups:
            self.assertEqual([ids.index(v) for v in group], sorted(ids.index(v) for v in group))
        self.assertNotIn('26-breach-to-void', ids)

    def test_selected_music_cues_reach_authored_delivery_frames(self):
        import json
        cues=json.loads((self.root/'music-cues.json').read_text(encoding='utf-8'))
        shots={s['id']:s for s in self.plan['shots']}
        self.assertGreaterEqual(len(cues['selected_cues']),10)
        self.assertLess(len(cues['selected_cues']),len(shots))
        for cue in cues['selected_cues']:
            self.assertLessEqual(abs(shots[cue['id']]['actual_start_seconds']-cue['source_attack_seconds']), .020001)


class CalmSlideshowRequirements(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.plan=load_plan(Path(__file__).resolve().parents[1]/'stream_brand/spirit_slideshow/v3/timeline.json')

    def test_calm_holds_and_complete_coverage(self):
        self.assertEqual(len(self.plan['shots']),26)
        self.assertTrue(all(s['frames']>=30 for s in self.plan['shots']))
        self.assertEqual(self.plan['shots'][-1]['end_frame'],1000)
        self.assertFalse(self.plan['calm_edit']['camera_motion'])

    def test_unbroken_ram_viewpoint_and_bridge_cause(self):
        ids=[s['id'] for s in self.plan['shots']]
        first,last=ids.index('new-13-ram-lock'),ids.index('new-19-bridge-break')
        self.assertEqual(ids[first:last+1],['new-13-ram-lock','24-ram-charge','25-ram-contact',
                         'new-17-wall-opens','new-18-bridge-footfall','new-19-bridge-break'])
        self.assertEqual(ids[last+1],'new-20b-fall-damaged-sanctuary')
        self.assertNotIn('new-21-fall-lookback',ids)

    def test_invalid_dissolve_and_short_hold_rejected(self):
        from copy import deepcopy
        from stream_brand.spirit_slideshow.calm import validate
        bad=deepcopy(self.plan)
        bad['calm_edit']['dissolve_frames']=31
        with self.assertRaises(ValueError): validate(bad)
        bad=deepcopy(self.plan)
        bad['shots'][2]['frames']=15
        with self.assertRaises(ValueError): validate(bad)


if __name__ == '__main__':
    unittest.main()
