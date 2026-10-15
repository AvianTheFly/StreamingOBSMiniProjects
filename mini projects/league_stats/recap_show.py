"""Shared recap playhead and manual intent; evaluated on reads, no timer/worker."""
VIEWS = ('highlights', 'tempo', 'combat', 'build', 'economy', 'vision', 'moments', 'story')
SAFE_PHASES = {'Matchmaking', 'ReadyCheck', 'ChampSelect'}


class RecapShow:
    def __init__(self, clock):
        self.clock = clock
        self.match = None
        self.revision = 0
        self.anchor = clock()
        self.position = 0
        self.playing = True
        self.manual_until = 0
        self.hold_until = 0
        self.queue_active = False

    def observe_phase(self, phase):
        active = phase in SAFE_PHASES
        if active and not self.queue_active:
            self.position = 0
            self.anchor = self.clock()
            self.hold_until = 0
            self.revision += 1
        self.queue_active = active

    def sync(self, match):
        if match != self.match:
            self.match = match
            self.position = 0
            self.anchor = self.clock()
            self.playing = True
            self.manual_until = 0
            self.hold_until = 0
            self.revision += 1

    def playhead(self):
        if self.playing and self.hold_until:
            return self.position + (1 + int((self.clock()-self.hold_until)//12) if self.clock() >= self.hold_until else 0)
        return self.position + (int(max(0, self.clock()-self.anchor)//12) if self.playing else 0)

    def snapshot(self, *, auto, eligible, safe):
        head = self.playhead()
        pinned = self.clock() < self.manual_until
        visible = bool(self.match and safe and (pinned or auto and eligible))
        return dict(revision=self.revision, match_id=self.match, view=VIEWS[head % len(VIEWS)],
                    page=head//len(VIEWS), playing=self.playing, auto=auto, visible=visible,
                    pinned=pinned, safe=safe, hold_remaining=max(0, self.hold_until-self.clock()) if self.playing else 0,
                    remaining=max(0, 12-(self.clock()-(self.hold_until or self.anchor))%12) if self.playing else 0)

    def validate(self, body):
        if not isinstance(body, dict) or body.get('match_id') != self.match or body.get('revision') != self.revision:
            raise ValueError('Recap changed. Refresh and try again.')
        if body.get('action') not in {'show','hide','auto','pause','play','view','next','previous'}:
            raise ValueError('Unknown recap control')
        if body.get('action') == 'view' and body.get('view') not in VIEWS:
            raise ValueError('Unknown recap view')

    def apply(self, body):
        self.validate(body)
        action = body['action']
        head = self.playhead()
        if action == 'view':
            head = VIEWS.index(body['view'])
        elif action in {'next','previous'}:
            # Browse remaining rows of the selected story, not another tab.
            head = max(head % len(VIEWS), head + (len(VIEWS) if action=='next' else -len(VIEWS)))
        elif action == 'pause':
            self.playing = False
        elif action in {'play','auto'}:
            self.playing = True
        if action == 'show':
            self.manual_until = self.clock() + 1800
        elif action in {'hide','auto'}:
            self.manual_until = 0
        self.position = head
        self.anchor = self.clock()
        self.hold_until = self.clock()+30 if action in {'view','next','previous'} and self.playing else 0
        self.revision += 1
