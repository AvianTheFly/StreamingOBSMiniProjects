"""Action continuity, limb integrity and causal contact in the final motion MVP."""
import math
import unittest
from PIL import Image
from stream_brand.sketch_journey.motion_timeline import state,camera,beat,SCENES,HIT,RAM_HIT,RAM_LAUNCH,RAM_RELEASE,BEAR_CONTACT,BEAM_LAUNCH,BEAM_ARRIVAL,SAFE_SEAT
from stream_brand.sketch_journey.motion_rig import skeleton,subjective_skeleton
from stream_brand.sketch_journey.sketch_space import View


class MotionSketchTests(unittest.TestCase):
    def test_limb_lengths_and_attachment_for_every_delivered_frame(self):
        for fi in range(1201):
            p=state(fi/30);r=skeleton(p);j=r['joints']
            for a,b,c,upper,lower in r['chains']:
                self.assertAlmostEqual(math.dist(j[a],j[b]),upper,places=7)
                self.assertAlmostEqual(math.dist(j[b],j[c]),lower,places=7)
            for point in j.values():self.assertTrue(all(math.isfinite(v) for v in point))
            if p['pov']:
                view=View(Image.new('RGB',(1280,720)),*camera(p))
                for a,b,c in subjective_skeleton(p,view):
                    self.assertAlmostEqual(math.dist(a,b),.44,places=7)
                    self.assertAlmostEqual(math.dist(b,c),.47,places=7)

    def test_actions_and_rig_do_not_reset_on_cuts_or_contact_boundaries(self):
        boundaries={s[1] for s in SCENES[1:]}
        boundaries.update([beat(n) for n in (24,25.2,25.8,26,28.5,29,30.35,40.2,48.4,61.5,63,64,79,81)])
        boundaries.update([RAM_HIT,RAM_RELEASE])
        for t in sorted(boundaries):
            a,b=skeleton(state(t-1e-6)),skeleton(state(t+1e-6))
            for name in a['joints']:self.assertLess(math.dist(a['joints'][name],b['joints'][name]),.001,(t,name))

    def test_statue_energy_travels_before_each_spirit_can_grow(self):
        for j,(launch,arrival) in enumerate(zip(BEAM_LAUNCH,BEAM_ARRIVAL)):
            self.assertEqual(state(launch)['beam_progress'][j],0)
            halfway=state((launch+arrival)/2)
            self.assertTrue(0<halfway['beam_progress'][j]<1)
            self.assertEqual(halfway['spirit_growth'][j],0)
            self.assertEqual(state(arrival)['spirit_growth'][j],0)
            self.assertGreater(state(arrival+.35)['spirit_growth'][j],0)
            self.assertLess(state(arrival+.35)['spirit_growth'][j],1)
        self.assertLess(state(beat(20))['energy'],state(beat(22))['energy'])
        self.assertEqual(state(beat(24))['energy'],1)

    def test_bear_crouches_bounds_then_rises_and_strikes_the_same_gate(self):
        self.assertTrue(0<state(beat(25.6))['quadruped']<1)
        self.assertEqual(state(beat(27))['quadruped'],1)
        self.assertGreater(state(beat(28))['root'][2],state(beat(26))['root'][2])
        self.assertEqual(state(BEAR_CONTACT-.001)['seal'],0)
        self.assertLess(state(beat(28.7))['quadruped'],1)
        self.assertEqual(state(BEAR_CONTACT)['quadruped'],0)
        self.assertEqual(state(beat(30))['seal'],1)
        for fi in range(370,397):
            p=state(fi/30);eye=camera(p)[0]
            self.assertLess(eye[2],p['root'][2]);self.assertLess(eye[2],12)

    def test_planted_paws_stay_on_the_floor_and_keep_world_contact(self):
        saw=0
        for fi in range(373,397):
            p=state(fi/30);r=skeleton(p)
            if p['bear_running']<.999 or p['quadruped']<.999:continue
            for side in ('left','right'):
                if r['contacts'][side+'_hand']:
                    self.assertAlmostEqual(r['joints'][side+'_wrist'][1],.035*p['body_scale'],places=6);saw+=1
                    later=skeleton(state(fi/30+.0001))
                    if later['contacts'][side+'_hand']:
                        self.assertLess(math.dist(r['joints'][side+'_wrist'],later['joints'][side+'_wrist']),.00001)
        self.assertGreater(saw,8)

    def test_ram_anticipation_contact_recoil_and_release_precede_debris(self):
        self.assertEqual(state(RAM_LAUNCH-.01)['root'][2],7.5)
        self.assertEqual(state(RAM_HIT-.01)['rubble_smashed'],0)
        self.assertGreater(state(RAM_HIT+.08)['ram_contact'],0)
        self.assertLess(state(RAM_HIT+.08)['root'][2],state(RAM_HIT)['root'][2])
        self.assertGreater(state(RAM_HIT+.2)['rubble_smashed'],0)
        self.assertGreater(state(RAM_RELEASE+.2)['root'][2],state(RAM_RELEASE)['root'][2])
        self.assertEqual(state(beat(54))['rubble_smashed'],1)

    def test_subjective_camera_is_continuous_through_lower_charge_breach_and_fall(self):
        for t in (beat(46),beat(52),beat(54),beat(58),beat(60)):
            a,b=camera(state(t-1e-6)),camera(state(t+1e-6))
            self.assertLess(math.dist(a[0],b[0]),.001,t)
            self.assertLess(math.dist(a[1],b[1]),.001,t)
        self.assertLess(camera(state(beat(46)))[0][1],camera(state(beat(44)))[0][1])
        self.assertLess(state(beat(60))['root'][1],state(beat(54))['root'][1])
        self.assertGreater(camera(state(beat(60)))[1][1],camera(state(beat(60)))[0][1])

    def test_shield_closeup_is_inside_shell_and_in_front_of_rubble(self):
        p=state(18.08);eye=camera(p)[0];root=p['root']
        self.assertLess(eye[2],11.9-.46)
        self.assertLess(((eye[0]-root[0])/1.6)**2+((eye[1]-root[1]-1.25)/1.55)**2+((eye[2]-root[2])/1.6)**2,1)
        self.assertEqual(state(HIT-.025)['shield'],1)

    def test_crouch_run_and_rise_keep_the_limbs_in_frame(self):
        for k in range(151):
            p=state(beat(25.2)+(beat(29)-beat(25.2))*k/150)
            r=skeleton(p);v=View(Image.new('RGB',(1280,720)),*camera(p))
            for name in ('head','left_ankle','right_ankle','left_wrist','right_wrist'):
                xy=v.project(r['joints'][name]);self.assertIsNotNone(xy)
                self.assertTrue(80<xy[0]<1200 and 65<xy[1]<675,(p['t'],name,xy))

    def test_landing_and_sitting_keep_the_same_island_and_outward_feet(self):
        p=state(39.9);r=skeleton(p)
        self.assertEqual(p['root'],SAFE_SEAT);self.assertEqual(p['sit'],1)
        for side in ('left','right'):
            self.assertLess(r['joints'][side+'_ankle'][0],-12)
            self.assertLess(r['joints'][side+'_ankle'][1],5.5)

    def test_rear_follow_camera_keeps_the_whole_walk_visible(self):
        shot=next(s for s in SCENES if s[0]=='rear')
        for k in range(21):
            p=state(shot[1]+(shot[2]-shot[1])*k/21)
            r=skeleton(p);v=View(Image.new('RGB',(1280,720)),*camera(p))
            for name in ('head','left_ankle','right_ankle','left_wrist','right_wrist'):
                xy=v.project(r['joints'][name]);self.assertIsNotNone(xy)
                self.assertTrue(80<xy[0]<1200 and 65<xy[1]<675,(p['t'],name,xy))

    def test_every_camera_and_action_phase_renders(self):
        from stream_brand.sketch_journey.motion_paint import MotionSketch
        sketch=MotionSketch()
        times=[(a+b)/2 for _,a,b,_,_ in SCENES]+[BEAR_CONTACT-.1,RAM_HIT-.04,RAM_HIT+.10,beat(54)+.1]
        for t in times:self.assertEqual((sketch.render(t).size,sketch.render(t).mode),((1280,720),'RGB'))
        self.assertEqual(sketch.render(23).tobytes(),sketch.render(23).tobytes())


if __name__=='__main__':unittest.main()
