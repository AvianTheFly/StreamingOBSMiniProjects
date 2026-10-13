"""Waiting-room policy and serialized session lifetime owned by the feature."""

import threading

import time

from coordinator import coordinator

from . import settings, clip_library, presentation, artwork, layouts

from .config import SCENE

from .player import ClipPlayer

from .opening import Opening, catalog as opening_catalog





class StartingSoon:

    def __init__(self, queue, port):

        self.queue, self.port = queue, port

        self.lock = threading.RLock()

        self.data = dict(ready=False, active=False, playing=False, clip_title='', error='', artwork_index=0)

        self.session = None

        self._preserved_box = None

        self._placed_override = False

        self.player = ClipPlayer(coordinator.permission('starting_soon'), self.publish, self.place_clip)

        self.opening = Opening(self)

        self.last_rotation = time.monotonic()



    def publish(self, **changes):

        with self.lock:

            self.data = {**self.data, **changes}



    def snapshot(self):

        with self.lock:

            data = dict(self.data)

        catalog = artwork.catalog()

        return {**settings.read(), **data, 'session_queue':self.player.snapshot(),

                'opening_catalog': opening_catalog(),

                'artwork_catalog':catalog, 'layout_catalog':layouts.PRESETS,

                'available_artwork': [row['file'] for row in catalog]}



    def status(self):

        """Cheap live status; background observers never build editor catalogs."""

        with self.lock:

            data = {key:self.data.get(key) for key in (

                'active', 'clip_title', 'opening', 'cinematic', 'artwork_index', 'error')}

        return {**data, **self.player.status()}



    def workflow_state(self):

        data, config = self.status(), settings.read()

        images = config['artwork']

        return {'opening': bool(data['opening']), 'cinematic': bool(data['cinematic']), 'active': bool(data['active']),

                'artwork_file': images[(data['artwork_index'] or 0) % len(images)] if images else None,

                'error': data['error'] or ''}



    def tick_interval(self):

        return .25 if self.session is not None else 1.0



    def place_clip(self, path=''):

        if getattr(self, 'opening', None) and self.opening.active:

            presentation.place_fullscreen()

            self.publish(clip_box=[0, 0, 1920, 1080])

            return

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

        if action in ('intro', 'cinematic'):

            self.opening.start(cinematic=action == 'cinematic')

        elif action == 'skip-intro':

            self.opening.finish()

        elif action == 'install':

            presentation.attach(self.port)

            self.place_clip()

            self.publish(ready=True, error='')

        elif action == 'start':

            if getattr(self, 'opening', None) and self.opening.active:

                self.opening.close()

                if self.session and self.session.owns_scene():

                    self.session.present(SCENE)

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

            self.last_rotation = time.monotonic()

            self.publish(ready=True, active=True, error='')

        elif action == 'finish':

            self.close()

        elif action == 'play':

            if getattr(self, 'opening', None) and self.opening.active:

                raise ValueError('Finish the opening before playing a playlist.')

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

            with self.lock:

                self.publish(artwork_index=self.data['artwork_index'] + 1)

            self.last_rotation = time.monotonic()

        elif action in ('show-message','hide-message'):

            settings.save({'show_message':action=='show-message'})

        else:

            raise ValueError('Unknown Starting Soon action.')



    def tick(self):

        if self.session and not self.session.owns_scene():

            self.close()

        if self.session is None:

            return  # No waiting-room policy or disk reads during gameplay.

        if getattr(self, 'opening', None):

            self.opening.tick()

        config = settings.read()

        if config.get('rotate_artwork',True) and time.monotonic() - self.last_rotation >= config['rotation_seconds']:

            self.execute('next-art', {})



    def close(self):

        if getattr(self, 'opening', None):

            self.opening.close()

        self.player.close()

        if getattr(self,'_placed_override',False):

            self.place_clip()

        if self.session:

            session, self.session = self.session, None

            session.finish()

        self.publish(active=False)

