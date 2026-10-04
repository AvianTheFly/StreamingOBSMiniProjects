"""Finite standalone art QA host. Never imports Hub features or plays audio."""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
from urllib.parse import urlparse, parse_qs

ROOT=Path(__file__).resolve().parents[1]
HTML='''<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/twitch/overlay.css"><link rel="stylesheet" href="/twitch/supporter_show.css"></head>
<body><main id="stage" class="on"><div id="cast"></div><div id="particles"></div><div id="rim" style="display:none"></div><div id="raidLayers"></div><header id="banner"><small id="kicker"></small><strong id="name"></strong><span id="detail"></span></header></main>
<script>window.addEventListener('error',e=>fetch('/error?message='+encodeURIComponent((e.error?.stack||e.message||'Resource load failure')+' '+e.filename+':'+e.lineno)));window.addEventListener('unhandledrejection',e=>fetch('/error?message='+encodeURIComponent(e.reason?.stack||String(e.reason))));</script>
<script type="module">
import {BorderShow} from '/sound/borders.js';import {MuffinShow} from '/sound/muffins.js';
import {ProductionScene} from '/league/scene.js';import {SupporterShow,artReady} from '/twitch/supporter_show.js';import {RaidArt} from '/twitch/raid_art.js';import {CheerShow} from '/twitch/cheer_show.js';
const stage=document.getElementById('stage');let serial=-1,show;
async function poll(){try{const item=await(await fetch('/state')).json();if(item.serial!==serial){serial=item.serial;show?.stop?.();stage.replaceChildren();stage.className='on';stage.innerHTML='<div id="cast"></div><div id="particles"></div><div id="rim" style="display:none"></div><div id="raidLayers"></div><header id="banner"><small id="kicker"></small><strong id="name"></strong><span id="detail"></span></header>';
 document.getElementById('name').textContent=item.name||'Native OBS viewer';
 document.getElementById('banner').style.display=item.family==='cheer'?'':'none';
 if(item.family==='supporter'||item.family==='cheer'){if(item.family==='supporter')await artReady;show=item.family==='supporter'?new SupporterShow(stage):new CheerShow(stage);show.start(item,{custom:{}});await show.ready;show.update(item.elapsed);}
 else{const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%';stage.append(canvas);
 if(item.family==='league'){show=new ProductionScene(canvas);await show.ready;show.draw(item.state);}
 else if(item.family==='raid'){show=new RaidArt(canvas);show.start(item);await show.ready;show.draw(item.elapsed);}
 else if(item.family==='sound'){show=item.effect.renderer==='muffins'?new MuffinShow(canvas):new BorderShow(canvas);await show.ready;if(show.dancer)await show.dancer.decode();show.draw(item.elapsed,item.duration,item.effect);}}
 await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));await fetch('/painted?serial='+serial);
 }}catch(e){await fetch('/error?message='+encodeURIComponent(String(e)));}setTimeout(poll,150);}poll();
</script></body></html>'''

class Fixture:
    def __init__(self):
        self.state={'serial':0};self.lock=threading.Lock();self.painted=0;self.errors=[];self.requests=[]
        fixture=self
        class Handler(BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def do_GET(self):
                url=urlparse(self.path);path=url.path
                with fixture.lock:
                    fixture.requests.append(path)
                    fixture.requests=fixture.requests[-100:]
                if path=='/':data=HTML.encode();mime='text/html; charset=utf-8'
                elif path=='/state':
                    with fixture.lock:data=json.dumps(fixture.state).encode()
                    mime='application/json'
                elif path=='/painted':
                    with fixture.lock:fixture.painted=int(parse_qs(url.query)['serial'][0])
                    data=b'{}';mime='application/json'
                elif path=='/error':
                    with fixture.lock:fixture.errors.append(parse_qs(url.query).get('message',['Unknown'])[0])
                    data=b'{}';mime='application/json'
                else:
                    parts=path.strip('/').split('/')
                    roots={'sound':ROOT/'lib/browser_effects/web','league':ROOT/'mini projects/league_api/production/web','twitch':ROOT/'mini projects/twitch_celebrations'}
                    if path=='/mash-dance.png':
                        file=roots['sound']/'mash-dance.png'
                    elif path.startswith('/spirit/assets/'):
                        file=ROOT/'mini projects/twitch_celebrations/spirit_assets'/parts[-1]
                    elif len(parts)==2 and parts[0] in roots:
                        file=roots[parts[0]]/parts[1]
                        if parts[1]=='subtle.js':file=roots['sound']/'subtle.js'
                        if parts[1]=='optics.js':file=roots['sound']/'production.js'
                        if parts[1]=='mash-dance.png':file=roots['sound']/'mash-dance.png'
                    else:self.send_error(404);return
                    if file.name in {'.','..'} or file.suffix not in {'.js','.css','.png'} or not file.is_file():
                        with fixture.lock:fixture.errors.append('Missing QA asset '+path)
                        self.send_error(404);return
                    data=file.read_bytes();mime='application/javascript' if file.suffix=='.js' else 'text/css' if file.suffix=='.css' else 'image/png'
                self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
        self.server=ThreadingHTTPServer(('127.0.0.1',0),Handler);self.server.daemon_threads=True
        self.thread=threading.Thread(target=self.server.serve_forever,name='standalone-border-qa',daemon=True);self.thread.start()
        self.url=f'http://127.0.0.1:{self.server.server_port}/'
    def set(self,case):
        with self.lock:self.state={**case,'serial':self.state['serial']+1};return self.state['serial']
    def close(self):self.server.shutdown();self.server.server_close();self.thread.join(3)
