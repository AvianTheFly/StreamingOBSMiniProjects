"""Build a finite local art-review gallery, without Hub, OBS or settings writes.

Package the exact renderer module graph as browser Blob modules. Original sounds
remain local read-only file references. Preview controls never issue Hub commands.
"""
import json
import posixpath
import re
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/thematic-borders'
IMPORTS = re.compile(r"(?:from\s*|import\s*)['\"](\./[^'\"]+)['\"]")


def build():
    modules = {}

    def collect(identity):
        if identity in modules:
            return
        family, name = identity.split('/', 1)
        file = (ROOT / ('lib/browser_effects/web' if family == 'sound'
                        else 'mini projects/league_api/production/web') / name)
        if name == 'subtle.js':
            file = ROOT / 'lib/browser_effects/web/subtle.js'
        if name == 'optics.js':
            file = ROOT / 'lib/browser_effects/web/production.js'
        source = file.read_text(encoding='utf-8')
        modules[identity] = source
        for dependency in IMPORTS.findall(source):
            collect(posixpath.normpath(posixpath.join(posixpath.dirname(identity), dependency)))

    collect('sound/renderers.js')
    collect('league/scene.js')
    collect('league/event-relics.js')
    collect('sound/rave.js')
    media = json.loads((OUT / 'media-context.json').read_text())
    profile = json.loads((ROOT / 'mini projects/soundboard/hotkeys_editor.json').read_text())['profiles']['default']
    sounds = []
    for row in media:
        bound = [key for key in ['Z','T','t','1','!','2','@','3','#','$','%']
                 if row['name'] in (profile['hotkeys'].get(key, []) if isinstance(profile['hotkeys'].get(key), list)
                                    else [profile['hotkeys'].get(key)])]
        db = (profile.get('project_volume_db', 0) + profile.get('profile_volume_db', 0)
              + profile.get('file_volume_offsets', {}).get(row['name'], -1))
        sounds.append({'name': row['name'], 'family': 'Sound', 'keys': bound,
                       'effect': row['effect'], 'duration': row['duration'],
                       'audio': Path(row['path']).as_uri(), 'volume': min(1, 10 ** (db / 20))})
    catalog = runpy.run_path(str(ROOT / 'mini projects/league_api/production/catalog.py'))
    settings = json.loads((ROOT / 'mini projects/league_api/production.json').read_text())
    alerts = json.loads((ROOT / 'mini projects/league_api/alerts.json').read_text())
    events = [{'name': row['title'], 'family': 'League', 'keys': [], 'effect': row,
               'duration': row['duration'], 'id': row['key'], 'enabled': row['enabled']}
              for row in catalog['manifest'](settings, alerts.get('events'))]
    payload = json.dumps({'modules': modules, 'rows': sounds + events}, separators=(',', ':')).replace('</', '<\\/')
    html = HTML.replace('/*PAYLOAD*/', payload)
    target = OUT / 'preview.html'
    target.write_text(html, encoding='utf-8')
    print(f'Built {target}: {len(sounds)} sounds, {len(events)} League events; {len(modules)} original renderer modules')


