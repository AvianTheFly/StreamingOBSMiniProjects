"""Atomic analysis generations alongside the existing personal review catalogue."""
import json
import time

VERSION = 'league-visual-18'


class AnalysisStore:
    def __init__(self, store):
        self.store = store
        with store.lock:
            store.db.executescript('''
            CREATE TABLE IF NOT EXISTS analyses (
              video_id INTEGER PRIMARY KEY, signature TEXT NOT NULL, version TEXT NOT NULL,
              state TEXT NOT NULL, options TEXT NOT NULL, result TEXT NOT NULL, updated REAL NOT NULL);
            ''')
            store.db.commit()

    @staticmethod
    def signature(video):
        return json.dumps([video['size'],video['mtime_ns']], separators=(',',':'))

    def load(self, video):
        rows = self.store.rows('SELECT * FROM analyses WHERE video_id=?',(video['id'],))
        if not rows:
            return None
        row = rows[0]
        result = json.loads(row['result'])
        return {**result, 'video_id': video['id'], 'updated': row['updated'], 'state': row['state'],
                'source_current':row['signature']==self.signature(video),
                'version':row['version'],
                'stale': row['signature'] != self.signature(video) or row['version'] != VERSION,
                'options': json.loads(row['options'])}

    def save(self, video, options, result):
        self.store.execute('INSERT OR REPLACE INTO analyses VALUES (?,?,?,?,?,?,?)',
            (video['id'],self.signature(video),VERSION,'complete',json.dumps(options),json.dumps(result),time.time()))

    def duplicate_candidates(self, video, options):
        """Same-size/current generations are only candidates, never proof of identity."""
        rows=self.store.rows('''SELECT v.*, a.signature AS analysis_signature,
            a.options AS analysis_options, a.result AS analysis_result
            FROM videos v JOIN analyses a ON a.video_id=v.id
            WHERE v.id!=? AND v.size=? AND abs(v.duration-?)<0.01
              AND v.availability='online' AND a.version=? AND a.state='complete' ''',
            (video['id'],video['size'],video['duration'],VERSION))
        return [(v,json.loads(v['analysis_result'])) for v in rows
                if v['analysis_signature']==self.signature(v) and json.loads(v['analysis_options'])==options]

    def keep_game(self, video_id, index):
        video = self.store.video(video_id)
        analysis = self.load(video)
        if not analysis or analysis['stale']:
            raise ValueError('Analyze the current source before keeping this game')
        game = analysis['games'][int(index)]
        for existing in self.store.ranges(video_id):
            if existing['start']==game['trim_start'] and existing['end']==game['trim_end'] and existing['decision']=='keep':
                try:
                    notes=json.loads(existing['notes'])
                except (ValueError,TypeError):
                    continue
                if isinstance(notes,dict) and notes.get('analysis_version')==VERSION:
                    return existing['id']
        # User review markers are never regenerated/overwritten by analysis.
        return self.store.save_range({'video_id':video_id, 'start':game['trim_start'], 'end':game['trim_end'],
            'title':f'League game {int(index)+1} · {game["outcome"]}', 'decision':'keep', 'tags':'auto-game, '+game['outcome'],
            'notes':json.dumps({'analysis_version':VERSION,'source_path':video['path'],'source_id':video_id,
                               'game_start':game['start'],'game_end':game['end'],'metrics':game['metrics']})})
