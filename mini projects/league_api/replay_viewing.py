"""Replay viewing scene intent; the client scene owner serializes this state."""


class ReplayViewing:
    def __init__(self, director):
        self.director = director
        self.active = False
        self.manual_revision = None
        self.presented = False
        self.return_pending = False

    def observe(self, active, revision):
        if active is None or active == self.active:
            return False
        self.active = active
        self.presented = False
        self.return_pending = not active
        self.director.cancel_pending('league_replay')
        self.director.cancel_pending('league_client')
        if active:
            self.manual_revision = revision
        return True

    def present(self, client, scene):
        if self.presented:
            return
        if self.director.snapshot()['manual_revision'] != self.manual_revision:
            self.presented = True
            return
        self.presented = self.director.request(scene, owner='league_replay',
            reason='Watching a League replay', automatic=True, client=client,
            expected_manual_revision=self.manual_revision)

    def close(self):
        self.director.cancel_pending('league_replay')
