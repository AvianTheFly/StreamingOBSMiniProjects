"""The revised story keeps physical consequences, clear depth and one island."""
import math
import unittest
from PIL import Image
from stream_brand.sketch_journey.illustrated_timeline import SCENES,REVIEW_TIMES,state,camera,beat,HIT,FLOOR_EDGE_Z,SAFE_SEAT
from stream_brand.sketch_journey.illustrated_materials import ArtView


class IllustratedSketchTests(unittest.TestCase):
    def test_full_excerpt_keeps_the_character_continuous_at_every_cut(self):
        self.assertEqual((SCENES[0][1],SCENES[-1][2],len(SCENES)),(0,40,28))
        for a,b in zip(SCENES,SCENES[1:]):
            self.assertEqual(a[2],b[1])
            self.assertLess(math.dist(state(b[1]-1e-6)['root'],state(b[1]+1e-6)['root']),.001,b[0])

    def test_empower_pan_and_bear_cameras_stay_inside_and_behind_udyr(self):
        for name in ('absorb','overload','escape','bear'):
            s=next(s for s in SCENES if s[0]==name)
            for j in range(11):
                p=state(s[1]+(s[2]-s[1])*j/11);eye=camera(p)[0]
                self.assertLess(eye[2],p['root'][2])
                self.assertLess(eye[2],12)
                self.assertLess(math.hypot(eye[0],eye[2]),13)
                self.assertEqual(p['yaw'],0)

    def test_rescue_backout_and_ram_share_the_original_entrance(self):
        self.assertLess(state(HIT-.1)['shield'],1)
        self.assertEqual(state(HIT-.025)['shield'],1)
        self.assertEqual(state(HIT)['cavein'],1)
        self.assertEqual(state(18)['expression'],'relief')
        a,b=state(beat(40)),state(beat(42))
        self.assertTrue(a['pov']);self.assertLess(b['root'][2],a['root'][2])
        self.assertEqual(b['entrance_blocked'],1)
        self.assertEqual(b['rubble_smashed'],0)
        self.assertEqual(state(beat(52))['root'],(0,0,10.6))
        self.assertEqual(state(beat(53))['rubble_smashed'],1)
        for j in range(101):
            p=state(beat(42)+(beat(54)-beat(42))*j/100)
            self.assertEqual(p['root'][0],0)
            self.assertEqual(p['destination_island'],'original')

    def test_the_missing_floor_causes_the_fall_and_pov_drops_to_all_fours(self):
        self.assertEqual(state(beat(52))['floor_missing'],1)
        for j in range(101):
            p=state(beat(52)+(beat(54)-beat(52))*j/100)
            if p['root'][2]<=FLOOR_EDGE_Z:self.assertEqual(p['root'][1],0)
            else:self.assertLess(p['root'][1],0)
        for t,h in ((beat(44),1.8),(beat(46),.83)):
            p=state(t);self.assertAlmostEqual(camera(p)[0][1]-p['root'][1],h)
        for boundary in (beat(46),beat(52),beat(54)):
            self.assertLess(math.dist(camera(state(boundary-1e-6))[0],camera(state(boundary+1e-6))[0]),.001)
        self.assertLess(state(beat(62))['root'][1],state(beat(54))['root'][1])

    def test_phoenix_returns_to_the_original_upper_terrace_and_sits_outward(self):
        p=state(beat(78));x,y,z=p['root']
        self.assertTrue(-12<=x<=-6 and -3<=z<=3);self.assertEqual(y,5.5)
        p=state(39.9);self.assertEqual(p['root'],SAFE_SEAT);self.assertEqual(p['pose'],'sit')
        self.assertAlmostEqual(p['yaw'],-math.pi/2)
        self.assertLess(p['root'][0]+.8*math.sin(p['yaw']),-12)
        self.assertLess(p['root'][1]-.9,5.5)

    def test_depth_is_correct_even_when_large_facets_are_queued_last(self):
        im=Image.new('RGB',(1280,720),'black');v=ArtView(im,(0,0,0),(0,0,1),70)
        v.polygon([(-1,-1,3),(1,-1,3),(1,1,3),(-1,1,3)],'#ff0000',None)
        v.polygon([(-8,-8,9),(8,-8,9),(8,8,9),(-8,8,9)],'#0000ff',None)
        v.flush();self.assertEqual(im.getpixel((640,345)),(255,0,0))

    def test_near_clipped_floor_does_not_occlude_a_standing_actor(self):
        # The floor crosses the near plane in the rear follow camera. Its
        # clipped vertices must not distort the triangle over the actor.
        z=6.427564133670227
        im=Image.new('RGB',(1280,720),'black')
        v=ArtView(im,(-.4,3.2,z+5),(0,1.1,z-5),58)
        v.polygon([(-.3,.7,z),(.3,.7,z),(.3,1.8,z),(-.3,1.8,z)],'#ff0000',None)
        for j in range(48):
            a,b=j*math.tau/48,(j+1)*math.tau/48
            v.polygon([(0,0,0),(13*math.sin(a),0,13*math.cos(a)),
                       (13*math.sin(b),0,13*math.cos(b))],'#0000ff',None)
        xy=v.project((0,1.3,z));v.flush()
        self.assertEqual(im.getpixel(tuple(round(q) for q in xy)),(255,0,0))

    def test_all_shots_are_coloured_reproducible_motion_without_picture_substitutions(self):
        from stream_brand.sketch_journey.illustrated_paint import IllustratedSketch
        sketch=IllustratedSketch()
        for t in REVIEW_TIMES:
            frame=sketch.render(t);self.assertEqual((frame.size,frame.mode),((1280,720),'RGB'))
        self.assertEqual(sketch.render(23).tobytes(),sketch.render(23).tobytes())
        for t in (4.5,6.2,9.7,13,16.5,19.2,23,26,30.2,33,38.5):
            self.assertNotEqual(sketch.render(t).tobytes(),sketch.render(t+.1).tobytes(),t)
        self.assertEqual(sketch.delivery_metadata['still_image_substitutions'],0)


if __name__=='__main__':unittest.main()
