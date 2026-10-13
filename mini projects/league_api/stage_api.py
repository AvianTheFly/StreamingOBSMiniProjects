"""Public authoring API for League's stage presentation."""
from .interface import _live


def _service():
    service = _live.get('service')
    if service is None:
        raise ValueError('League presentation is starting; try again shortly')
    return service


def catalog():
    return _service().stage_appearance.catalog()


def asset(key):
    return _service().stage_appearance.asset(key)


def select(body):
    return _service().stage_appearance.select(body.get('image'), body.get('revision'))


def upload(name, payload):
    return _service().stage_appearance.upload(name, payload)


def draft_theme(theme):
    return _service().client_scenes.configure({'theme': theme})


def queue_theme(theme):
    return _service().client_scenes.configure({'queue_theme': theme})
