"""Disposable thumbnail generation and the shared preview admission bound."""
import json
import subprocess
import tempfile
import unittest
from concurrent.futures import Future
from pathlib import Path
from unittest.mock import patch
from hub_ui import replay_media


class ReplayPosterTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);self.source=self.root/'clip.mp4'
        subprocess.run(['ffmpeg','-nostdin','-v','error','-f','lavfi','-i','testsrc2=size=160x90:rate=24',
                        '-t','2','-c:v','libx264','-threads','1',str(self.source)],check=True,capture_output=True)
        for name,value in [('CACHE',self.root/'cache'),('_jobs',{}),('_poster_jobs',{})]:
            p=patch.object(replay_media,name,value);p.start();self.addCleanup(p.stop)

    def test_real_still_duration_cache_and_original_preservation(self):
        original=self.source.read_bytes()
        result,media=replay_media.poster(self.source)
        self.assertEqual(result['status'],'preparing');self.assertIsNone(media)
        list(replay_media._poster_jobs.values())[0].result(timeout=30)
        result,media=replay_media.poster(self.source)
        self.assertEqual(result['status'],'ready');self.assertAlmostEqual(result['duration'],2,delta=.1)
        self.assertEqual(media.read_bytes()[:2],b'\xff\xd8')
        probe=json.loads(subprocess.run(['ffprobe','-v','error','-show_streams','-of','json',str(media)],check=True,capture_output=True,text=True).stdout)
        self.assertEqual(probe['streams'][0]['width'],480)
        self.assertEqual(self.source.read_bytes(),original)
        self.assertEqual(len(replay_media._poster_jobs),1)
        self.assertEqual(list(media.parent.glob('*.partial.jpg')),[])
        self.assertEqual(replay_media.poster(self.source)[1],media)
        media.unlink()
        self.assertEqual(replay_media.poster(self.source)[0]['status'],'preparing')
        list(replay_media._poster_jobs.values())[0].result(timeout=30)

    def test_stills_and_video_share_three_admitted_jobs(self):
        replay_media._jobs.update({str(i):Future() for i in range(2)})
        replay_media._poster_jobs['pending']=Future()
        with patch.object(replay_media._pool,'submit') as submit:
            self.assertEqual(replay_media.poster(self.source)[0]['status'],'busy')
            self.assertEqual(replay_media.preview(self.source)[0]['status'],'busy')
        submit.assert_not_called()


if __name__=='__main__':unittest.main()
