"""Hub composition: source maps, public runtime snapshots and local history.

Sampling uses the existing UI poller, including when the browser is closed.
This adapter owns no feature state, connections, microphone or playback worker.
"""
from pathlib import Path

from lib.workflow_map.catalog import WorkflowCatalog
from lib.workflow_map.journal import WorkflowJournal

catalog = WorkflowCatalog(Path(__file__).resolve().parents[1])
journal = WorkflowJournal()


def sample(projects):
    from lib.coordination.scenes import scene_director
    from coordinator import coordinator
    from lib.media_jobs import jobs
    from voice.service import service
    scenes = scene_director.snapshot()
    journal.sample({
        'scene':{key:value for key,value in scenes.items() if key != 'history'},
        'projects':[{key:value for key,value in project.items() if key in
                     {'name','is_active','is_paused','current_activity','workflow'}} for project in projects],
        'voice':{key:value for key,value in service.diagnostics(include_details=False).items()
                 if key in {'state','owner','session_id'}},
        'conversions':jobs.status(), **coordinator.snapshot(),
    })
