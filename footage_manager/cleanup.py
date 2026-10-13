"""Finite, explicitly authorized verified extraction and permanent source removal.

Runs exclusively on Footage Desk's existing media worker. Ledger contains decisions
and output references, never source-media backups or a second catalogue copy.
"""
import json
import secrets
import time
from pathlib import Path

from footage_manager.analysis_store import AnalysisStore
from footage_manager.analysis import candidates
from footage_manager.cleanup_plan import source_plan, digest, personal_signature, is_cleanup
from footage_manager.jobs import JobContinuation, JobYielded
from footage_manager.media import export_clip, unchanged, deletion_check, probe, check_cancelled, Cancelled
from lib.json_store import write_json

AUTHORIZATION = 'DELETE ORIGINALS AFTER VERIFIED EXPORTS'
LABEL = 'Reclaim storage: keep games and remove originals'


def preview(store, ids=None, voice_minimum=4, win_voice_minimum=0, unknown_voice_minimum=0):
    repository = AnalysisStore(store)
    plans, skipped = [], []
    for video in candidates(store, ids):
        result = repository.load(video)
        try:
            if not result or not result['source_current'] or result.get('state') != 'complete':
                raise ValueError('No completed analysis for the current source')
            unchanged(video)
            plan = source_plan(video, result, store.ranges(video['id']), voice_minimum, win_voice_minimum, unknown_voice_minimum)
            if plan['estimated_saved_bytes'] < max(16*1024*1024, video['size']*.01):
                raise ValueError('Too little removable footage to justify rewriting')
            plans.append(plan)
        except (ValueError, OSError) as error:
            skipped.append({'video_id':video['id'],'reason':str(error)})
    # First reclaim cheap space, making room to process larger sources on that drive.
    plans.sort(key=lambda p:(p['estimated_export_bytes']/max(1,p['source_size']),p['estimated_export_bytes']))
    return {'buffer_seconds':30,'voice_spike_minimum':voice_minimum,'win_voice_spike_minimum':win_voice_minimum,
            'unknown_voice_spike_minimum':unknown_voice_minimum,'sources':plans,'skipped':skipped,
            'estimated_saved_bytes':sum(p['estimated_saved_bytes'] for p in plans)}


def verify_exports(store, video):
    deletion_check(store, video)
    for clip in store.ranges(video['id']):
        if clip['decision'] != 'keep':
            continue
        duration, streams = probe(clip['exported'])
        info = json.loads(clip['export_info'])
        fields = ('type','codec','width','height')
        if abs(duration-info['duration']) > .1 or [tuple(s.get(k) for k in fields) for s in streams] != [tuple(s.get(k) for k in fields) for s in info['streams']]:
            raise ValueError('Retained media failed final verification')


def current_export(store, video, clip):
    if clip['export_signature'] != store.signature(video, clip):
        return False
    try:
        info = json.loads(clip['export_info'])
        target, sidecar = Path(clip['exported']), Path(info['source_metadata'])
        return (target.is_file() and target.stat().st_size == info['size']
                and target.stat().st_mtime_ns == info['mtime_ns']
                and sidecar.is_file() and sidecar.stat().st_size == info['source_metadata_size']
                and sidecar.stat().st_mtime_ns == info['source_metadata_mtime_ns'])
    except (ValueError, KeyError, OSError):
        return False


