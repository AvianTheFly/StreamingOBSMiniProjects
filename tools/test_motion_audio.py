"""Original effect duration, contact timing and finite signal sanity."""
import unittest
import numpy as np
from stream_brand.sketch_journey.motion_audio import effects,RATE
from stream_brand.sketch_journey.motion_timeline import RAM_HIT,BEAR_CONTACT


class MotionAudioTests(unittest.TestCase):
    def test_finite_effects_are_quiet_and_the_ram_transient_begins_at_contact(self):
        signal,info=effects()
        self.assertEqual(len(signal),40*RATE);self.assertTrue(np.isfinite(signal).all())
        self.assertLess(info['peak'],.5);self.assertLess(info['rms'],.03)
        times={e['kind']:e['time'] for e in info['events']}
        self.assertAlmostEqual(times['ram contact'],RAM_HIT,places=4)
        events=[e for e in info['events'] if e['kind']=='lightning claw crackle']
        self.assertAlmostEqual(events[0]['time'],BEAR_CONTACT,places=4)
        at=round(RAM_HIT*RATE)
        self.assertGreater(np.max(np.abs(signal[at:at+4800])),.08)
        self.assertEqual(float(np.max(np.abs(signal[:RATE]))),0)
        self.assertEqual(float(np.max(np.abs(signal[-RATE:]))),0)

    def test_art_pass_masonry_starts_with_the_first_claw(self):
        start=BEAR_CONTACT+.055
        _,info=effects(cavein_start=start)
        masonry=[e for e in info['events'] if e['kind']=='loose masonry']
        self.assertAlmostEqual(masonry[0]['time'],start,places=4)
        self.assertLess(masonry[0]['time']-BEAR_CONTACT,.06)


if __name__=='__main__':unittest.main()