HTML = r'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Thematic border previews</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#101a29;color:#e5ebef;font:15px Segoe UI,sans-serif}
main{display:grid;grid-template-columns:280px 1fr;min-height:100vh}aside{padding:22px;background:#182537;border-right:1px solid #334356;overflow:auto;height:100vh}
h1{font:600 24px Segoe UI;margin:0 0 14px}p{line-height:1.5;color:#b9c9d4}input,select,button{font:inherit;color:inherit;background:#25364c;border:1px solid #52667d;border-radius:7px;padding:9px}
input[type=search],select{width:100%;margin:5px 0}button{cursor:pointer}button:hover,button[aria-current=true]{background:#3b536b}.item{display:block;text-align:left;width:100%;margin:6px 0}.item small{display:block;color:#bccbd5;font-size:12px;margin-top:4px}
article{padding:25px;min-width:0}.picture{position:relative;width:100%;aspect-ratio:16/9;background:#1b293d;border-radius:12px;overflow:hidden}
canvas{width:100%;height:100%;display:block}.controls{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:17px 0}.controls input[type=range]{flex:1;min-width:180px;padding:0}.controls label{display:flex;gap:6px;align-items:center}
#story{min-height:55px;max-width:950px}#status{color:#c9d7b7}#title{font:600 26px Segoe UI;margin:0 0 8px}.quiet{font-size:12px;color:#a9bac9}.toolbar{display:flex;align-items:center;gap:12px;margin-bottom:18px}
@media(max-width:850px){main{grid-template-columns:1fr}aside{height:auto;max-height:270px}article{padding:15px}.item{display:inline-block;width:230px;margin-right:6px}}
</style></head><body><main><aside><h1>Border performances</h1><p>40 sounds · all League events</p><select id="family" aria-label="Effect family"><option>Sound</option><option>League</option></select><input id="search" type="search" placeholder="Find an effect" aria-label="Find an effect"><div id="list"></div><p class="quiet">Key 4 is unbound and preserved. This local preview does not connect to the Hub or OBS.</p></aside>
<article><div class="toolbar"><span id="status">Loading original artwork…</span><label>Backdrop <select id="backdrop"><option value="#1b293d">Night blue</option><option value="#314d48">Game green</option><option value="#d6d1bc">Warm light</option></select></label></div><h2 id="title"></h2><p id="story"></p><div class="picture" id="picture"><canvas id="stage" width="1920" height="1080"></canvas></div>
<div class="controls"><button id="play" disabled>Play</button><button id="restart" disabled>Restart</button><input id="seek" type="range" min="0" max="1000" value="0" aria-label="Playback position"><span id="time">0.00 s</span><label><input id="sound" type="checkbox">Original sound</label><label><input id="loop" type="checkbox">Loop</label></div><p class="quiet">Sounds draw from the original audio clock. League events use a local preview clock. Pause and scrub reconstruct the same frame. Effects clear at their original cutoff. Enabled settings are shown for context and are never changed here.</p></article></main>
<script>
const data=/*PAYLOAD*/;
const modules=new Map();
function moduleUrl(identity){
 if(modules.has(identity))return modules.get(identity);
 const source=data.modules[identity];if(source===undefined)throw Error('Missing preview module '+identity);
 const parent=identity.slice(0,identity.lastIndexOf('/')+1);
 const rewritten=source.replace(/((?:from\s*|import\s*)['"])(\.\/[^'"]+)(['"])/g,(_,a,path,b)=>a+moduleUrl(parent+path.slice(2))+b);
 const url=URL.createObjectURL(new Blob([rewritten],{type:'text/javascript'}));modules.set(identity,url);return url;
}
(async()=>{
 const [{makeRenderer},{ProductionScene},R,L]=await Promise.all([import(moduleUrl('sound/renderers.js')),import(moduleUrl('league/scene.js')),import(moduleUrl('sound/rave.js')),import(moduleUrl('league/event-relics.js'))]);
 const $=id=>document.getElementById(id),canvas=$('stage');let row,show,audio,playing=false,start=0,position=0,frame=0,revision=0;
 const paint=t=>{if(!show)return;if(row.family==='Sound')show.draw(t,row.duration,row.effect);else show.draw({enabled:true,opacity:.9,intensity:1.15,...(row.id==='death'?{death:{elapsed:t+1,remaining:28-t}}:{effect:{...row.effect,elapsed:t}})});$('seek').value=Math.round(t/row.duration*1000);$('time').textContent=t.toFixed(2)+' / '+row.duration.toFixed(2)+' s';};
 function pause(){playing=false;cancelAnimationFrame(frame);if(audio){audio.pause();position=audio.currentTime;}else if(start)position=Math.min(row.duration,(performance.now()-start)/1000);$('play').textContent='Play';}
 function finish(){pause();position=0;show.clear();$('seek').value=0;$('time').textContent='Finished';if($('loop').checked)play();}
 function tick(){if(!playing)return;const t=audio?audio.currentTime:(performance.now()-start)/1000;if(t>=row.duration){finish();return;}paint(t);frame=requestAnimationFrame(tick);}
 async function play(){if(!show)return;if(playing){pause();return;}if(position>=row.duration)position=0;const rev=revision;playing=true;if(audio){audio.currentTime=position;audio.muted=!$('sound').checked;try{await audio.play();}catch(e){if(rev===revision){pause();throw e;}return;}}else start=performance.now()-position*1000;if(rev!==revision||!playing)return;$('play').textContent='Pause';tick();}
 async function select(next){
  pause();const rev=++revision;audio?.removeAttribute('src');audio?.load();audio=null;show?.clear();row=next;position=0;start=0;$('play').disabled=$('restart').disabled=true;
  $('title').textContent=row.name+(row.keys.length?' · '+row.keys.join(' / '):'');
  const key=row.effect.renderer==='hooray'?'hooray':row.effect.scene||row.effect.style||'muffins';
  $('story').textContent=row.family==='Sound'?(key==='hooray'?'Smiling poppers cheer with a sparse perimeter paper shower.':(R.SOUND_CULTURE_STORIES[key]||'')+' '+(R.SOUND_ENCORE_STORIES[key]||'')):(L.playfulStories[row.id]||'Approved Hextech circuits or personal rule constellation.');
  $('status').textContent=row.family==='Sound'?'Original local sound · ready':(row.enabled?'Enabled in your setup':'Optional / currently disabled')+' · local visual preview';
  show=row.family==='Sound'?makeRenderer(canvas,row.effect):new ProductionScene(canvas);await show.ready;if(rev!==revision)return;
  if(row.family==='Sound'){const current=new Audio(row.audio);audio=current;current.volume=row.volume;current.muted=!$('sound').checked;current.onended=()=>{if(rev===revision)finish();};await new Promise((resolve,reject)=>{current.onloadedmetadata=()=>{if(rev===revision)row.duration=current.duration;resolve();};current.onerror=()=>rev!==revision?resolve():reject(Error('Open this gallery in a local browser to play the original audio.'));current.load();});if(rev!==revision)return;}
  $('play').disabled=$('restart').disabled=false;paint(0);for(const button of $('list').children)button.setAttribute('aria-current',button.dataset.name===row.name?'true':'false');
 }
 function list(){const rows=data.rows.filter(r=>r.family===$('family').value&&r.name.toLowerCase().includes($('search').value.toLowerCase()));$('list').replaceChildren();for(const r of rows){const b=document.createElement('button');b.className='item';b.dataset.name=r.name;b.textContent=r.name;const sub=document.createElement('small');sub.textContent=r.family==='Sound'?'Key '+r.keys.join(' / '):r.effect.category+' · '+r.duration.toFixed(1)+' s';b.append(sub);b.onclick=()=>select(r).catch(error);$('list').append(b);}return rows;}
 function error(e){$('status').textContent=e.message||String(e);console.error(e);}
 $('family').onchange=()=>{const rows=list();if(rows.length)select(rows[0]).catch(error);};$('search').oninput=list;
 $('play').onclick=()=>play().catch(error);$('restart').onclick=()=>{pause();position=0;play().catch(error);};
 $('seek').oninput=()=>{pause();position=Number($('seek').value)/1000*row.duration;if(audio)audio.currentTime=position;paint(position);};
 $('sound').onchange=()=>{if(audio)audio.muted=!$('sound').checked;};$('backdrop').onchange=()=>{$('picture').style.background=$('backdrop').value;};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
 window.addEventListener('pagehide',()=>{pause();audio?.removeAttribute('src');for(const u of modules.values())URL.revokeObjectURL(u);});
 window.borderPreview={select,list,paint,get row(){return row;},get audio(){return audio;}};
 const rows=list();await select(rows[0]);
})().catch(e=>{document.getElementById('status').textContent=e.message||String(e);console.error(e);});
</script></body></html>'''

if __name__ == '__main__':
    build()
