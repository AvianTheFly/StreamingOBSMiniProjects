"""Disposable integration server for the recap browser audit; no live settings/OBS."""
import json
import sys
import tempfile
import time
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from tools.test_league_stats import match
from league_stats.service import Tracker
from league_stats.store import Store


def main():
    with tempfile.TemporaryDirectory() as folder, patch('league_stats.config.SettingsBackups'):
        clock=[time.time(),1000.0]
        tracker=Tracker(store=Store(Path(folder)/'history.sqlite3'),settings_path=Path(folder)/'settings.json',
                        clock=lambda:clock[0],monotonic=lambda:clock[1])
        tracker.catalog={'222':dict(name='Jinx'),'117':dict(name='Lulu'),'51':dict(name='Caitlyn')}
        tracker.item_catalog={k:dict(name=v['name']) for k,v in json.loads((ROOT/'hub_ui/app/league-stats/art/catalog.json').read_text(encoding='utf-8'))['items'].items()}
        for i in range(5):
            raw=match(10+i,modern=True);raw['info']['gameCreation']=(clock[0]-10000-i*2000)*1000
            tracker.enrich(raw,'p')
        raw=match(modern=True);raw['info'].update(gameCreation=(clock[0]-1924)*1000,gameDuration=1924)
        own=raw['info']['participants'][0]
        own.update(kills=12,deaths=0,assists=9,totalMinionsKilled=242,neutralMinionsKilled=0,
                   totalDamageDealtToChampions=34860,physicalDamageDealtToChampions=28000,magicDamageDealtToChampions=6000,trueDamageDealtToChampions=860,goldEarned=16480,goldSpent=14900,visionScore=28,totalTimeSpentDead=0,
                   totalDamageTaken=22000,damageSelfMitigated=15000,totalHeal=7000,timeCCingOthers=24,spell1Casts=77,spell2Casts=35,spell3Casts=28,spell4Casts=9,wardsPlaced=8,wardsKilled=3,
                   challenges=dict(skillshotsDodged=15,turretPlatesTaken=3),item0=3006,item1=3031,item2=3085,item3=3036,item4=3072)
        raw['info']['participants'][1]['kills']=20
        for player in raw['info']['participants']:player.pop('stats',None)
        tracker.enrich(raw,'p')
        events=[]
        for i in range(24):
            events.append(dict(type='ITEM_PURCHASED',timestamp=(45+i*70)*1000,participantId=1,itemId=[3006,3031,3085,3036,3072,2055][i%6]))
        for i in range(18):events.append(dict(type='SKILL_LEVEL_UP',timestamp=(30+i*85)*1000,participantId=1,skillSlot=i%4+1))
        for i in range(14):events.append(dict(type='CHAMPION_KILL',timestamp=(120+i*80)*1000,killerId=1 if i%2 else 2,victimId=3,assistingParticipantIds=[] if i%2 else [1]))
        for i in range(8):events.append(dict(type="WARD_PLACED",timestamp=(90+i*210)*1000,creatorId=1,wardType="YELLOW_TRINKET"))
        events.extend([dict(type='CHAMPION_KILL',timestamp=525000,killerId=1,victimId=3),
                       dict(type='BUILDING_KILL',timestamp=550000,killerId=1,teamId=200,buildingType='TOWER_BUILDING')])
        def jungle_bonus(i):return max(0,min(10,i-10))*4
        frames=[dict(timestamp=i*60000,participantFrames={'1':dict(totalGold=500+i*450,currentGold=150+(i%5)*320,minionsKilled=i*7+jungle_bonus(i),jungleMinionsKilled=0,level=min(18,1+i//2),damageStats=dict(totalDamageDoneToChampions=i*i*34)),
                    '3':dict(totalGold=500+i*420,minionsKilled=i*6,jungleMinionsKilled=0)},events=[e for e in events if (i-1)*60000<e['timestamp']<=i*60000]) for i in range(33)]
        tracker.enrich_timeline(dict(metadata=dict(matchId='NA1_7'),info=dict(frames=frames)),'p:7')
        tracker.account='p';tracker.client_phase='EndOfGame'

        class Handler(BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def send_json(self,data,status=200):
                body=json.dumps(data).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(body)
            def do_GET(self):
                if self.path=='/api/league-stats/postgame':return self.send_json(tracker.postgame_report())
                if self.path=='/test-controller':
                    self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers()
                    self.wfile.write(b'<body style="background:#081218;color:white"><main><div class="page-header">League Stats</div></main><button id="destroy">Leave page</button><script type="module">import {createRecapController} from "/js/pages/league-recap-controller.js";const dispose=createRecapController(document.querySelector("main"));document.getElementById("destroy").onclick=dispose;</script>');return
                path=self.path.split('?',1)[0]
                file=ROOT/'lib/browser_effects/web/visible-poll.js' if path=='/shared/visible-poll.js' else ROOT/'hub_ui/app'/path.lstrip('/')
                if not file.resolve().is_relative_to(ROOT) or not file.is_file():self.send_error(404);return
                mime={'.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg'}.get(file.suffix,'text/html')
                self.send_response(200);self.send_header('Content-Type',mime);self.end_headers();self.wfile.write(file.read_bytes())
            def do_POST(self):
                body=json.loads(self.rfile.read(int(self.headers.get('Content-Length',0))))
                try:
                    if self.path=='/api/league-stats/postgame-control':return self.send_json(tracker.control_postgame(body))
                    if self.path=='/test-clock':clock[0]+=body['seconds'];clock[1]+=body['seconds']
                    elif self.path=='/test-phase':tracker.client_phase=body['phase']
                    else:self.send_error(404);return
                    self.send_json(tracker.postgame_report())
                except ValueError as e:self.send_json(dict(error=str(e)),400)
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        print(server.server_address[1],flush=True)
        server.serve_forever()


if __name__=='__main__':main()
