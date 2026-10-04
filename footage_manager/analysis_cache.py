"""Disposable resumable observations; separate from authoritative user decisions."""
import hashlib
import json
from pathlib import Path
from lib.json_store import write_json
try:
    from .media import unchanged, check_cancelled
except ImportError:
    from media import unchanged, check_cancelled


def cache_path(directory, video, kind, options):
    key=json.dumps([video['id'],video['size'],video['mtime_ns'],kind,options],sort_keys=True)
    folder=Path(directory)/'analysis-cache'
    folder.mkdir(exist_ok=True)
    return folder/(hashlib.sha256(key.encode()).hexdigest()+'.json')


def read(path):
    if not path.exists():
        return {}
    # A malformed cache is reported rather than silently replaced; personal DB is untouched.
    value=json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(value,dict):
        raise ValueError('Analysis checkpoint is malformed: '+str(path))
    return value


def save(path,value):
    write_json(path,value)


def content_hash(directory, video, job):
    """Read every source byte before sharing analysis with a separate catalogue entry."""
    source=unchanged(video)
    checkpoint=cache_path(directory,video,'content-sha256-v1',{})
    cached=read(checkpoint)
    if 'sha256' in cached:
        digest=cached['sha256']
        if not isinstance(digest,str) or len(digest)!=64 or any(c not in '0123456789abcdef' for c in digest):
            raise ValueError('Malformed content fingerprint: '+str(checkpoint))
        return digest
    digest=hashlib.sha256()
    consumed=0
    with source.open('rb') as stream:
        while True:
            check_cancelled()
            chunk=stream.read(8*1024*1024)
            if not chunk:
                break
            digest.update(chunk)
            consumed+=len(chunk)
            job['progress']=f'Verify duplicate bytes {consumed/max(1,video["size"]):.0%} · {video["name"]}'
    unchanged(video)
    if consumed!=video['size']:
        raise ValueError('Source size changed during fingerprinting')
    result=digest.hexdigest()
    save(checkpoint,{'sha256':result})
    return result
