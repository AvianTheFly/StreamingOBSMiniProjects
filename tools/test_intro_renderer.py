"""Offline regressions for an isolated cinematic export and soundtrack timing."""
from pathlib import Path
import copy
import tempfile
import unittest

import numpy as np
from stream_brand.intro.timeline import make_shots,validate
from stream_brand.intro.audio import analyze,write_wav,compose_effects
from stream_brand.intro.story_timeline import make_story_plan
from stream_brand.intro.continuity_timeline import make_continuity_plan


class IntroTimelineTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        art=self.root/'art'
        art.mkdir()
        self.plan=dict(fps=60,duration_seconds=40,shots=make_shots())
        for asset in {s['asset'] for s in self.plan['shots']}|{'08-hero-layer'}:
            (art/(asset+'.png')).write_bytes(b'timeline-only fixture')

    def test_entire_excerpt_is_covered_without_gaps(self):
        self.assertEqual(validate(self.plan,self.root),2400)
        self.assertEqual(self.plan['shots'][-1]['asset'],'07-convergence')
        for shot in self.plan['shots'][1:]:
            beat=(shot['start_frame']/60-.03)/(60/128)
            self.assertLess(abs(beat-round(beat)),.02)

    def test_overlap_and_missing_art_are_rejected(self):
        bad=copy.deepcopy(self.plan)
        bad['shots'][2]['start_frame']-=1
        with self.assertRaises(ValueError):
            validate(bad,self.root)
        (self.root/'art'/'03-bear.png').unlink()
        with self.assertRaises(FileNotFoundError):
            validate(self.plan,self.root)

    def test_nonfinite_camera_and_unsafe_asset_are_rejected(self):
        bad=copy.deepcopy(self.plan)
        bad['shots'][0]['orbit']=float('nan')
        with self.assertRaises(ValueError):
            validate(bad,self.root)
        bad=copy.deepcopy(self.plan)
        bad['shots'][0]['asset']='../private'
        with self.assertRaises(ValueError):
            validate(bad,self.root)

    def test_regular_low_frequency_attacks_recover_tempo(self):
        sr=48000
        duration=7.5
        data=np.zeros((round(sr*duration),2),np.float32)
        rng=np.random.default_rng(9)
        for at in np.arange(.03,duration,60/128):
            first=round(at*sr)
            t=np.arange(min(round(sr*.14),len(data)-first))/sr
            tone=(np.sin(2*np.pi*(75*t+2*(1-np.exp(-t/.015))))+.04*rng.normal(0,1,len(t)))*np.exp(-t*27)
            data[first:first+len(t)] += tone[:,None]*.5
        path=self.root/'test-kicks.wav'
        write_wav(path,data)
        info=analyze(path,duration)
        self.assertLess(abs(info['bpm']-128),.5)
        self.assertLess(abs(info['phase_seconds']-.03),.025)

    def test_effects_are_finite_bounded_and_exact_length(self):
        import wave
        path=self.root/'effects.wav'
        compose_effects(path,2,[.3],[1.4])
        with wave.open(str(path),'rb') as f:
            self.assertEqual((f.getnframes(),f.getnchannels(),f.getframerate()),(96000,2,48000))
            samples=np.frombuffer(f.readframes(f.getnframes()),'<i2')
        self.assertGreater(np.max(np.abs(samples)),1000)
        self.assertLess(np.max(np.abs(samples)),32767)


class StoryIntroTests(unittest.TestCase):
    def setUp(self):
        from PIL import Image
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        art=self.root/'art'
        art.mkdir()
        self.plan=make_story_plan()
        # Real compact raster fixtures exercise the renderer contract and OpenCV paths.
        for j,asset in enumerate({s['asset'] for s in self.plan['shots']}):
            image=np.zeros((72,128,3),np.uint8)
            image[:,:,0]=30+j*3
            image[:,:,1]=np.arange(128,dtype=np.uint8)[None,:]
            image[:,:,2]=np.arange(72,dtype=np.uint8)[:,None]*2+50
            Image.fromarray(image).save(art/(asset+'.png'))
        hero=Image.new('RGBA',(32,48),(0,0,0,0))
        hero.putpixel((16,24),(120,180,210,255))
        hero.save(art/'08-hero-layer.png')

    def test_pose_chains_cover_the_music_and_keep_story_order(self):
        self.assertEqual(validate(self.plan,self.root),2400)
        shots=self.plan['shots']
        positions={s['asset']:next(i for i,v in enumerate(shots) if v['asset']==s['asset']) for s in shots}
        self.assertEqual(len(self.plan['assets']),23)
        self.assertTrue(set(self.plan['assets']).issubset(positions))
        for group in self.plan['pose_groups'].values():
            order=[positions[a] for a in group]
            self.assertEqual(order,sorted(order))
        self.assertLess(positions['33-udyr-down'],positions['34-resolve'])
        self.assertLess(positions['34-resolve'],positions['40-ram-coil'])
        self.assertLess(positions['52-phoenix-contact'],positions['53-aftermath'])
        for shot in shots[1:]:
            beat=(shot['start_frame']/60-.03)/(60/128)
            self.assertLess(abs(beat*4-round(beat*4)),.08)

    def test_invalid_style_depth_and_contact_timing_are_rejected(self):
        for mutate in (
            lambda p:p['assets']['11-sion-reveal'].update(style='missing-style'),
            lambda p:p['assets']['11-sion-reveal'].update(depth=[[.5,.5,0,.2,.8]]),
            lambda p:p['shots'][11].update(hit_stop_frames=12),
            lambda p:p['shots'][11].update(impact_point=[float('nan'),.5]),
            lambda p:p['shots'][11].update(travel=[.3,0]),
        ):
            bad=copy.deepcopy(self.plan)
            mutate(bad)
            with self.assertRaises(ValueError):
                validate(bad,self.root)

    def test_every_shot_and_contact_treatment_renders(self):
        from stream_brand.intro.cinema import Cinema
        cinema=Cinema(self.root,self.plan,(320,180))
        for shot in self.plan['shots']:
            for offset in (0,min(3,shot['end_frame']-shot['start_frame']-1)):
                frame=cinema.render(shot['start_frame']+offset)
                self.assertEqual(frame.shape,(180,320,3))
                self.assertEqual(frame.dtype,np.uint8)
                self.assertEqual(int(frame[:9].max()),0)
                if shot['start_frame']>0:
                    self.assertGreater(int(frame.max()),0)


