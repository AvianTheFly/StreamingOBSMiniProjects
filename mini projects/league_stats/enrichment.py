"""Bounded resumable optional enrichment, independent of launcher availability."""
from collections import deque
from .riot import Deferred, RiotFailure


class Enrichment:
    def __init__(self,tracker,riot):
        self.tracker=tracker;self.riot=riot;self.pending=deque();self.identities={}
        self.last_plan=-1000;self.requested=True;self.context=None
        self.outcomes={};self.saved_matches=0;self.saved_timelines=0;self.message='Local tracking is ready'

    def retry(self):
        # Explicit refresh replans work; it never bypasses transport rate limits.
        self.outcomes.clear();self.requested=True

    def plan(self):
        context=(self.riot.fingerprint,self.tracker.settings['region'])
        if context!=self.context:
            self.pending.clear();self.outcomes.clear();self.context=context
        self.outcomes={key:value for key,value in self.outcomes.items() if value[1]>self.riot.clock()}
        records=sorted(self.tracker.records.values(),key=lambda r:r.get('started_at',0),reverse=True)[:100]
        selected={r['id'] for r in records}
        self.pending=deque(p for p in self.pending if p[0] in selected)
        queued={p[:2] for p in self.pending}
        for r in records:
            scope=self.riot.fingerprint.hex()[:16] if self.riot.fingerprint else None
            kind='match' if r.get('source')!='match_v5' or not r.get('api_identity_verified') or r.get('api_identity_scope')!=scope else 'timeline' if not r.get('timeline_version') else None
            key=(r['id'],kind)
            if kind and key not in queued and key not in self.outcomes and len(self.pending)<100:
                self.pending.append((*key,0));queued.add(key)

    def tick(self):
        if not self.riot.available():return
        now=self.riot.clock()
        if self.requested or now-self.last_plan>=60 or self.context!=(self.riot.fingerprint,self.tracker.settings['region']):
            with self.tracker.lock:self.plan()
            self.last_plan=now;self.requested=False
        if not self.pending:return
        identity,kind,attempt=self.pending[0]
        with self.tracker.lock:
            record=self.tracker.records.get(identity)
            names=dict(self.tracker.store.metadata('riot_ids') or {})
            region=self.tracker.settings['region']
        if not record:self.pending.popleft();return
        try:
            if kind=='match':
                name=names.get(record['account'],{})
                remote=self.riot.identity(name.get('name'),name.get('tag'),region)
                data=self.riot.match(record['game_id'],region)
                if data is None:
                    self.outcomes[(identity,kind)]=('not_found',now+600);self.message='A match is not available from Riot in this region'
                else:
                    match_id=data.get('metadata',{}).get('matchId')
                    if match_id!=f'{region.upper()}_{record["game_id"]}':raise RiotFailure('Riot returned a different match identity')
                    if not self.tracker.enrich(data,record['account'],official_account=remote,identity_scope=self.riot.fingerprint.hex()[:16]):raise RiotFailure('Your verified Riot account is absent from this match')
                    self.saved_matches+=1;self.message='Verified match saved'
                    self.pending.append((identity,'timeline',0))
            else:
                data=self.riot.match(record['game_id'],region,timeline=True)
                if data is None:self.outcomes[(identity,kind)]=('not_found',now+600);self.message='Timeline not available; match totals are preserved'
                else:self.tracker.enrich_timeline(data,identity);self.saved_timelines+=1;self.message='Timeline saved'
            self.pending.popleft()
        except Deferred:
            pass  # Do not pop or consume an attempt while waiting for a budget/key.
        except (RiotFailure,ValueError,OSError,TypeError,KeyError) as exc:
            self.message=str(exc) if isinstance(exc,(RiotFailure,ValueError)) else 'Enrichment could not be saved; original data is preserved'
            self.pending.popleft()
            if attempt<2:self.pending.append((identity,kind,attempt+1))
            else:self.outcomes[(identity,kind)]=('unavailable',now+600)

    def snapshot(self):
        self.riot.platform=self.tracker.settings['region']
        return dict(**self.riot.snapshot(),pending=len(self.pending),saved_matches=self.saved_matches,
                    saved_timelines=self.saved_timelines,unavailable=len(self.outcomes),detail=self.message)
