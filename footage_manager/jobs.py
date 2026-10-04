"""One owned media worker with priority and cooperative background checkpoints."""
from dataclasses import dataclass
import itertools
import queue
import secrets
import threading


class JobYielded(RuntimeError):
    """Release resources and requeue the same step after foreground work."""


@dataclass(frozen=True)
class JobContinuation:
    function: object
    result: object = None


class JobRunner:
    def __init__(self, save):
        self.jobs = {}
        self.lock = threading.RLock()
        self.queue = queue.PriorityQueue()
        self.sequence = itertools.count()
        self.save = save
        self.active = None

    def persist(self):
        with self.lock:
            self.save(self.jobs)

    def snapshot(self, terminal_limit=30):
        """Keep every active job visible alongside bounded recent history."""
        with self.lock:
            terminal = [ident for ident, job in self.jobs.items()
                        if job['state'] not in ('queued', 'running')]
            recent = set(terminal[-terminal_limit:]) if terminal_limit > 0 else set()
            return [dict(job) for ident, job in self.jobs.items()
                    if job['state'] in ('queued', 'running') or ident in recent]

    def _put(self, ident, function):
        job = self.jobs[ident]
        self.queue.put((5 if job.get('background') else 0, next(self.sequence), ident, function))

    def submit(self, label, function, *, background=False):
        ident = secrets.token_hex(8)
        with self.lock:
            self.jobs[ident] = {'id':ident,'label':label,'state':'queued','progress':'','error':'',
                                'result':None,'background':background}
            for old in list(self.jobs)[:-80]:
                if self.jobs[old]['state'] in ('done','error','cancelled'):
                    del self.jobs[old]
            if not background and self.active and self.jobs[self.active].get('background'):
                self.jobs[self.active]['yield_requested'] = True
            self._put(ident,function)
        self.persist()
        return ident

    def run(self, stop, context, check, cancelled_type):
        while not stop.is_set():
            try:
                _,_,ident,function = self.queue.get(timeout=.25)
            except queue.Empty:
                continue
            with self.lock:
                job = self.jobs[ident]
                job['state'] = 'running'
                job.pop('yield_requested',None)
                self.active = ident
                if job.get('background') and any(j['state']=='queued' and not j.get('background') for j in self.jobs.values()):
                    job['yield_requested'] = True
            context.job = job
            self.persist()
            resume = None
            try:
                check()
                result = function(job)
                if isinstance(result,JobContinuation):
                    job['result'] = result.result
                    job['state'] = 'queued'
                    resume = result.function
                else:
                    job['result'] = result
                    job['state'] = 'done'
            except JobYielded:
                job['state'] = 'queued'
                job['progress'] = 'Paused for an export or preview; resuming from checkpoint'
                resume = function
            except cancelled_type as exc:
                job['error'] = str(exc)
                job['state'] = 'cancelled'
            except Exception as exc:
                job['error'] = str(exc)
                job['state'] = 'error'
            finally:
                context.job = {}
                with self.lock:
                    self.active = None
                    job.pop('yield_requested',None)
                    if resume is not None and not stop.is_set():
                        self._put(ident,resume)
                self.persist()
                self.queue.task_done()
