"""Post-game-only local client enrichment on the existing collector worker."""
from .normalize import FIELDS, number
from .timeline import extract


def end_stats(data, record):
    own = data.get('localPlayer') or {}
    if str(data.get('gameId')) != str(record['game_id']) or own.get('puuid') != record['account']:
        raise ValueError('End-game screen belongs to another player or match')
    stats = own.get('stats') or {}
    metrics = {target:number(stats[source]) for source,target in FIELDS.items()
               if number(stats.get(source)) is not None}
    if 'lane_cs' in metrics and 'jungle_cs' in metrics:
        metrics['cs'] = metrics['lane_cs'] + metrics['jungle_cs']
    return dict(metrics=metrics, eog_enriched=True, raw_end_screen=data,
                champion_id=own.get('championId'), team_id=own.get('teamId'))


def local_timeline(data, record, requested_game, items):
    if str(requested_game) != str(record['game_id']):
        raise ValueError('Client timeline request belongs to another match')
    if not record.get('participant_id') or record.get('source') not in {'league_client','match_v5'}:
        raise ValueError('Client timeline needs a verified archived participant')
    base = {k:v for k,v in record.items() if k not in {'api_match_id','api_account'}}
    wrapped = dict(metadata=dict(matchId='LOCAL_'+str(requested_game)), info=data)
    patch = extract(wrapped, base, items)
    for event in patch['official_events']:
        event['source'] = 'client'
    return dict(client_timeline_version=1, client_events=patch['official_events'],
                client_samples=patch['official_samples'], client_checkpoints=patch['timeline_checkpoints'],
                metrics=patch['metrics'], raw_local_timeline=data)


class ClientEnrichment:
    def __init__(self, tracker, client):
        self.tracker, self.client = tracker, client
        self.attempts = {}
        self.end_game = None

    def tick(self, phase, account):
        if not account or phase in {'InProgress','Reconnect','WatchInProgress','GameStart'}:
            return
        tracker = self.tracker
        with tracker.lock:
            records = sorted([r for r in tracker.records.values() if r['account'] == account and
                              r.get('state') == 'complete'], key=lambda r:r.get('started_at',0), reverse=True)[:20]
        if phase in {'EndOfGame','PreEndOfGame','WaitingForStats'} and records and self.end_game != records[0]['id']:
            try:
                data = self.client.get('/lol-end-of-game/v1/eog-stats-block')
                key = f"{account}:{data.get('gameId')}"
                with tracker.lock:
                    old = tracker.records.get(key)
                    if old:
                        patch = end_stats(data, old)
                        tracker._put({**old, **patch, 'metrics':{**old['metrics'], **patch['metrics']}})
                        self.end_game = key
            except (OSError,ValueError,TypeError,KeyError):
                pass
        candidate = next((r for r in records if not r.get('client_timeline_version') and
                          not r.get('official_events') and self.attempts.get(r['id'],0) < 2), None)
        if not candidate:
            return
        self.attempts[candidate['id']] = self.attempts.get(candidate['id'],0) + 1
        self.attempts = {k:v for k,v in self.attempts.items() if k in {r['id'] for r in records}}
        try:
            game_id = candidate['game_id']
            data = self.client.get('/lol-match-history/v1/game-timelines/'+str(game_id))
            with tracker.lock:
                old = tracker.records[candidate['id']]
                # Recover team/roster metadata for archives made before the recap.
                from .normalize import postgame
                stored = tracker.store.get(old['id']) or {}
                normalized = postgame(stored.get('raw_postgame',{}), old.get('api_account',account), tracker.catalog, tracker.item_catalog)
                base = {**old, **{k:normalized[k] for k in ('team_id','participants','champion_id') if normalized and k in normalized}}
                patch = local_timeline(data, base, game_id, tracker.item_catalog)
                tracker._put({**base, **patch, 'metrics':{**base['metrics'], **patch['metrics']}})
        except (OSError,ValueError,TypeError,KeyError):
            pass