class ContinuityIntroTests(unittest.TestCase):
    def setUp(self):
        from PIL import Image
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        art=self.root/'art'
        art.mkdir()
        self.plan=make_continuity_plan()
        for j,asset in enumerate(sorted({s['asset'] for s in self.plan['shots']})):
            plate=np.zeros((72,128,3),np.uint8)
            plate[:,:,0]=35+j*3
            plate[:,:,1]=np.arange(128,dtype=np.uint8)[None,:]
            plate[:,:,2]=np.arange(72,dtype=np.uint8)[:,None]*2+50
            Image.fromarray(plate).save(art/(asset+'.png'))
        hero=Image.new('RGBA',(32,48),(0,0,0,0))
        hero.putpixel((16,24),(120,180,210,255))
        hero.save(art/'08-hero-layer.png')

    def test_spirit_showcases_finish_before_the_fight(self):
        self.assertEqual(validate(self.plan,self.root),2400)
        shots=self.plan['shots']
        fight=next(i for i,s in enumerate(shots) if s['asset']=='85-bear-windup')
        showcases={'80-bear-physical','81-bear-spirit','82-turtle-physical',
                   '83-turtle-spirit','05-ram','06-phoenix'}
        self.assertTrue(showcases.issubset({s['asset'] for s in shots[:fight]}))
        self.assertFalse(showcases.intersection(s['asset'] for s in shots[fight:]))
        self.assertAlmostEqual(shots[10]['start_frame']/60,7.53,places=2)
        for physical,spirit in [('80-bear-physical','81-bear-spirit'),
                                ('82-turtle-physical','83-turtle-spirit')]:
            first=next(s for s in shots if s['asset']==physical)
            second=next(s for s in shots if s['asset']==spirit)
            self.assertEqual(first['end_frame'],second['start_frame'])
            self.assertEqual(first['zoom'][1],second['zoom'][0])
            self.assertEqual(first['focus'],second['focus'])

    def test_recovery_and_knockdown_cannot_reset_the_fight(self):
        assets=[s['asset'] for s in self.plan['shots']]
        first={a:assets.index(a) for a in assets}
        recovery=['91-shield-pushback','63-ram-kneeling','64-ram-rise-half',
                  '65-ram-rise-loaded','66-ram-charge','42-ram-contact',
                  '67-sion-fall-back','68-sion-grounded']
        self.assertEqual([first[a] for a in recovery],sorted(first[a] for a in recovery))
        # These older paintings depict standing/kneeling Sion or an unrelated reset.
        self.assertFalse({'33-udyr-down','40-ram-coil','41-ram-release',
                          '43-ram-fall','50-phoenix-rise','51-phoenix-dive',
                          '52-phoenix-contact'}.intersection(assets))
        self.assertEqual(assets[first['68-sion-grounded']:-1],[
            '68-sion-grounded','69-phoenix-summon-grounded',
            '70-phoenix-rise-grounded','71-phoenix-dive-grounded',
            '72-phoenix-finish-grounded','72-phoenix-finish-grounded',
            '73-phoenix-touchdown','74-victory-rise','53-aftermath'])
        for shot in self.plan['shots'][1:]:
            beat=(shot['start_frame']/60-.03)/(60/128)
            self.assertLess(abs(beat*4-round(beat*4)),.08)

    def test_all_new_poses_and_impact_frames_render(self):
        from stream_brand.intro.cinema import Cinema
        cinema=Cinema(self.root,self.plan,(320,180))
        for shot in self.plan['shots']:
            for offset in (0,min(3,shot['end_frame']-shot['start_frame']-1),
                           shot['end_frame']-shot['start_frame']-1):
                frame=cinema.render(shot['start_frame']+offset)
                self.assertEqual((frame.shape,frame.dtype),((180,320,3),np.uint8))
                self.assertEqual(int(frame[:9].max()),0)
                if shot['start_frame']>0:
                    self.assertGreater(int(frame.max()),0)


if __name__=='__main__':
    unittest.main()
