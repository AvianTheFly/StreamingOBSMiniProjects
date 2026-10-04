"""One bounded polling worker using the existing League transports."""
from collections import deque
import time
from urllib.parse import quote
import requests
from lib.league_client import LeagueClient
from lib.league_live_client import fetch_snapshot, LiveClientUnavailable
from .riot import RiotClient
from .enrichment import Enrichment
from .normalize import same_player


class Collector:
    def __init__(self, tracker, stop, client=None, fetch=fetch_snapshot):
        self.tracker, self.stop = tracker, stop
        self.client, self.fetch = client or LeagueClient(), fetch
        self.phase = ''
        self.account = None
        self.session = {}
        self.pending = deque()
        self.next_client = self.next_history = self.next_catalog = 0
        self.http = requests.Session()
        self.http.trust_env = False
        self.riot = RiotClient(self.http)
        self.enrichment = Enrichment(tracker,self.riot)
        self.next_rank = 0

    def context(self):
        self.phase = self.client.get('/lol-gameflow/v1/gameflow-phase')
        self.account = self.client.get('/lol-summoner/v1/current-summoner')
        if not isinstance(self.account,dict) or not self.account.get('puuid'):
            raise ValueError('League account identity is unavailable')
        with self.tracker.lock:
            if self.tracker.account!=self.account['puuid']:
                self.next_rank=0;self.next_history=0
                if self.tracker.current:
                    self.tracker.flush()
                self.tracker.current = None
            self.tracker.account = self.account['puuid']
            self.tracker.account_name = self.account.get('gameName') or self.account.get('displayName','')
            name=self.account.get('gameName');tag=self.account.get('tagLine')
            if name and tag:self.tracker.identify(self.account['puuid'],name,tag)
            saved = dict(id=self.tracker.account,name=self.tracker.account_name)
            if self.tracker.store.metadata('last_account')!=saved:
                self.tracker.store.metadata('last_account',saved)
        self.session = self.client.get('/lol-gameflow/v1/session') if self.phase in ('InProgress','Reconnect') else {}

    def catalogs(self):
        if not self.tracker.catalog:
            data = self.client.get('/lol-game-data/assets/v1/champion-summary.json')
            if isinstance(data,list):
                self.tracker.catalog = {str(p['id']):{'name':p['name']} for p in data if p.get('id',-1)>0}
                self.tracker.store.metadata('champions', self.tracker.catalog)
        if not self.tracker.item_catalog:
            data = self.client.get('/lol-game-data/assets/v1/items.json')
            if isinstance(data,list):
                self.tracker.item_catalog = {str(p['id']):{'name':p['name']} for p in data if p.get('id') and p.get('name')}
                self.tracker.store.metadata('items', self.tracker.item_catalog)

    def plan_history(self, count):
        account = self.account['puuid']
        data = self.client.get('/lol-match-history/v1/products/lol/'+quote(account,safe='')+f'/matches?begIndex=0&endIndex={count-1}')
        container = data.get('games',{})
        games = container.get('games',[]) if isinstance(container,dict) else container
        existing = {str(g[1]) for g in self.pending if g[0]==account}
        for game in games[:count]:
            game_id = game.get('gameId')
            if not game_id or str(game_id) in existing:
                continue
            old = self.tracker.records.get(f'{account}:{game_id}',{})
            source = old.get('source')
            if source in ('match_v5','league_client') and old.get('schema_version',0)>=2:
                continue
            self.pending.append((account,game_id,0))
            existing.add(str(game_id))
        with self.tracker.lock:
            self.tracker.import_busy = bool(self.pending)
            self.tracker.history_status = (f'{len(self.pending)} local matches waiting for sync'
                                           if self.tracker.import_busy else 'Recent match history is synchronized')

    def sync_one(self):
        if not self.pending:
            return
        account,game_id,attempt = self.pending.popleft()
        try:
            data = self.client.get('/lol-match-history/v1/games/'+str(game_id))
            if not self.tracker.enrich(data,account):
                raise ValueError('Match record has no matching player or game duration')
            self.enrichment.requested=True
        except (OSError,ValueError,TypeError,KeyError) as exc:
            if attempt<2:
                self.pending.append((account,game_id,attempt+1))
            self.tracker.history_status = 'Match history unavailable; will retry when the client is ready'
        with self.tracker.lock:
            self.tracker.import_busy = bool(self.pending)

    def step(self):
        now = time.monotonic()
        if now>=self.next_client:
            self.next_client = now+5
            old_phase = self.phase
            try:
                self.context()
                if old_phase in ('InProgress','Reconnect') and self.phase not in ('InProgress','Reconnect'):
                    self.next_history = min(self.next_history,now+5)
                    self.next_rank = min(self.next_rank,now+5)
            except (OSError,ValueError,TypeError,KeyError):
                self.phase = ''
                self.session = {}
                self.account = None
        if self.stop.is_set():
            return
        if self.phase in ('InProgress','Reconnect') and self.account:
            game = self.session.get('gameData',{})
            game_id = game.get('gameId')
            if game_id:
                try:
                    data = self.fetch()
                    # Spectated players/replays cannot be credited to the signed-in account.
                    if not same_player(data.get('activePlayer',{}),self.account):
                        raise ValueError('Live player differs from the signed-in League account')
                    q = game.get('queue') or {}
                    self.tracker.ingest(data, account=self.account['puuid'],game_id=game_id,
                                        context=dict(queue=q.get('id',game.get('queueId')),map=game.get('map',{}).get('id')))
                except LiveClientUnavailable:
                    self.tracker.disconnected()
                except (ValueError,TypeError,KeyError) as exc:
                    self.tracker.disconnected()
                    self.tracker.error = str(exc)
        else:
            self.tracker.disconnected()
        self.tracker.drain_chat()
        if self.tracker.enrichment_requested:
            self.tracker.enrichment_requested=False
            self.enrichment.retry()
        if not self.stop.is_set():
            self.enrichment.tick()
            with self.tracker.lock:self.tracker.enrichment_status=self.enrichment.snapshot()
        if not self.account or self.stop.is_set():
            return
        if now>=self.next_rank:
            self.next_rank=now+60
            try:self.tracker.observe_rank(self.account['puuid'],self.client.get('/lol-ranked/v1/current-ranked-stats'))
            except (OSError,ValueError,TypeError,KeyError):pass
        if now>=self.next_catalog and (not self.tracker.catalog or not self.tracker.item_catalog):
            self.next_catalog = now+300
            try:
                self.catalogs()
            except (OSError,ValueError,KeyError,TypeError):
                pass
        if now>=self.next_history or self.tracker.import_requested:
            with self.tracker.lock:
                count = 100 if self.tracker.import_requested else 20
                self.tracker.import_requested = False
            self.next_history = now+60
            try:
                self.plan_history(count)
            except (OSError,ValueError,TypeError,KeyError):
                self.tracker.history_status = 'Open the League client to sync match history'
        if not self.stop.is_set():
            if self.pending:
                self.sync_one()


    def run(self):
        try:
            while not self.stop.is_set():
                try:
                    self.step()
                except Exception as exc:
                    # Preserve personal data on malformed input or a failed archive write.
                    self.tracker.error = f'{type(exc).__name__}: {exc}'
                self.stop.wait(1)
        finally:
            self.http.close()
            self.tracker.flush()
