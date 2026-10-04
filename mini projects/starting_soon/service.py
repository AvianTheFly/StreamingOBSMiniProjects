"""Waiting-room policy and serialized session lifetime owned by the feature."""
import threading
import time
from coordinator import coordinator
from . import settings, clip_library, presentation, artwork, layouts
from .config import ART, SCENE
from .player import ClipPlayer


class StartingSoon:
    def __init__(self, queue, port):
        self.queue, self.port = queue, port
        self.lock = threading.RLock()
        self.data = dict(ready=False, active=False, playing=False, clip_title='', error='', artwork_index=0)
        self.session = None
        self._preserved_box = None
        self._placed_override = False
        self.player = ClipPlayer(coordinator.permission('starting_soon'), self.publish, self.place_clip)
        self.last_rotation = time.monotonic()

    def publish(self, **changes):
        with self.lock:
            self.data = {**self.data, **changes}

    def snapshot(self):
        with self.lock:
            data = dict(self.data)
        return {**settings.read(), **data, 'session_queue':self.player.snapshot(),
                'artwork_catalog':artwork.catalog(), 'layout_catalog':layouts.PRESETS,
                'available_artwork': sorted(p.name for p in ART.glob('*.png'))}

    def place_clip(self, path=''):
        config = settings.read()
        override = bool(path and path in config['clip_layouts'])
        if layouts.box(config,path) is None and self._placed_override and self._preserved_box:
            box = list(self._preserved_box)
            presentation.place_box(box)
        else:
            if override and not self._placed_override and config['layout']=='preserve':
                self._preserved_box = presentation.placement(config)
            box = presentation.placement(config,path)
            if not override and config['layout']=='preserve':
                self._preserved_box = list(box)
        self._placed_override = override
        self.publish(clip_box=box)

    def execute(self, action, body):
        if action == 'install':
            presentation.attach(self.port)
            self.place_clip()
            self.publish(ready=True, error='')
        elif action == 'start':
            if self.session and self.session.owns_scene():
                return
            self.close()
            presentation.attach(self.port)
            self.place_clip()
            self.session = coordinator.scene_session('starting_soon', SCENE, 'Test',
                                                     transition=('Fade',350))
            presentation.prepare_stage()
            if not self.session.activate():
                self.close()
                raise ValueError('Scene selection changed; try opening Starting Soon again.')
            self.publish(ready=True, active=True, error='')
        elif action == 'finish':
            self.close()
        elif action == 'play':
            if not self.session or not self.session.owns_scene():
                raise ValueError('Open Starting Soon in OBS before playing clips.')
            config = settings.read()
            if not config['highlights_enabled']:
                raise ValueError('Enable the highlight overlay before playing a playlist.')
            paths = body.get('paths') or config['playlist']
            index = body.get('start_index',0)
            if isinstance(index,bool) or not isinstance(index,int) or not 0 <= index < len(paths):
                raise ValueError('Choose a valid starting clip.')
            rows, missing = clip_library.playable(paths[index:])
            self.publish(missing_clips=missing, error='')
            self.player.play(rows, self.session, loop=config['loop'], shuffle=config['shuffle'],
                             gap_seconds=config['gap_seconds'])
        elif action == 'stop':
            self.player.stop()
        elif action == 'skip':
            self.player.skip.set()
        elif action in ('pause','resume'):
            coordinator.manual_action('starting_soon', action)
        elif action in ('queue-next','queue-remove','queue-first'):
            rows = clip_library.resolve(body.get('paths')) if action=='queue-next' else None
            self.player.edit_queue(action, body, rows)
        elif action == 'apply-layout':
            if self.snapshot()['ready']:
                self.place_clip(self.snapshot().get('clip_path',''))
        elif action == 'set-art':
            config = settings.read()
            if body.get('file') not in config['artwork']:
                raise ValueError('Include this background in the rotation first.')
            self.publish(artwork_index=config['artwork'].index(body['file']))
            self.last_rotation = time.monotonic()
        elif action == 'next-art':
            self.publish(artwork_index=self.snapshot()['artwork_index'] + 1)
            self.last_rotation = time.monotonic()
        elif action in ('show-message','hide-message'):
            settings.save({'show_message':action=='show-message'})
        else:
            raise ValueError('Unknown Starting Soon action.')

    def tick(self):
        if self.session and not self.session.owns_scene():
            self.close()
        config = settings.read()
        if config.get('rotate_artwork',True) and time.monotonic() - self.last_rotation >= config['rotation_seconds']:
            self.execute('next-art', {})

    def close(self):
        self.player.close()
        if getattr(self,'_placed_override',False):
            self.place_clip()
        if self.session:
            session, self.session = self.session, None
            session.finish()
        self.publish(active=False)
