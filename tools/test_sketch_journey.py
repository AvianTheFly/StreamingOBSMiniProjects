"""Travel sketch regressions: no character resets or missing landing poses."""
import unittest
from stream_brand.sketch_journey.choreography import SCENES,BEAT,pose


class JourneySketchTests(unittest.TestCase):
    def test_complete_journey_keeps_the_actor_continuous_at_world_changes(self):
        self.assertEqual((SCENES[0][1],SCENES[-1][2]),(0,40))
        for previous,current in zip(SCENES,SCENES[1:]):
            self.assertEqual(previous[2],current[1])
            left,right=pose(current[1]-.00001),pose(current[1]+.00001)
            for key in ('x','y','lean','compression'):
                self.assertLess(abs(left[key]-right[key]),.01,key)

    def test_both_leaps_take_off_and_return_to_the_same_floor(self):
        for index,a,b in ((1,6*BEAT,10*BEAT),(3,8*BEAT,12*BEAT)):
            start=SCENES[index][1]
            self.assertAlmostEqual(pose(start+a)['y'],530)
            self.assertLess(pose(start+(a+b)/2)['y'],350)
            self.assertAlmostEqual(pose(start+b)['y'],530)
            self.assertGreater(pose(start+a-.03)['compression'],.9)
            self.assertGreater(pose(start+b+.03)['compression'],.9)

    def test_drawings_are_repeatable_and_joints_change_over_time(self):
        from stream_brand.sketch_journey.paint import Sketch
        sketch=Sketch()
        frame=sketch.render(11.2)
        self.assertEqual((frame.size,frame.mode),((1280,720),'RGB'))
        self.assertEqual(frame.tobytes(),sketch.render(11.2).tobytes())
        self.assertNotEqual(frame.tobytes(),sketch.render(11.3).tobytes())
        with self.assertRaises(ValueError):pose(-1)


if __name__=='__main__':unittest.main()
