"""Tracker state, personal observations and archive reconciliation; no network I/O."""
import copy
import queue
import threading
import time
from . import analytics, commands, config, insights, observations, management, timeline
from .community import Community, spotlight
from .normalize import live, postgame
from .store import Store
from .ranked import Ranked
from . import presentation, chat_replies, audience


class Tracker:
    def __init__(self, store=None, settings_path=config.PATH, clock=time.time, monotonic=time.monotonic, reply=None):
        self.store = store or Store()
        self.settings_path = settings_path
        self.settings = config.read(settings_path)
        self.clock, self.monotonic = clock, monotonic
        self.lock = threading.RLock()
        self.records = {r['id']:analytics.public(r) for r in self.store.records()}
        self.current = None
        account_info = self.store.metadata('last_account') or {}
        self.account = account_info.get('id','')
        self.account_name = account_info.get('name','')
        self.last_seen = -1000
        self.last_save = -1000
        self.sessions = management.Sessions(self.store,clock)
        self.ranked=Ranked(self.store,clock)
        self.session_start = self.sessions.bounds()[0]
        self.community = Community(clock)
        self.status = 'Waiting for League client'
        self.error = None
        self.history_status = 'Recent match history will sync when League opens'
        self.catalog = self.store.metadata('champions') or {}
        self.item_catalog = self.store.metadata('items') or {}
        self.inbox = queue.Queue(maxsize=128)
        self.import_requested = False
        self.import_busy = False
        self.last_helper = None
        self.enrichment_requested=False
        self.enrichment_status={'configured':False,'state':'starting','message':'Checking optional enrichment'}
        self.reply = reply

    def _reply(self, message, text, *, helper=False):
        if self.reply and self.settings['chat_replies']:
            self.reply(message['channel'],text,message.get('id',''),allowed=lambda:
                       self.settings['chat_replies'] and (self.settings['helper_enabled'] if helper else self.settings['viewer_requests']))

    def _chat_facts(self):
        records = self._selection({'period':'session'})
        start,end = self.sessions.bounds()
        return analytics.aggregate(records),insights.report(records),dict(
            **audience.facts(self._selection({}),self._current_snapshot()),
            ranked=self.ranked.snapshot(self.account,start,end),recap=presentation.recap(records),
            progress=presentation.progress(records,self.settings))

    def _current_snapshot(self):
        current=copy.deepcopy(analytics.public(self.current)) if self.current else None
        if current:
            current['connected']=self.monotonic()-self.last_seen<=5 and current.get('state')=='live'
            current['cs_per_minute']=(60*current['metrics']['cs']/current['duration']
                                      if 'cs' in current['metrics'] and current.get('duration',0)>0 else None)
        return current

    def enqueue_chat(self, message):
        if commands.parse(message.get('text','')):
            with self.lock:
                queued = dict(message, expected_game=self.current['id'] if self.current else None, received_at=self.monotonic())
            try:
                self.inbox.put_nowait(queued)
            except queue.Full:
                pass

    def drain_chat(self):
        for _ in range(32):
            try:
                message = self.inbox.get_nowait()
            except queue.Empty:
                return
            parsed = commands.parse(message.get('text',''))
            with self.lock:
                if self.monotonic()-message['received_at']>5:
                    continue
                if parsed[0]=='spotlight':
                    if message.get('user') not in self.settings.get('blocked_helpers',[]):
                        try:
                            accepted = self.community.request(parsed[1],message['user'],message.get('id',''),self.settings)
                            if accepted:
                                summary,report,facts = self._chat_facts()
                                self._reply(message,chat_replies.stat(parsed[1],summary,report,**facts))
                        except ValueError:
                            pass
                    continue
                if not self.current or message['expected_game']!=self.current['id']:
                    continue
                if not commands.authorized(message,self.settings):
                    continue
                try:
                    action, metric = parsed
                    result=self.observe(action, metric, actor=message['user'], message_id=message.get('id',''),
                                        moderator=bool(message.get('moderator')) or message['user']==message['channel'])
                    self._reply(message,chat_replies.helper(action,metric,self.current,self.settings,observation=result.get('observation')),helper=True)
                except (ValueError, OSError) as exc:
                    self.last_helper = dict(ok=False, user=message['user'], text=str(exc))

    def _put(self, record):
        saved = self.store.put(record)
        self.records[saved['id']] = analytics.public(saved)
        if self.current and self.current['id']==saved['id']:
            self.current = saved
        return saved

    def ingest(self, data, *, account, game_id, context=None):
        with self.lock:
            record = live(data,account,game_id,self.clock())
            if self.current and self.current['id']!=record['id']:
                if self.current.get('state')=='live':
                    self.current['state'] = 'partial'
                self._put(self.current)
            old = self.records.get(record['id'], {})
            if self.current and self.current['id']==record['id']:
                old = self.current
            # The authoritative post-game record must never be downgraded on a stale live poll.
            if old.get('source') in ('league_client','match_v5'):
                return
            record['started_at'] = old.get('started_at',record['started_at'])
            if record['state']=='complete':
                record['ended_at'] = old.get('ended_at',self.clock())
            record['observations'] = copy.deepcopy(old.get('observations',[]))
            record['helper_tracking'] = True
            record['checkpoints'] = copy.deepcopy(old.get('checkpoints',{}))
            record['item_observations'] = copy.deepcopy(old.get('item_observations',[]))
            previous_ids = {str(i['id']) for i in old.get('items',[])}
            if old:
                for item in record['items']:
                    if str(item['id']) not in previous_ids:
                        record['item_observations'].append(dict(item,time=record['duration']))
            # An inventory appearance is not automatically classified as a purchase.
            record['item_observations'] = record['item_observations'][-300:]
            for minute in (5,10,15,20,30):
                if minute*60 <= record['duration'] <= minute*60+3 and str(minute) not in record['checkpoints']:
                    record['checkpoints'][str(minute)] = copy.deepcopy(record['metrics'])
                    if 'cs' in record['metrics']:
                        record['metrics']['cs_at_'+str(minute)] = record['metrics']['cs']
            for minute, checkpoint in record['checkpoints'].items():
                if 'cs' in checkpoint:
                    record['metrics']['cs_at_'+minute] = checkpoint['cs']
            if context:
                record.update(context)
            self._manual_metrics(record)
            self.current = record
            self.account = account
            self.records[record['id']] = record
            self.last_seen = self.monotonic()
            self.status = 'Tracking '+record['champion']
            self.error = None
            if self.monotonic()-self.last_save>=10 or record['state']=='complete':
                self._put(record)
                self.last_save = self.monotonic()

    _manual_metrics = staticmethod(observations.metrics)

    def identify(self,account,name,tag):
        with self.lock:
            identities=self.store.metadata('riot_ids') or {}
            value=dict(name=name,tag=tag)
            if identities.get(account)!=value:
                identities[account]=value
                self.store.metadata('riot_ids',identities)

    def observe_rank(self,account,data):
        with self.lock:self.ranked.observe(account,data,self.sessions.state['current']['id'])

    def retry_enrichment(self):
        with self.lock:self.enrichment_requested=True
        return dict(ok=True,message='Optional enrichment refresh queued; active Riot rate limits remain respected')

    def enrich(self, data, account, *, official_account=None,identity_scope=None):
        record = postgame(data, official_account or account, self.catalog, self.item_catalog)
        if record is None:
            return False
        if official_account:
            record.update(id=f'{account}:{record["game_id"]}',account=account,api_account=official_account,
                          api_identity_verified=True,api_identity_scope=identity_scope,
                          api_match_id=data.get('metadata',{}).get('matchId'))
        with self.lock:
            old = self.records.get(record['id'],{})
            if old.get('source')=='match_v5' and record['source']!='match_v5':
                return False
            if official_account and old.get('api_identity_scope')!=identity_scope:
                record['timeline_version']=0
            # Preserve live-only objective fields and checkpoints; post-game wins on overlap.
            record['metrics'] = {**old.get('metrics',{}), **record['metrics']}
            record['matchups'] = {**old.get('matchups',{}), **record['matchups']}
            record['observations'] = copy.deepcopy(old.get('observations',[]))
            record['helper_tracking'] = old.get('helper_tracking',False)
            if self.current and self.current['id']==record['id']:
                record['ended_at'] = old.get('ended_at',self.clock())
            self._manual_metrics(record)
            self._put(record)
        return True

    def observe(self, action, metric=None, *, actor='Hub', message_id='', moderator=True):
        with self.lock:
            previous={o['id']:o.get('undone',False) for o in self.current.get('observations',[])} if self.current else {}
            record = observations.apply(self.current,action,metric,settings=self.settings,now=self.clock(),
                                        fresh=self.monotonic()-self.last_seen<=5,actor=actor,
                                        message_id=message_id,moderator=moderator)
            self._put(record)
            result=dict(ok=True,user=actor,text='Observation undone' if action=='undo' else metric.replace('_',' ')+' counted')
            changed=next((o for o in reversed(record['observations']) if o['id'] not in previous or o.get('undone',False)!=previous[o['id']]),None)
            if changed:result['observation']=copy.deepcopy(changed)
            self.last_helper=result
            return result

    def start_session(self,body):
        with self.lock:
            if self.current and self.current.get('state')=='live' and self.monotonic()-self.last_seen<=5:
                raise ValueError('Start a new session between games')
            result=self.sessions.start(body.get('name',''))
            self.session_start=result['started_at']
            self.community.clear()
            return dict(ok=True,session=result)

    def review_match(self,body):
        with self.lock:
            old=self.records.get(body.get('id'))
            if old is None:raise ValueError('Unknown archived match')
            saved=self._put(management.review(old,body,self.clock()))
            return dict(ok=True,revision=saved['review']['revision'])

    def correct_observation(self,body):
        if not isinstance(body.get('observation_id'),str) or not body['observation_id']:
            raise ValueError('Choose a specific observation to correct')
        with self.lock:
            old=self.records.get(body.get('match_id'))
            record=observations.apply(old,'undo',None,settings=self.settings,now=self.clock(),fresh=False,
                                      actor='Hub',observation_id=body.get('observation_id'))
            self._put(record)
            return dict(ok=True)

    def enrich_timeline(self,data,key):
        with self.lock:
            old=self.records.get(key)
            if old is None:raise ValueError('Timeline match is not archived')
            patch=timeline.extract(data,old,self.item_catalog)
            patch['metrics']={**old.get('metrics',{}),**patch['metrics']}
            self._put({**old,**patch})

    def _selection(self,filters,*,include_excluded=False):
        filters=dict(filters)
        account=filters.pop('account',self.account)
        identity=filters.pop('session_id','')
        start,end=self.sessions.bounds(identity)
        if identity:filters['period']='session'
        records=analytics.select(list(self.records.values()),account=account,session_start=start,
                                 session_end=end,include_excluded=include_excluded,**filters)
        return [r for r in records if self.settings['include_custom'] or r.get('queue')!=0]

    def disconnected(self):
        with self.lock:
            self.last_seen = -1000
            if self.current and self.current.get('state')=='live':
                self.current['state'] = 'partial'
                self._put(self.current)
                from events import inspect_event
                inspect_event('stats.match', owner='league_stats', phase='disconnected')
            self.status = 'Waiting for a League game'

    def flush(self):
        with self.lock:
            if self.current:
                self._put(self.current)

    def save_settings(self, patch):
        with self.lock:
            self.settings = config.save(patch,self.settings_path)
            return copy.deepcopy(self.settings)

    def request_import(self):
        with self.lock:
            self.import_requested = True
            return dict(ok=True, message='Queued import of up to 100 recent matches. Open the League client.')

    def export(self, **filters):
        with self.lock:
            records = self._selection(filters,include_excluded=True)
            return dict(exported_at=self.clock(), matches=copy.deepcopy([analytics.public(r) for r in records]))

    def snapshot(self, **filters):
        with self.lock:
            all_records = list(self.records.values())
            records = self._selection(filters)
            review_records = self._selection(filters,include_excluded=True)
            session_records = self._selection({'period':'session'})
            session_summary = analytics.aggregate(session_records)
            session_insights = insights.report(session_records)
            session_start,session_end=self.sessions.bounds()
            ranked=self.ranked.snapshot(self.account,session_start,session_end)
            recap=presentation.recap(session_records)
            progress=presentation.progress(session_records,self.settings)
            current = self._current_snapshot()
            viewer_facts=audience.facts(self._selection({}),current)
            return dict(status=self.status, error=self.error, history_status=self.history_status,
                        settings=copy.deepcopy(self.settings), account=self.account, account_name=self.account_name,
                        accounts=sorted({r['account'] for r in all_records}), current=current,
                        account_labels=presentation.account_labels(all_records,self.store.metadata('riot_ids'),self.account,self.account_name),
                        summary=analytics.aggregate(records), insights=insights.report(records),
                        sessions=copy.deepcopy(self.sessions.state),
                        enrichment=copy.deepcopy(self.enrichment_status),coverage=presentation.readiness(all_records,self.account),
                        ranked=ranked,recap=recap,progress=progress,
                        session_summary=session_summary,session_insights=session_insights,
                        form=presentation.form(records),live_progress=presentation.live_progress(current,self.settings),
                        reply_previews=chat_replies.catalog(session_summary,session_insights,ranked=ranked,recap=recap,progress=progress,**viewer_facts),
                        spotlight=spotlight(self.community.snapshot(),session_summary,session_insights,current,
                                            ranked=ranked,recap=recap,progress=progress,
                                            **{k:v for k,v in viewer_facts.items() if k!='current'}),
                        community_activity=copy.deepcopy(self.community.activity),
                        breakdowns={k:analytics.breakdown(records,k) for k in ('champion','enemy_adc','enemy_support','ally_support','ally_adc')},
                        items=analytics.items(records),
                        matches=[analytics.public(r) for r in sorted(review_records,key=lambda r:r.get('started_at',0),reverse=True)[:50]],
                        champions=sorted({r.get('champion','') for r in all_records}),
                        queues=sorted({str(r.get('queue')) for r in all_records if r.get('queue') is not None}),
                        archive_path=str(self.store.path), last_helper=copy.deepcopy(self.last_helper),
                        import_busy=self.import_busy)
