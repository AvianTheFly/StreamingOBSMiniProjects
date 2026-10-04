"""Read-only Riot transport, credential refresh, identity and request budgets."""
from collections import deque
import hashlib
import math
import os
import time
from urllib.parse import quote
import requests
from dotenv import dotenv_values
from lib.paths import ENV_FILE
from .config import REGIONS


class Deferred(Exception):
    """Keep queued work until the transport can make its next request."""


class RiotFailure(ValueError):
    """Sanitized failure: no response bodies, headers or credentials escape."""


class KeySource:
    def __init__(self,path=ENV_FILE):
        self.path=path
        self.initial_env=os.environ.get('RIOT_API_KEY','')
        self.initial_file=self._file()
        self.environment_override=bool(self.initial_env and self.initial_env!=self.initial_file)

    def _file(self):
        try:return (dotenv_values(self.path).get('RIOT_API_KEY') or '').strip()
        except (OSError,UnicodeError):return ''

    def read(self):
        env=os.environ.get('RIOT_API_KEY','').strip()
        if self.environment_override or env!=self.initial_env:
            return env,'process environment'
        return self._file(),'root .env'


class RiotClient:
    def __init__(self,http,*,keys=None,clock=time.monotonic,wall=time.time):
        self.http=http;self.keys=keys or KeySource();self.clock=clock;self.wall=wall
        self.fingerprint=None;self.identities={};self.calls={};self.windows={}
        self.blocked_until=0;self.last_request=-1000;self.last_success=None
        self.state='unconfigured';self.message='Local tracking works without a Riot key'
        self.platform='na1';self.key_source='root .env'

    def credential(self):
        key,self.key_source=self.keys.read()
        fingerprint=hashlib.sha256(key.encode()).digest() if key else None
        if fingerprint!=self.fingerprint:
            self.identities.clear()
            if self.state=='unauthorized':self.blocked_until=0
            self.fingerprint=fingerprint
            self.state='ready' if key else 'unconfigured'
            self.message='Ready for optional enrichment' if key else 'Local tracking works without a Riot key'
        return key

    def available(self):return bool(self.credential())

    def snapshot(self):
        configured=self.available()
        return dict(configured=configured,state=self.state,message=self.message,platform=self.platform,
                    key_source=self.key_source,retry_seconds=max(0,math.ceil(self.blocked_until-self.clock())),
                    last_success=self.last_success)

    @staticmethod
    def pairs(value):
        result={}
        for entry in str(value or '').split(','):
            try:
                count,seconds=map(float,entry.strip().split(':'))
                if math.isfinite(count) and math.isfinite(seconds) and count>=0 and seconds>0:
                    result[seconds]=count
            except ValueError:pass
        return result

    def get(self,host,path,*,method):
        key=self.credential();now=self.clock()
        if not key:raise Deferred('Riot key is not configured')
        if now<self.blocked_until:raise Deferred(self.message)
        calls=self.calls.setdefault(host,deque())
        while calls and calls[0]<=now-120:calls.popleft()
        wait=max(0,1.5-(now-self.last_request),calls[0]+120-now if len(calls)>=90 else 0)
        for (h,scope,seconds),(limit,count,expiry) in self.windows.items():
            if h==host and scope in ('app',method) and count>=limit and expiry>now:
                wait=max(wait,expiry-now)
        if wait>0:
            self.blocked_until=now+wait;self.state='waiting';self.message='Pacing Riot requests; local tracking continues'
            raise Deferred(self.message)
        self.last_request=now;calls.append(now)
        # Account resolution and match reads share this one owned session/budget.
        try:
            response=self.http.get(f'https://{host}.api.riotgames.com{path}',headers={'X-Riot-Token':key},
                                   timeout=2,allow_redirects=False)
        except requests.RequestException:
            self.blocked_until=now+30;self.state='unavailable';self.message='Riot connection unavailable; retrying shortly'
            raise RiotFailure(self.message) from None
        for prefix,scope in [('X-App-Rate-Limit','app'),('X-Method-Rate-Limit',method)]:
            limits=self.pairs(response.headers.get(prefix))
            counts=self.pairs(response.headers.get(prefix+'-Count'))
            for seconds,limit in limits.items():
                prior=self.windows.get((host,scope,seconds))
                expiry=prior[2] if prior and prior[2]>now else now+seconds
                self.windows[(host,scope,seconds)]=(limit,counts.get(seconds,0),expiry)
        code=response.status_code
        if code==429:
            try:delay=float(response.headers.get('Retry-After','120'))
            except ValueError:delay=120
            if not math.isfinite(delay) or delay<0:delay=120
            self.blocked_until=now+max(1,delay);self.state='rate_limited';self.message='Riot rate limit; queued work will resume automatically'
            raise Deferred(self.message)
        if code in (401,403):
            self.blocked_until=now+600;self.state='unauthorized';self.message='Riot key was refused; renew it in the Developer Portal'
            raise Deferred(self.message)
        if code==404:return None
        if code!=200:
            self.blocked_until=now+(60 if code>=500 else 300);self.state='unavailable'
            self.message=f'Riot returned HTTP {code}; local records remain available'
            raise RiotFailure(self.message)
        try:data=response.json()
        except ValueError:raise RiotFailure('Riot returned invalid JSON') from None
        self.state='connected';self.message='Riot enrichment connected';self.last_success=self.wall()
        return data

    def identity(self,name,tag,platform):
        self.credential()
        if not name or not tag:raise RiotFailure('Open League once to identify your Riot name and tag')
        cache=(name,tag,platform)
        if cache not in self.identities:
            data=self.get(REGIONS[platform],f'/riot/account/v1/accounts/by-riot-id/{quote(name,safe="")}/{quote(tag,safe="")}',method='account')
            if not isinstance(data,dict) or not data.get('puuid'):raise RiotFailure('Riot ID was not found in the selected region')
            if (data.get('gameName') and data['gameName'].casefold()!=name.casefold()) or (data.get('tagLine') and data['tagLine'].casefold()!=tag.casefold()):
                raise RiotFailure('Riot resolved a different account identity')
            if len(self.identities)>=128:self.identities.pop(next(iter(self.identities)))
            self.identities[cache]=data['puuid']
        return self.identities[cache]

    def match(self,game_id,platform,*,timeline=False):
        self.platform=platform
        suffix='/timeline' if timeline else ''
        return self.get(REGIONS[platform],f'/lol/match/v5/matches/{platform.upper()}_{quote(str(game_id),safe="")}{suffix}',
                        method='timeline' if timeline else 'match')
