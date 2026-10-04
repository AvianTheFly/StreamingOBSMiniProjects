"""Story geometry, rescue deadline and POV camera continuity for the cinematic MVP."""
import math
import unittest
from PIL import Image
from stream_brand.sketch_journey.cinematic_timeline import SCENES,STATUES,HIT,REVIEW_TIMES,state,camera,beat
from stream_brand.sketch_journey.sketch_space import View,add


class CinematicSketchTests(unittest.TestCase):
    def test_shots_cover_the_excerpt_without_teleporting_udyr(self):
        self.assertEqual((SCENES[0][1],SCENES[-1][2]),(0,40))
        self.assertEqual(len(SCENES),28)
        for a,b in zip(SCENES,SCENES[1:]):
            self.assertEqual(a[2],b[1])
            left,right=state(b[1]-.000001),state(b[1]+.000001)
            for x,y in zip(left['root'],right['root']):self.assertLess(abs(x-y),.001,b[0])
        self.assertEqual(state(39)['pose'],'sit')
        self.assertEqual(state(39)['root'],(50,2,-31))
        # Destination terrace front is z=-31; seated legs point further outward.
        self.assertLess(state(39)['root'][2]-.8,-31)

    def test_the_circle_has_four_distinct_statues_and_all_fit_in_the_overhead_frame(self):
        quadrants={(x>0,z>0) for x,_,z in STATUES}
        self.assertEqual(len(quadrants),4)
        p=state(8);v=View(Image.new('RGB',(1280,720)),*camera(p))
        for x,y,z in STATUES:
            xy=v.project((x,2,z))
            self.assertIsNotNone(xy)
            self.assertTrue(70<xy[0]<1210 and 100<xy[1]<610,xy)
        self.assertLess(math.dist(state(beat(18))['root'],(0,0,0)),.0001)

    def test_shield_completes_only_just_before_the_same_lintel_hits_it(self):
        self.assertEqual(state(HIT-.33)['shield'],0)
        self.assertLess(state(HIT-.1)['shield'],1)
        self.assertEqual(state(HIT-.025)['shield'],1)
        self.assertAlmostEqual(state(HIT)['block_y']-.65,1.25+1.55)
        self.assertGreater(state(HIT-.5)['block_y'],state(HIT)['block_y'])
        self.assertEqual(state(18)['form'],'turtle')
        self.assertEqual(state(18)['expression'],'relief')
        relief=state(18);eye=camera(relief)[0];root=relief['root']
        # The relief shot is physically inside the ellipsoidal shield, before the rubble pile.
        self.assertLess(((eye[0]-root[0])/1.6)**2+((eye[1]-root[1]-1.25)/1.55)**2+((eye[2]-root[2])/1.6)**2,1)
        self.assertLess(eye[2],12)
        self.assertEqual(state(beat(40))['shield'],0)
        self.assertEqual(state(HIT-.01)['entrance_blocked'],0)
        self.assertEqual(state(beat(40))['entrance_blocked'],1)

    def test_subjective_eye_drops_to_all_fours_and_keeps_position_through_the_breach(self):
        start,end=beat(44),beat(46)
        a,b=state(start),state(end)
        self.assertAlmostEqual(camera(a)[0][1]-a['root'][1],1.8)
        self.assertAlmostEqual(camera(b)[0][1]-b['root'][1],.83)
        for boundary in (beat(46),beat(52),beat(54)):
            left,right=state(boundary-.000001),state(boundary+.000001)
            self.assertLess(math.dist(camera(left)[0],camera(right)[0]),.001)
        self.assertLess(state(28)['root'][1],state(26)['root'][1])
        self.assertEqual(state(28.7)['shot'],'tease')
        self.assertTrue(state(28.7)['pov'])
        self.assertEqual(state(30)['form'],'phoenix')
        self.assertFalse(state(30)['pov'])

    def test_suspense_and_ending_compositions_keep_the_human_readable(self):
        for t in (15.5,16.4,18,20.2,30.5,39.8):
            p=state(t);v=View(Image.new('RGB',(1280,720)),*camera(p))
            xy=v.project(add(p['root'],(0,1.75 if t<37 else 1.2,0)))
            self.assertIsNotNone(xy)
            self.assertTrue(75<xy[0]<1205 and 75<xy[1]<630,(t,xy))

    def test_all_camera_shots_render_reproducibly(self):
        from stream_brand.sketch_journey.cinematic_paint import CinematicSketch
        sketch=CinematicSketch()
        for t in REVIEW_TIMES:
            frame=sketch.render(t)
            self.assertEqual((frame.size,frame.mode),((1280,720),'RGB'))
        self.assertEqual(sketch.render(23).tobytes(),sketch.render(23).tobytes())
        self.assertNotEqual(sketch.render(23).tobytes(),sketch.render(23.1).tobytes())
        with self.assertRaises(ValueError):state(-1)


if __name__=='__main__':unittest.main()
