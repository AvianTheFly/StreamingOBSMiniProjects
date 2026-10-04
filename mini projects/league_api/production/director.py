"""Stateful ambience plus one short production show; no media or OBS side effects."""
import copy
import time
from .catalog import show_for
from .config import DEFAULTS
from .objectives import dragon_state


class ProductionDirector:
    def __init__(self, settings=None, clock=time.monotonic):
        self.settings = copy.deepcopy(settings or DEFAULTS)
        self.clock = clock
        self.serial = 0
        self.ambient = None
        self.effect = None
        self.demo = None
        self.suppressed_cycle = None
        self.last_show = -1000
        self.cooldowns = {}
        self.history = []

    def _present(self, shows, now):
        eligible = [show for show in shows if now-self.cooldowns.get(show['key'],-1000)>=show['cooldown']]
        if not eligible: return
        show = max(eligible, key=lambda item:item['priority'])
        current = self.effect if self.effect and self.effect['expires']>now else None
        upgrade = current and show['family']==current['family'] and show['rank']>current.get('rank',0)
        transition = show['kind']=='dragon' or show['family']=='ending'
        major = show['priority']>=80
        admitted = (transition or not current or show['priority']>current['priority']) and (
            transition or upgrade or major or now-self.last_show>=self.settings['spacing_seconds'])
        if admitted:
            self.serial += 1
            self.effect = dict(show,id=self.serial,started=now,expires=now+show['duration'])
            self.last_show = now
            self.cooldowns[show['key']] = now
        self.history.append(dict(title=show['title'],key=show['key'],result='Shown' if admitted else 'Skipped to keep gameplay clear',time=now))
        from events import inspect_event
        inspect_event('league_production.show', owner='league_api', kind=show['key'],
                      phase='shown' if admitted else 'skipped', reason='Priority and spacing gate')
        self.history = self.history[-40:]

    def clear(self):
        self.suppressed_cycle = self.ambient['id'] if self.ambient else None
        self.ambient = self.effect = self.demo = None

    def configure(self, settings):
        self.settings = copy.deepcopy(settings)
        self.clear()
        self.suppressed_cycle = None

    def ingest(self, data, candidates, baseline=False):
        now = self.clock()
        if not self.settings['enabled']:
            self.clear()
            return
        if any(e.get('EventName') == 'GameEnd' for e in data.get('events', {}).get('Events', [])):
            self.ambient = self.demo = None
            if baseline:
                self.effect = None
                return
            endings = [show for candidate in candidates if candidate.get('confidence')=='observed' and candidate['key'] in {'victory','defeat','game_end'}
                       and (show:=show_for(candidate,self.settings))]
            if not self.effect or self.effect.get('family')!='ending': self.effect=None
            self._present(endings,now)
            return
        state = dragon_state(data) if self.settings['dragon_ambience'] else None
        previous = self.ambient
        if state and state['id'] != self.suppressed_cycle:
            if not self.ambient or self.ambient['id'] != state['id']:
                self.ambient = dict(state, started=now - 2 if baseline else now)
        else:
            self.ambient = None
        if baseline:
            self.effect = self.demo = None
            # Engine only emits a fresh GameStart baseline in the first 5 seconds.
            candidates = [c for c in candidates if c['key']=='game_start'] if data.get('gameData',{}).get('gameTime',99)<=5 else []
        shows = [show for candidate in candidates if (candidate.get('confidence') == 'observed' or
                 candidate.get('confidence')=='possible' and candidate['key'].startswith('possible_') and self.settings.get('inferred',False))
                 and (show := show_for(candidate, self.settings))]
        # A steal upgrades the dragon's destruction rather than obscuring it.
        dragon = next((show for show in shows if show['kind'] == 'dragon'), None)
        if dragon and any(c['key'] == 'objective_steal' for c in candidates):
            dragon.update(priority=99, title=dragon['title'].replace('SECURED', 'STOLEN'))
        if shows:
            self._present(shows,now)
        elif previous and not self.ambient and not baseline:
            self.serial += 1
            self.effect = dict(id=self.serial, kind='release', theme=previous['theme'], title='',
                               started=now, expires=now+.8, duration=.8, family='objective', rank=0, priority=0)

    def preview(self, key):
        if not self.settings['enabled']:
            raise ValueError('Enable production borders before testing in OBS')
        if not isinstance(key, str):
            raise ValueError('Choose a supported production effect')
        if key == 'earth_cycle':
            self.serial += 1
            self.demo = dict(id='preview-'+str(self.serial), started=self.clock(), expires=self.clock()+7)
            return
        show = show_for({'key': key}, self.settings, preview=True)
        if not show:
            raise ValueError('Choose a supported, enabled production effect')
        self.serial += 1
        now = self.clock()
        self.demo = None
        self.effect = dict(show, id=self.serial, started=now, expires=now+show['duration'])

    def snapshot(self):
        now = self.clock()
        ambient, effect = self.ambient, self.effect
        if not self.settings['enabled']:
            ambient = effect = None
        if self.demo and self.demo['expires'] > now:
            t = now-self.demo['started']
            ambient = dict(id=self.demo['id'], theme='earth', started=self.demo['started'], estimated=False) if t < 3 else None
            effect = dict(id=self.demo['id']+'-kill', key='dragon_earth', kind='dragon', theme='earth', title='MOUNTAIN DRAGON SECURED',
                          started=self.demo['started']+3, expires=self.demo['started']+6.2, duration=3.2) if 3 <= t < 6.2 else None
        return dict(enabled=self.settings['enabled'], opacity=self.settings['opacity'], edge_width=self.settings['edge_width'], intensity=self.settings.get('intensity',1.15),
                    ambient={**ambient, 'elapsed':now-ambient['started']} if ambient else None,
                    effect={**effect, 'elapsed':now-effect['started']} if effect and effect['expires'] > now else None)
