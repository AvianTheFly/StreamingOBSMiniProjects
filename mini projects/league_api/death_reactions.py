"""Death lifecycle and evidence classification, independent of OBS and alert rules.

Tune timings and curated pools here. Uses the existing browser source and fader.
Unknown ownership never counts as a payoff. A payoff remains latched until respawn.
"""
import random

SPLASH_SECONDS = 2.5
LOOKBACK_SECONDS = 8
TRADE_SECONDS = 8
CLIP_SECONDS = 6
POOLS = {
    'bad': ('emotional-damage', 'michael-no', 'this-is-fine', 'homer-bush'),
    'worth': ('stonks', 'tobey-dance', 'minions-dance', 'strange-bargain'),
}
OBJECTIVES = {'DragonKill', 'HordeKill', 'HeraldKill', 'BaronKill',
              'TurretKilled', 'InhibKilled'}


class DeathReactions:
    def __init__(self):
        self.reset()

    def reset(self):
        self.dead_since = None
        self.worth = False
        self.alert = None
        self.serial = 0
        self.last_media = None
        self.suspended = False

    def update(self, data, local, names, players, baseline, now):
        t = float(data['gameData']['gameTime'])
        if baseline or not local or not local.get('isDead'):
            self.reset()
            self.suspended = bool(baseline and local.get('isDead'))
            return
        if self.suspended:
            return
        if self.dead_since is None:
            self.dead_since = t
            self.started = now
        team = local.get('team')
        def owner(name):
            matches = [p for p in players if name in {
                p.get('summonerName'), p.get('riotId'), p.get('riotIdGameName'),
                str(p.get('riotIdGameName', '')) + '#' + str(p.get('riotIdTagLine', ''))}]
            return matches[0].get('team') if len(matches) == 1 else None
        events = data.get('events', {}).get('Events', [])
        deaths = [e for e in events if e.get('EventName') == 'ChampionKill'
                  and e.get('VictimName') in names
                  and abs(float(e.get('EventTime', -999)) - self.dead_since) <= 3]
        killer_names = {e.get('KillerName') for e in deaths}
        payoff = False
        for e in events:
            if not self.dead_since - LOOKBACK_SECONDS <= float(e.get('EventTime', -999)) <= min(t, self.dead_since + TRADE_SECONDS):
                continue
            kind = e.get('EventName')
            killer = e.get('KillerName')
            if kind == 'ChampionKill':
                payoff |= killer in names or bool(names.intersection(e.get('Assisters', [])))
                # A teammate trading an enemy for us is also a worthwhile death.
                payoff |= bool(team and owner(killer) == team
                               and e.get('VictimName') in killer_names
                               and owner(e.get('VictimName')) not in (None, team)
                               and float(e.get('EventTime', 0)) >= self.dead_since)
            elif kind in OBJECTIVES:
                payoff |= bool(team and owner(killer) == team
                               and (killer in names or names.intersection(e.get('Assisters', []))))
        if payoff and not self.worth:
            self.worth = True
            self.alert = None
        if now - self.started < SPLASH_SECONDS:
            return
        if self.alert and self.alert['expires'] > now:
            return
        mood = 'worth' if self.worth else 'bad'
        choices = [m for m in POOLS[mood] if m != self.last_media]
        self.last_media = random.choice(choices)
        self.serial += 1
        self.alert = dict(id=f'death-{self.started}-{self.serial}', key='death_reaction',
                          family='death_reaction', title='Worth it!' if self.worth else 'Oops…',
                          detail='Personal contribution or immediate trade of your killer' if self.worth else 'No confirmed personal payoff',
                          media=f'media/meme-{self.last_media}.mp4', media_kind='video',
                          expires=now + CLIP_SECONDS, remaining=CLIP_SECONDS,
                          start_time=0, loop=False, audio='', volume=0.7, priority=72)
