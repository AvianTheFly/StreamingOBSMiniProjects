"""One opening on the existing clip worker, followed by an ownership-checked lobby handoff."""

from pathlib import Path

from lib.project_runtime import project_registry

from lib.coordination.scenes import scene_director

from . import presentation

from .config import STAGE, SCENE



OPENING = Path('C:/StreamingMedia/ChannelPresentation/2026-10-04/spirit-slideshow-v3-calm/sanctuary-slideshow-40s.mp4')



CINEMATIC = Path('C:/StreamingMedia/ChannelPresentation/2026-10-10/spirit-slideshow-v4-ram-impact/sanctuary-slideshow-40s.mp4')



def catalog():

    return {'id': 'sanctuary-calm', 'title': 'Sanctuary', 'seconds': 40,

            'available': OPENING.is_file() and OPENING.stat().st_size > 0,

            'cinematic': {'title': 'Sanctuary · Ram impact', 'seconds': 40,

                          'poster': '/assets/sanctuary-cinematic.png',

                          'available': CINEMATIC.is_file() and CINEMATIC.stat().st_size > 0}}





class Opening:

    def __init__(self, service):

        self.service = service

        self.active = False

        self.transform = None

        self.revision = None



    def start(self, cinematic=False):

        path = CINEMATIC if cinematic else OPENING

        if not path.is_file() or path.stat().st_size == 0:

            raise ValueError('The Sanctuary opening is missing.')

        if self.active:

            return

        service = self.service

        service.player.close()

        if not service.session or not service.session.owns_scene():

            service.execute('start', {})

        self.transform = presentation.clip_transform()

        self.revision = scene_director.snapshot()['manual_revision']

        try:

            self.active = True

            presentation.place_fullscreen()

            if not service.session.present(STAGE):

                raise ValueError('Scene selection changed before the opening.')

            service.publish(opening=True, cinematic=cinematic, error='')

            service.player.play([{'path': str(path), 'title': 'Sanctuary · Ram impact' if cinematic else 'Sanctuary opening'}],

                                service.session, loop=False)

        except BaseException:

            self.close()

            if service.session and service.session.owns_scene():

                service.session.present(SCENE)

            raise



    def tick(self):

        if self.active and self.service.player.done.is_set():

            playback = self.service.player.snapshot()

            if not playback['busy']:

                if playback.get('history') and playback['history'][0]['outcome'] == 'failed':

                    self.service.publish(error='The opening could not play. Try again.')

                self.finish()



    def finish(self):

        if not self.active:

            return

        service = self.service

        session = service.session

        owned = session is not None and session.owns_scene()

        self.close()  # Wait for the actual source cleanup before restoring placement.

        if owned and session.owns_scene() and service.snapshot().get('error'):

            session.present(SCENE)

        elif owned and session.owns_scene():

            owner = project_registry.get('scene_voice_switcher')

            present = getattr(owner, 'present_lobby', None)

            if not callable(present):

                raise ValueError('Lobby controls are unavailable.')

            try:

                present(expected_manual_revision=self.revision)

            except BaseException:

                if session.owns_scene():

                    session.present(SCENE)

                raise

            service.close()



    def close(self):

        if not self.active and self.transform is None:

            return

        self.service.player.close()

        self.active = False

        if self.transform is not None:

            presentation.restore_clip_transform(self.transform)

            self.transform = None

        self.service.publish(opening=False, cinematic=False)

