"""Public feature authoring controls; HTTP adapters never access live objects."""
from .settings import VariationStore


def _store():
    from .interface import _live
    return _live.get('store') or VariationStore()


def state():
    from .interface import _live
    store=_store()
    service=_live.get('service')
    if service:
        service.presentation.capture_fader()
    data=store.snapshot()
    for row in data['variations']:
        try:
            file=store.audio_path(row)
            row['audio_ready']=bool(file)
            row['audio_name']=file.name if file else ''
        except ValueError as exc:
            row['audio_ready']=False
            row['audio_error']=str(exc)
    return {**data,'runtime':service.snapshot() if service else {'busy':False},
            'ready':bool(service), 'original_hotkey':'987',
            'preview_url':'http://127.0.0.1:7444/presentation/love_me/preview.html'}


def save(body):
    _store().save(body)
    from .interface import _live
    if reload:=_live.get('reload'):
        reload()
    return state()


def import_audio(body):
    _store().import_audio(body)
    return state()


def audio_file(identity):
    store=_store()
    file=store.audio_path(store.get(identity))
    if not file:
        raise ValueError('This variation has no audio yet.')
    return file


def control(body):
    from .interface import interface
    action=str(body.get('action',''))
    if action in {'pause','resume'}:
        from coordinator import coordinator
        coordinator.manual_action('love_me',action)
        return {'ok':True,'action':action}
    return interface.run_action(action)
