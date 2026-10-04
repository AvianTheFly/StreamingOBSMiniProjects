"""Queue ownership: foreground priority, child cleanup, resumption and cancellation."""
import subprocess
import sys
import threading
import unittest
from unittest.mock import patch

from footage_manager.jobs import JobRunner, JobContinuation
from footage_manager.media import JOB_CONTEXT, Cancelled, check_cancelled, run


class JobTests(unittest.TestCase):
    def setUp(self):
        self.runner=JobRunner(lambda jobs:None)
        self.stop=threading.Event()
        self.thread=threading.Thread(target=self.runner.run,args=(self.stop,JOB_CONTEXT,check_cancelled,Cancelled))

    def tearDown(self):
        self.stop.set()
        for job in self.runner.jobs.values():
            job['cancel_requested']=True
        if self.thread.ident:
            self.thread.join(3)
        self.assertFalse(self.thread.is_alive())

    def test_foreground_preempts_command_after_cleanup_and_background_resumes(self):
        created=threading.Event();finished=threading.Event();trace=[];processes=[]
        original=subprocess.Popen
        def spawn(*args,**kwargs):
            process=original(*args,**kwargs);processes.append(process);created.set();return process
        attempts=0
        def background(job):
            nonlocal attempts
            attempts+=1
            if attempts==1:
                try:run([sys.executable,'-c','import time;time.sleep(60)'],65)
                finally:trace.append('cleanup')
            else:
                trace.append('resume');finished.set()
            return {'complete':True}
        def foreground(job):
            self.assertIsNotNone(processes[0].poll(),'The old decoder must be reaped before foreground reuse')
            trace.append('foreground')
        with patch('footage_manager.media.subprocess.Popen',side_effect=spawn):
            ident=self.runner.submit('Analysis',background,background=True)
            self.thread.start()
            self.assertTrue(created.wait(3))
            self.runner.submit('Extract',foreground)
            self.assertTrue(finished.wait(3))
        self.assertEqual(['cleanup','foreground','resume'],trace)
        self.assertEqual('done',self.runner.jobs[ident]['state'])

    def test_batch_continuation_yields_to_already_queued_user_work(self):
        first_done=threading.Event();release=threading.Event();finished=threading.Event();trace=[]
        def second(job):trace.append('second recording');finished.set();return {'games':2}
        def first(job):
            trace.append('first recording');first_done.set();release.wait(3)
            return JobContinuation(second,{'games':1})
        self.runner.submit('Analysis',first,background=True);self.thread.start()
        self.assertTrue(first_done.wait(3))
        self.runner.submit('Export',lambda job:trace.append('export'))
        release.set();self.assertTrue(finished.wait(3))
        self.assertEqual(['first recording','export','second recording'],trace)

    def test_cancelled_queued_background_never_runs(self):
        finished=threading.Event();called=[]
        ident=self.runner.submit('Analysis',lambda job:called.append(True),background=True)
        self.runner.jobs[ident]['cancel_requested']=True
        self.runner.submit('Foreground',lambda job:finished.set())
        self.thread.start();self.assertTrue(finished.wait(3))
        self.runner.queue.join()
        self.assertEqual([],called)
        self.assertEqual('cancelled',self.runner.jobs[ident]['state'])

    def test_snapshot_retains_old_active_jobs_and_bounds_recent_history(self):
        running = self.runner.submit('Analysis', lambda job: None, background=True)
        self.runner.jobs[running]['state'] = 'running'
        queued = self.runner.submit('Queued analysis', lambda job: None, background=True)
        terminal = []
        for index in range(35):
            ident = self.runner.submit('Scan recordings', lambda job: None)
            self.runner.jobs[ident]['state'] = ('done', 'error', 'cancelled')[index % 3]
            terminal.append(ident)
        snapshot = self.runner.snapshot()
        self.assertEqual([running, queued] + terminal[-30:], [job['id'] for job in snapshot])
        snapshot[0]['progress'] = 'Client copy'
        self.assertEqual('', self.runner.jobs[running]['progress'])
        self.assertEqual([running, queued], [job['id'] for job in self.runner.snapshot(0)])


if __name__=='__main__':unittest.main()
