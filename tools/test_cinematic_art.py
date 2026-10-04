"""Requested cinematic camera changes and actual painted-asset integration."""
import math
import unittest
import numpy as np
from PIL import Image
from stream_brand.sketch_journey.art_timeline import state,camera,beat,BEAR_CONTACT,HIT,SCENES
from stream_brand.sketch_journey.art_effects import branch_routes,collapse_accents
from stream_brand.sketch_journey.art_assets import ArtAssets
from stream_brand.sketch_journey.art_materials import PaintedView
from stream_brand.sketch_journey.motion_rig import skeleton
from stream_brand.sketch_journey.sketch_space import View,dot,unit,sub


class CinematicArtTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.assets=ArtAssets()

    def test_opening_is_one_camera_path_through_the_former_cuts(self):
        for t in (beat(4),beat(8),beat(12),beat(16),beat(18),beat(20),beat(30)):
            a,b=camera(state(t-1e-5)),camera(state(t+1e-5))
            self.assertLess(math.dist(a[0],b[0]),.002,t)
            self.assertLess(math.dist(a[1],b[1]),.002,t)
            self.assertLess(abs(a[2]-b[2]),.002,t)
        for t in (beat(4),beat(8),beat(12)):
            before,middle,after=[camera(state(t+d))[0] for d in (-.001,0,.001)]
            va=np.subtract(middle,before)/.001;vb=np.subtract(after,middle)/.001
            self.assertLess(np.linalg.norm(va-vb),.02,t)

    def test_each_light_starts_at_the_center_and_reaches_three_surface_heights(self):
        for j in range(4):
            paths=branch_routes(j)
            self.assertEqual(paths[0][0],(0,.08,0))
            for path in paths:
                self.assertLess(path[0][1],.1)
                self.assertGreater(max(p[1] for p in path),7)
            self.assertEqual(state(beat(8))['branch_progress'][j],0)
            self.assertGreater(state(beat(17.5))['branch_progress'][j],.99)

    def test_spinning_portrait_faces_udyr_and_reveals_the_room(self):
        viewpoints=[]
        for j in range(25):
            p=state(beat(16)+(beat(18)-beat(16))*j/25);r=skeleton(p)
            eye=camera(p)[0];direction=unit((eye[0],0,eye[2]))
            self.assertGreater(dot(r['vector']((0,0,1)),direction),.999)
            v=View(Image.new('RGB',(1280,720)),*camera(p))
            x,y=v.project(r['joints']['head']);self.assertTrue(200<x<1080 and 100<y<650)
            viewpoints.append(eye)
        self.assertGreater(max(p[0] for p in viewpoints)-min(p[0] for p in viewpoints),11)
        self.assertEqual(state(beat(16))['root'],(0,0,0))

    def test_the_first_claw_starts_collapse_before_the_old_pause(self):
        self.assertEqual(state(BEAR_CONTACT)['cavein'],0)
        self.assertGreater(state(BEAR_CONTACT+.08)['cavein'],0)
        self.assertEqual(state(HIT)['cavein'],1)
        class Capture:
            def __init__(self):self.boxes=[]
            def box(self,*args):self.boxes.append(args)
            def line(self,*args):pass
        v=Capture();collapse_accents(v,state(BEAR_CONTACT+.08))
        self.assertGreater(len(v.boxes),0)
        self.assertLess(camera(state(BEAR_CONTACT+.20))[1][1],camera(state(beat(30)))[1][1])

    def test_fixed_limb_lengths_and_poses_continue_across_all_art_cuts(self):
        for fi in range(1201):
            r=skeleton(state(fi/30));j=r['joints']
            for a,b,c,l1,l2 in r['chains']:
                self.assertAlmostEqual(math.dist(j[a],j[b]),l1,places=7)
                self.assertAlmostEqual(math.dist(j[b],j[c]),l2,places=7)
        for _,t,_,_,_ in SCENES[1:]:
            a,b=skeleton(state(t-1e-6)),skeleton(state(t+1e-6))
            self.assertLess(max(math.dist(a['joints'][k],b['joints'][k]) for k in a['joints']),.001,t)

    def test_original_png_alpha_is_preserved_and_gate_opening_is_empty(self):
        for name in ('hero-atlas.png','spirit-atlas.png','gateway.png'):
            with Image.open(self.assets.root/name) as source:
                self.assertEqual(source.mode,'RGBA')
                self.assertEqual(source.getchannel('A').getextrema(),(0,255))
        for texture in (*self.assets.hero.values(),*self.assets.spirits.values(),self.assets.gateway):
            self.assertEqual(texture.shape[-1],4)
            self.assertEqual(int(texture[...,3].min()),0)
            # Filtering the atlas into rendering samples can turn an isolated
            # opaque source pixel into 254; source PNG alpha stays unmodified.
            self.assertGreaterEqual(int(texture[...,3].max()),250)
        h,w=self.assets.gateway.shape[:2]
        self.assertEqual(int(self.assets.gateway[round(h*.7),w//2,3]),0)

    def test_transparent_paint_does_not_hide_geometry_behind_it(self):
        im=Image.new('RGB',(1280,720),'black')
        v=PaintedView(im,(0,0,0),(0,0,1),70,self.assets);v.context='effects'
        v.polygon([(-1,-1,3),(1,-1,3),(1,1,3),(-1,1,3)],'#ff0000')
        texture=np.zeros((8,8,4),dtype=np.uint8);texture[...,:3]=(0,255,0)
        v.card([(-1,-1,2),(1,-1,2),(1,1,2),(-1,1,2)],texture)
        v.flush();self.assertEqual(im.getpixel((640,345)),(255,0,0))

    def test_closeup_keeps_the_painted_head_and_eyes_in_frame(self):
        p=state(18.1);r=skeleton(p);v=View(Image.new('RGB',(1280,720)),*camera(p))
        head=r['joints']['head'];s=p['body_scale']
        for dy in (-.28,.32):
            point=tuple(a+b for a,b in zip(head,r['vector']((0,dy*s,.26*s))))
            x,y=v.project(point);self.assertTrue(100<x<1180 and 27<y<693,(dy,x,y))
        self.assertLess(v.eye[2],11.44)

    def test_art_is_consumed_in_moving_shots_not_only_listed_as_references(self):
        from stream_brand.sketch_journey.art_paint import CinematicArtSketch
        sketch=CinematicArtSketch();a=np.asarray(sketch.render(13))
        original=sketch.assets.spirits['bear'];sketch.assets.spirits['bear']=np.zeros_like(original)
        b=np.asarray(sketch.render(13))
        self.assertGreater(np.count_nonzero(np.any(a!=b,axis=-1)),1000)
        self.assertEqual(len(sketch.delivery_metadata['art_assets_used']),5)
        self.assertEqual(sketch.delivery_metadata['still_image_shot_substitutions'],0)

    def test_every_setup_renders_reproducibly(self):
        from stream_brand.sketch_journey.art_paint import CinematicArtSketch
        sketch=CinematicArtSketch()
        for _,a,b,_,_ in SCENES:
            frame=sketch.render((a+b)/2);self.assertEqual((frame.size,frame.mode),((1280,720),'RGB'))
        self.assertEqual(sketch.render(24.3).tobytes(),sketch.render(24.3).tobytes())


if __name__=='__main__':unittest.main()
