"""Tighten generated retained exports using original-time policy and existing media owner."""
import json
from pathlib import Path
from footage_manager.cleanup_plan import source_plan, is_cleanup, digest, personal_signature
from footage_manager.analysis_store import AnalysisStore
from footage_manager.media import export_clip, unchanged, check_cancelled, probe
from lib.json_store import write_json


def plans(store, ids, minimum, win_minimum=0, unknown_minimum=0):
    tasks = []
    repository = AnalysisStore(store)
    for ident in ids:
        video = store.video(ident)
        if video['availability'] != 'deleted' or video['duration'] < 600:
            continue
        result = repository.load(video)
        if not result or result.get('state') != 'complete' or not result['source_current']:
            continue
        rows = store.ranges(ident)
        policy = source_plan(video,result,rows,minimum,win_minimum,unknown_minimum)
        for clip in rows:
            if not is_cleanup(clip) or clip['decision'] != 'keep' or not clip['exported']:
                continue
            info = json.loads(clip['export_info'])
            left,right = info['start'],info['end']
            intervals = [[max(left,a),min(right,b)] for a,b in policy['intervals'] if a<right and b>left]
            if intervals == [[left,right]]:
                continue
            tasks.append({'video_id':ident,'clip':clip,'intervals':intervals,
                          'analysis_digest':digest(result),'personal_signature':personal_signature(rows)})
    return tasks


class ExportSource:
    """Adapt a retained input to the existing exporter while preserving original coordinates."""
    def __init__(self, store, original, source, offset):
        self.store,self.original,self.source,self.offset = store,original,source,offset

    def video(self, ident):
        return self.source

    def signature(self, video, clip):
        row = next(r for r in self.store.ranges(self.original['id']) if r['id']==clip['id'])
        return self.store.signature(self.original,row)

    def execute(self, sql, args):
        destination,signature,raw,ident = args
        info = json.loads(raw)
        info['start'] += self.offset
        info['end'] += self.offset
        sidecar = Path(info['source_metadata'])
        provenance = json.loads(sidecar.read_text(encoding='utf-8'))
        provenance.update(source_id=self.original['id'],source_path=self.original['path'],
                          source_name=self.original['name'],source_size=self.original['size'],
                          source_mtime_ns=self.original['mtime_ns'],derived_from=self.source['path'],
                          requested_start_seconds=provenance['requested_start_seconds']+self.offset,
                          requested_end_seconds=provenance['requested_end_seconds']+self.offset,
                          export_start_seconds=info['start'],export_end_seconds=info['end'])
        write_json(sidecar,provenance)
        info.update(source_metadata_size=sidecar.stat().st_size,source_metadata_mtime_ns=sidecar.stat().st_mtime_ns)
        return self.store.execute(sql,(destination,signature,json.dumps(info),ident))


def process(store, task, ledger, persist):
    video = store.video(task['video_id'])
    if video['availability'] != 'deleted':
        raise ValueError('Retained source is no longer retired')
    if personal_signature(store.ranges(video['id'])) != task['personal_signature']:
        raise ValueError('Personal review changed; retained file preserved')
    result = AnalysisStore(store).load(video)
    if not result or digest(result) != task['analysis_digest']:
        raise ValueError('Analysis changed; retained file preserved')
    clip = next(r for r in store.ranges(video['id']) if r['id']==task['clip']['id'])
    if clip != task['clip']:
        raise ValueError('Retained marker changed; file preserved')
    from footage_manager.cleanup import current_export
    if not current_export(store,video,clip):
        raise ValueError('Retained export changed; file preserved')
    info = json.loads(clip['export_info'])
    target = Path(clip['exported']).resolve()
    expected = (Path(video['path']).parent/'.footage-kept'/str(video['id'])).resolve()
    if target.parent != expected:
        raise ValueError('Retained file outside its source folder')
    duration,streams = probe(target)
    if abs(duration-info['duration']) > .1 or streams != info['streams']:
        raise ValueError('Retained input verification failed')
    source = {**video,'path':str(target),'name':target.name,'size':info['size'],
              'mtime_ns':info['mtime_ns'],'duration':duration,'streams':json.dumps(streams),
              'export_stem':Path(video['path']).stem}
    adapter = ExportSource(store,video,source,info['start'])
    replacements = []
    for index,(a,b) in enumerate(task['intervals']):
        check_cancelled()
        ident = store.save_range({'video_id':video['id'],'start':a,'end':b,
                'title':'Retained games · revised '+str(index+1),'decision':'keep',
                'tags':'storage-cleanup','collection':'Retained games',
                'notes':json.dumps({'storage_cleanup':1,'session':ledger['session'],'replaces':clip['id']})})
        row = next(r for r in store.ranges(video['id']) if r['id']==ident)
        local = {**row,'start':a-info['start'],'end':b-info['start']}
        export_clip(adapter,local,expected,padding=0,mode='copy')
        replacements.append(next(r for r in store.ranges(video['id']) if r['id']==ident))
    check_cancelled()
    with store.lock:
        if personal_signature(store.ranges(video['id'])) != task['personal_signature']:
            raise ValueError('Personal review changed during extraction; old retained file preserved')
        if not current_export(store,video,clip):
            raise ValueError('Retained file changed during extraction')
        for row in replacements:
            if not current_export(store,video,row):
                raise ValueError('Replacement export changed')
            check_info=json.loads(row['export_info'])
            if abs(probe(row['exported'])[0]-check_info['duration'])>.1:
                raise ValueError('Replacement duration changed')
        ledger['deleting_retained']={'range_id':clip['id'],'path':str(target),'replacements':[r['id'] for r in replacements]}
        persist()
        check_cancelled()
        target.unlink()
        Path(info['source_metadata']).unlink()
        store.execute("UPDATE ranges SET decision='reject',exported='',export_signature='',export_info='{}' WHERE id=?",(clip['id'],))
        saved=info['size']-sum(json.loads(r['export_info'])['size'] for r in replacements)
        ledger.setdefault('completed_retained',[]).append({'video_id':video['id'],'range_id':clip['id'],
            'saved_bytes':saved,'files':[r['exported'] for r in replacements]})
        ledger.pop('deleting_retained',None)
        persist()
