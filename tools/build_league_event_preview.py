"""Export the actual League renderer as a self-contained, isolated review page."""
import base64
import json
from pathlib import Path
import re
import runpy

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'mini projects/league_api/production/web'


def build(destination):
    modules = {}

    def module(name):
        if name in modules:
            return modules[name]
        source = (ROOT/'lib/browser_effects/web/subtle.js' if name == 'subtle.js'
                  else WEB/name).read_text(encoding='utf-8')
        source = re.sub(r"(['\"])\./([\w-]+\.js)\1",
                        lambda m: json.dumps(module(m[2])), source)
        uri = 'data:text/javascript;base64,' + base64.b64encode(source.encode()).decode()
        modules[name] = uri
        return uri

    catalog = runpy.run_path(str(WEB.parent/'catalog.py'))
    settings = json.loads((WEB.parent.parent/'production.json').read_text(encoding='utf-8'))
    alerts = json.loads((WEB.parent.parent/'alerts.json').read_text(encoding='utf-8'))
    rows = catalog['manifest'](settings, alerts.get('events', {}))
    html = '''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>League event previews</title>
<style>
*{box-sizing:border-box}body{margin:0;color:#f5e8d0;background:radial-gradient(ellipse at 75% 0,#203349,#0b1524 70%);font:16px 'Segoe UI',sans-serif;min-height:100vh}
main{max-width:1380px;margin:auto;padding:30px}header{display:flex;justify-content:space-between;align-items:end;gap:30px;margin-bottom:22px}
.eyebrow{color:#79e4cf;letter-spacing:.2em;font-size:12px;font-weight:800}h1{font-size:38px;margin:8px 0}p{margin:0;color:#acbccc}.count{font-size:14px;border:1px solid #38566b;padding:12px 18px;border-radius:12px}
.controls{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:18px}select,button{color:#eff2e7;background:#20354a;border:1px solid #46637a;border-radius:9px;padding:12px 16px;font:inherit}button{cursor:pointer}button:hover{background:#33586c}select{flex:1;min-width:240px}button.primary{color:#10272d;background:#82e8ca;border-color:#82e8ca;font-weight:700}
.screen{position:relative;aspect-ratio:16/9;border:1px solid #3b546b;border-radius:16px;overflow:hidden;background:radial-gradient(ellipse at 45% 55%,#263940,#172932 35%,#10202e 80%)}
.screen:before{content:'';position:absolute;inset:0;background:linear-gradient(35deg,transparent 36%,#5276751c 36.3%,#5276751c 42%,transparent 42.3%),linear-gradient(145deg,transparent 45%,#60828118 45.3%,#60828118 49%,transparent 49.3%);filter:blur(8px)}
canvas{position:relative;width:100%;height:100%;display:block}.transport{display:flex;gap:20px;align-items:center;margin:18px 0}input{accent-color:#82e8ca;flex:1}output{font-variant-numeric:tabular-nums;min-width:100px;text-align:right}.story{min-height:55px;margin-top:20px;color:#bfd4dc;line-height:1.6}.foot{font-size:13px;color:#8dabb9}.paused{color:#ffc981}
</style><main><header><div><div class="eyebrow">RIFT THEATRE</div><h1>Every moment gets a show.</h1><p>Elemental spectacle, tiny heroes, big punchlines.</p></div><div class="count">58 event performances + personal rules</div></header>
<div class="controls"><select id="events" aria-label="Choose an event"></select><button id="play" class="primary">Pause</button><button id="replay">Replay</button><button id="next">Next event →</button></div>
<div class="screen"><canvas width="1920" height="1080"></canvas></div>
<div class="transport"><span id="status">Playing</span><input id="scrub" type="range" min="0" max="1000" value="0" aria-label="Animation position"><output id="clock"></output></div>
<p id="story" class="story"></p><p class="foot">Choose any event, replay it, or scrub through the contact and reaction.</p></main>
<script type="module">
import {ProductionScene} from @SCENE@;
import {EVENT_DESIGNS} from @ART@;
const rows=@ROWS@,groups=@GROUPS@,select=document.querySelector('#events'),scrub=document.querySelector('#scrub'),play=document.querySelector('#play');
for(const [key,label] of Object.entries(groups)){const group=document.createElement('optgroup');group.label=label;for(const row of rows.filter(r=>r.category===key)){const o=document.createElement('option');o.value=row.key;o.textContent=row.title;group.append(o);}if(group.children.length)select.append(group);}
select.value='pentakill';const show=new ProductionScene(document.querySelector('canvas'));await show.ready;
let row,position=0,playing=true,last=0,frame=0;const status=document.querySelector('#status');
function paint(){show.draw({enabled:true,opacity:.9,intensity:1.15,effect:{...row,elapsed:Math.min(position,row.duration)}});scrub.value=Math.min(1000,position/row.duration*1000);document.querySelector('#clock').textContent=Math.min(position,row.duration).toFixed(2)+' / '+row.duration.toFixed(1)+' s';}
function choose(){row=rows.find(r=>r.key===select.value);position=0;last=0;document.querySelector('#story').textContent=EVENT_DESIGNS[row.key]||'Your personal constellation comes to life.';paint();wake();}
function tick(now){frame=0;if(!playing||document.hidden)return;if(last)position+=(now-last)/1000;last=now;if(position>row.duration+.8)position=0;paint();frame=requestAnimationFrame(tick);}
function wake(){if(playing&&!document.hidden&&!frame)frame=requestAnimationFrame(tick);}
select.onchange=choose;play.onclick=()=>{playing=!playing;play.textContent=playing?'Pause':'Play';status.textContent=playing?'Playing':'Paused';status.className=playing?'':'paused';last=0;if(!playing){cancelAnimationFrame(frame);frame=0;}wake();};
document.querySelector('#replay').onclick=()=>{position=0;last=0;paint();wake();};document.querySelector('#next').onclick=()=>{const choices=[...select.options],index=choices.findIndex(o=>o.value===select.value);select.value=choices[(index+1)%choices.length].value;choose();};
scrub.oninput=()=>{position=Number(scrub.value)/1000*row.duration;last=0;paint();};document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden){cancelAnimationFrame(frame);frame=0;}else wake();});window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0;});
choose();window.leagueEventPreview={rows,show,choose,select,paint};
</script></html>'''
    html = html.replace('@SCENE@', json.dumps(module('scene.js')))
    html = html.replace('@ART@', json.dumps(module('event-art.js')))
    html = html.replace('@ROWS@', json.dumps(rows).replace('<', '\\u003c'))
    html = html.replace('@GROUPS@', json.dumps(catalog['GROUPS']))
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(html, encoding='utf-8')
    print(f'{destination}: {len(rows)} performances, {len(modules)} renderer modules')


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT/'output/league-authored-borders-20261013/preview.html')
    build(parser.parse_args().output)