class CleanupBatch:
    def __init__(self, store, plan):
        self.store, self.plan = store, plan
        self.index = 0
        self.retained_index = 0
        self.ledger = {'session':secrets.token_hex(8),'started':time.time(),
                       'policy':{'buffer_seconds':30,'voice_spike_minimum':plan.get('voice_spike_minimum',4),
                                 'win_voice_spike_minimum':plan.get('win_voice_spike_minimum',0),
                                 'unknown_voice_spike_minimum':plan.get('unknown_voice_spike_minimum',0)},
                       'sources':plan['sources'],'retained':plan.get('retained',[]),
                       'skipped':plan['skipped'],'completed':[],'completed_retained':[],'errors':[]}
        folder = store.directory/'cleanup';folder.mkdir(exist_ok=True)
        self.path = folder/(self.ledger['session']+'.json')
        self.persist()

    def persist(self):
        write_json(self.path,self.ledger)

    def result(self):
        completed = self.ledger['completed']
        retained = self.ledger.get('completed_retained',[])
        return {'completed_recordings':len(completed),'revised_clips':len(retained),
                'saved_bytes':sum(r['saved_bytes'] for r in completed+retained),
                'files':[f for r in completed+retained for f in r['files']],
                'errors':self.ledger['errors'],'ledger':str(self.path),
                'remaining':len(self.plan['sources'])-self.index+len(self.plan.get('retained',[]))-self.retained_index}

    def process(self, plan, job):
        store, ident = self.store, plan['video_id']
        video = store.video(ident)
        if video['path'] != plan['source_path'] or video['size'] != plan['source_size'] or video['mtime_ns'] != plan['source_mtime_ns']:
            raise ValueError('Source changed after the cleanup plan')
        source = unchanged(video)
        analysis = AnalysisStore(store).load(video)
        if not analysis or digest(analysis) != plan['analysis_digest']:
            raise ValueError('Game analysis changed after the cleanup plan')
        if personal_signature(store.ranges(ident)) != plan['personal_signature']:
            raise ValueError('Personal review decisions changed after the cleanup plan')
        output = Path(plan['output']).resolve()
        expected = source.parent.resolve()/'.footage-kept'/str(ident)
        if output != expected or output == source.resolve():
            raise ValueError('Invalid retained-footage destination')
        obsolete = [r for r in store.ranges(ident) if is_cleanup(r) and (r['decision']=='keep' or r['exported'])
                    and [r['start'],r['end']] not in plan['intervals']]
        for clip in obsolete:
            store.execute("UPDATE ranges SET decision='reject' WHERE id=?",(clip['id'],))
        for index, (start,end) in enumerate(plan['intervals']):
            check_cancelled()
            existing = next((r for r in store.ranges(ident) if is_cleanup(r)
                             and r['start']==start and r['end']==end and r['decision']=='keep'),None)
            if not existing:
                intersect = [g for g in plan['games'] if g['decision']=='keep' and g['start']<end and g['end']>start]
                title = 'Retained '+('games '+','.join(str(g['index']+1) for g in intersect) if intersect else 'uncertain gap')
                range_id = store.save_range({'video_id':ident,'start':start,'end':end,'title':title,
                    'decision':'keep','tags':'storage-cleanup','collection':'Retained games',
                    'notes':json.dumps({'storage_cleanup':1,'session':self.ledger['session'],
                                       'games':intersect,'buffer_seconds':30})})
                existing = next(r for r in store.ranges(ident) if r['id']==range_id)
            job['progress'] = f"{self.index+1}/{len(self.plan['sources'])} · extract {index+1}/{len(plan['intervals'])} · {video['name']}"
            if not current_export(store,video,existing):
                export_clip(store, existing, output, padding=0, mode='copy')
        # Preserve user keepers that lie outside generated regions too.
        for clip in store.ranges(ident):
            if clip['decision']=='keep' and not current_export(store,video,clip):
                check_cancelled();export_clip(store,clip,output,padding=0,mode='copy')
        check_cancelled()
        with store.lock:
            if personal_signature(store.ranges(ident)) != plan['personal_signature']:
                raise ValueError('Personal review changed during extraction; original preserved')
            store.update_video(ident, {'status':'keep_clips' if store.rows("SELECT id FROM ranges WHERE video_id=? AND decision='keep'",(ident,)) else 'delete'})
            video = store.video(ident)
            verify_exports(store,video)
            unchanged(video)
            files = [r['exported'] for r in store.ranges(ident) if r['decision']=='keep']
            retained_bytes = sum(Path(f).stat().st_size for f in files)
            # Persist intent before unlink, so an interruption can be reconciled.
            self.ledger['deleting'] = {'video_id':ident,'source_path':str(source),'files':files}
            self.persist()
            check_cancelled()
            source.unlink()
            store.execute("UPDATE videos SET availability='deleted',trash_path='' WHERE id=?",(ident,))
            self.ledger.pop('deleting',None)
            self.ledger['completed'].append({'video_id':ident,'source_path':str(source),
                'source_bytes':video['size'],'retained_bytes':retained_bytes,
                'saved_bytes':video['size']-retained_bytes,'files':files})
            self.persist()
        # Only retire previous generated exports after the source replacement succeeds.
        for clip in obsolete:
            if clip['exported']:
                target = Path(clip['exported'])
                info = json.loads(clip['export_info'])
                if target.is_file() and target.stat().st_size==info.get('size') and target.stat().st_mtime_ns==info.get('mtime_ns'):
                    target.unlink()
                    sidecar = Path(info['source_metadata'])
                    if sidecar.is_file() and sidecar.stat().st_size==info.get('source_metadata_size'):
                        sidecar.unlink()
                    store.execute("UPDATE ranges SET exported='',export_signature='',export_info='{}' WHERE id=?",(clip['id'],))

    def __call__(self, job):
        check_cancelled()
        if self.index < len(self.plan['sources']) and self.retained_index >= len(self.plan.get('retained',[])):
            source = self.plan['sources'][self.index]
            try:
                self.process(source,job)
            except (Cancelled,JobYielded):
                raise
            except Exception as error:
                self.ledger['errors'].append({'video_id':source['video_id'],'error':str(error)})
                self.persist()
            self.index += 1
        elif self.retained_index < len(self.plan.get('retained',[])):
            from footage_manager.retained_cleanup import process
            task = self.plan['retained'][self.retained_index]
            job['progress'] = f"Revise retained clip {self.retained_index+1}/{len(self.plan['retained'])} · recording {task['video_id']}"
            try:
                process(self.store,task,self.ledger,self.persist)
            except (Cancelled,JobYielded):
                raise
            except Exception as error:
                self.ledger['errors'].append({'video_id':task['video_id'],'range_id':task['clip']['id'],'error':str(error)})
                self.persist()
            self.retained_index += 1
        result = self.result()
        job['result'] = result
        return JobContinuation(self,result) if result['remaining'] else result


def prepare(store, payload):
    if payload.get('authorization') != AUTHORIZATION or not payload.get('ids'):
        raise ValueError('Explicit original-deletion authorization and recording IDs are required')
    minimum = int(payload.get('voice_spike_minimum',4))
    win_minimum = int(payload.get('win_voice_spike_minimum',0))
    unknown_minimum = int(payload.get('unknown_voice_spike_minimum',0))
    if not 1 <= minimum <= 100 or not 0 <= win_minimum <= 100 or not 0 <= unknown_minimum <= 100:
        raise ValueError('Voice marker threshold must be between 1 and 100')
    plan = preview(store,payload['ids'],minimum,win_minimum,unknown_minimum)
    from footage_manager.retained_cleanup import plans
    plan['retained'] = plans(store,payload['ids'],minimum,win_minimum,unknown_minimum)
    if not plan['sources'] and not plan['retained']:
        raise ValueError('No eligible analyzed recordings have removable footage')
    return CleanupBatch(store,plan)
