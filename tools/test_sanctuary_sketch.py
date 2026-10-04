"""Causal escape and actor/camera continuity in the inexpensive sanctuary animatic."""
import unittest
from stream_brand.sketch_journey.escape_choreography import SCENES,HITS,REVIEW_TIMES,beat,pose


class SanctuarySketchTests(unittest.TestCase):
    def test_complete_chain_keeps_actor_and_camera_continuous(self):
        self.assertEqual([s[0] for s in SCENES],['enter','walls','statues','absorb','collapse',
            'bear','turtle','ram','fall','catch','clear','reveal','arrival'])
        self.assertEqual((SCENES[0][1],SCENES[-1][2]),(0,40))
        for a,b in zip(SCENES,SCENES[1:]):
            self.assertEqual(a[2],b[1])
            left,right=pose(b[1]-.000001),pose(b[1]+.000001)
            for key in ('x','y','camera','camera_y','lean','compression'):
                self.assertLess(abs(left[key]-right[key]),.001,(b[0],key))

    def test_obstacles_keep_the_consequences_of_previous_actions(self):
        keys=('absorbed','collapse','seal_broken','rubble_cleared','wall_breached','ice','visibility')
        for key in keys:
            values=[pose(i/30)[key] for i in range(1201)]
            self.assertTrue(all(a<=b for a,b in zip(values,values[1:])),key)
            self.assertEqual(values[-1],1,key)
        self.assertEqual(pose(beat(18))['absorbed'],1)
        self.assertEqual(pose(beat(18))['collapse'],0)
        self.assertEqual(pose(beat(30))['seal_broken'],1)
        self.assertLess(HITS[-1]+1,beat(44))
        self.assertEqual(pose(beat(44))['rubble_cleared'],0)
        self.assertEqual(pose(beat(50))['rubble_cleared'],1)
        self.assertEqual(pose(beat(50))['wall_breached'],0)
        self.assertEqual(pose(beat(54))['wall_breached'],1)
        self.assertEqual(pose(beat(60))['visibility'],0)

    def test_phoenix_catches_existing_fall_before_reversing_it_and_lands(self):
        a,b=beat(54),beat(57)
        self.assertGreater(pose(b)['y'],pose(a)['y'])
        self.assertGreater(pose(b+.1)['y'],pose(b)['y'])
        self.assertLess(pose(beat(60))['y'],pose(b)['y'])
        self.assertEqual(pose(beat(80))['y'],535)
        self.assertEqual(pose(beat(80))['gesture'],'stand')
        for t,kind in ((11,'bear'),(16,'turtle'),(22,'ram'),(30,'phoenix')):
            self.assertEqual(pose(t)['power'],kind)

    def test_every_story_stage_renders_and_the_actor_stays_in_view(self):
        from stream_brand.sketch_journey.escape_paint import EscapeSketch
        sketch=EscapeSketch()
        for t in REVIEW_TIMES:
            frame=sketch.render(t)
            self.assertEqual((frame.size,frame.mode),((1280,720),'RGB'))
            p=pose(t)
            self.assertGreater(p['x']-p['camera'],80)
            self.assertLess(p['x']-p['camera'],1150)
            self.assertLess(p['y']-p['camera_y'],630)
        self.assertEqual(sketch.render(17).tobytes(),sketch.render(17).tobytes())
        self.assertNotEqual(sketch.render(HITS[0]-.2).tobytes(),sketch.render(HITS[0]+.2).tobytes())


if __name__=='__main__':unittest.main()
