// One visible-document loop owns a chosen world's painted motion and finite guests.
import {AmbientClock,smooth,hash} from './shared/world-motion.js';
import {loadWorld} from './worlds.js';
import {LiveActions} from './live-actions.js';
import {screenFrame} from './screen-frame.js';
import {observeDisplay} from './display-state.js';
import {drawFestival} from './festival-theater.js';
import {festivalWeather} from './festival-weather.js';
import {habitats} from './habitat-scenes.js';
import {admitHabitat,visibleHabitatEvents} from './habitat-blocking.js';
import {cameraForeground} from './camera-occlusion.js';
import {previewHost,previewChat,previewQueue,previewMedia} from './broadcast-preview.js';
const params=new URLSearchParams(location.search),preview=params.get('preview')==='1';
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
// The world carries its own jokes. Caption theatre is now a private opt-in.
const captions=preview&&params.get('captions')==='1';
let broadcast=preview&&params.get('broadcast')==='1';
const world=await loadWorld(params.get('world')||'reef'),{scene,cues,artists}=world;
const canvas=document.querySelector('#stage'),c=canvas.getContext('2d');
// OBS already supplies the original painting behind this transparent layer.
// Only the standalone preview needs a separate surface to composite over it.
const surface=preview?document.createElement('canvas'):null;
if(surface){surface.width=1920;surface.height=1080;}
const m=surface?surface.getContext('2d'):c;
document.title=world.label+' · Living lobby';canvas.setAttribute('aria-label','Animated '+world.label+' painting');
const art=world.createMotion(),clock=new AmbientClock(cues,world.seed||71),manual=[],ambient=new Map(),decisions=new Map();
const live=preview?null:new LiveActions(world.id,cue=>trigger(cue.action,cue.id));
let ready=false,disposed=false,frame=0,last=0,paused=params.get('paused')==='1',automatic=params.get('auto')!=='0',at=params.has('at')?Number(params.get('at')):null,time=Number.isFinite(at)&&at!==null?at:Date.now()/1000;
let holes=scene.holes;
try{const custom=JSON.parse(params.get('holes'));if(Array.isArray(custom)&&custom.length===3&&custom.every(r=>Array.isArray(r)&&r.length===4&&r.every(Number.isFinite)&&r[2]>=32&&r[3]>=32&&r[0]>=0&&r[1]>=0&&r[0]+r[2]<=1920&&r[1]+r[3]<=1080))holes=custom;}catch{ /* Use authored apertures when no complete valid placement is provided. */ }
let displayVisible=!scene.adaptiveScreen||params.get('screen')!=='0';
const displayObserver=!preview&&scene.adaptiveScreen?observeDisplay(scene.source,visible=>{displayVisible=visible;draw();}):null;
function events(){
  for(let i=manual.length-1;i>=0;i--)if(time>=manual[i].started+manual[i].life)manual.splice(i,1);
  for(const [id,e] of ambient)if(time>=e.started+e.life)ambient.delete(id);
  for(const [id,end] of decisions)if(time>end+15)decisions.delete(id);
  if(automatic){const pressure=manual.reduce((sum,e)=>sum+e.impact,0);
    for(const event of clock.active(time)){if(decisions.has(event.id))continue;decisions.set(event.id,event.started+event.life);if(decisions.size>256)decisions.delete(decisions.keys().next().value);
      if(hash(event.seed+77)>1-Math.exp(-pressure*.25)&&admitHabitat(event,[...ambient.values(),...manual]))ambient.set(event.id,event);}
  }
  return visibleHabitatEvents([...ambient.values(),...manual]);
}
function draw(){
  if(!ready||disposed)return;const began=performance.now(),active=events();
  const apertures=scene.adaptiveScreen&&!displayVisible?holes.slice(1):holes;
  art.displayVisible=displayVisible;art.screenRect=holes[0];art.apertures=apertures;
  m.clearRect(0,0,1920,1080);art.draw(m,time,active,apertures);
  if(!habitats.has(world.id))festivalWeather(m,reducedMotion.matches?0:time,world.id);
  const paintEvents=overFrame=>{for(const event of active){const age=time-event.started,spec=cues.find(x=>x.id===event.kind);if(!spec||!!spec.overFrame!==overFrame)continue;const artist=artists[event.kind];if(!artist)continue;
    m.save();m.globalAlpha=smooth(age/.6)*smooth((spec.life-age)/.75);world.clip?.(m,spec);artist(m,age,event,art);m.restore();}
  };
  paintEvents(false);
  if(displayVisible)screenFrame(m,holes[0],world.id);
  paintEvents(true);
  const festival=captions?drawFestival(m,time,world.id,apertures,{reduced:reducedMotion.matches,pressure:active.filter(e=>e.manual).reduce((sum,e)=>sum+e.impact,0)}):null;
  canvas.dataset.festival=festival?.title||'';
  // Saved live-camera, desktop and chat placement wins over every accent.
  for(const rect of apertures)m.clearRect(...rect);
  // Only the authored physical prop may hide the bottom of the host's torso.
  cameraForeground(m,art.base,world.id,holes[1]);
  if(surface){c.clearRect(0,0,1920,1080);c.drawImage(art.base,0,0);if(broadcast)previewHost(c,holes[1]);if(displayVisible){if(broadcast)previewMedia(c,holes[0]);else{c.fillStyle='#080d14';c.fillRect(...holes[0]);}}c.drawImage(surface,0,0);if(broadcast){previewChat(c,holes[2],world.id);previewQueue(c);}}
  canvas.dataset.displayVisible=String(displayVisible);
  canvas.dataset.ready='true';canvas.dataset.time=time.toFixed(3);canvas.dataset.paused=String(paused);canvas.dataset.automatic=String(automatic);
  canvas.dataset.events=JSON.stringify(active.map(e=>({id:e.id,kind:e.kind,started:e.started,manual:!!e.manual})));
  canvas.dataset.paintMs=((Number(canvas.dataset.paintMs)||0)*.9+(performance.now()-began)*.1).toFixed(2);
}
function loop(now){frame=0;if(disposed||paused||document.hidden)return;if(now-last>=1000/24-1){time+=last?Math.min(.15,(now-last)/1000):0;last=now;draw();}frame=requestAnimationFrame(loop);}
function start(){if(ready&&!disposed&&!frame&&!paused&&!document.hidden){last=0;frame=requestAnimationFrame(loop);}}
function stop(){if(frame)cancelAnimationFrame(frame);frame=0;last=0;}
function trigger(kind,id=crypto.randomUUID(),age=0){const spec=cues.find(e=>e.id===kind);if(!spec||manual.some(e=>e.id===id)||manual.length>=16)return;manual.push({...spec,kind,id,manual:true,seed:time*.137+manual.length*43.1,started:time-age});draw();}
function message(e){if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='living-lobby')return;const data=e.data;
  if(data.cue)trigger(data.cue,data.id,data.age||0);
  if(typeof data.paused==='boolean'){paused=data.paused;stop();draw();start();}
  if(typeof data.automatic==='boolean'){automatic=data.automatic;draw();}
  if(preview&&typeof data.broadcast==='boolean'){broadcast=data.broadcast;draw();}
  if(preview&&scene.adaptiveScreen&&typeof data.displayVisible==='boolean'){displayVisible=data.displayVisible;draw();}
}
function key(e){if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;const index=Number(e.key)-1;if(Number.isInteger(index)&&index>=0&&index<cues.length){e.preventDefault();trigger(cues[index].id);}}
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();live?.stop();}else{start();if(ready)live?.start();}});window.addEventListener('message',message);window.addEventListener('keydown',key);
window.addEventListener('pagehide',()=>{disposed=true;stop();live?.dispose();displayObserver?.dispose();art.dispose();clock.dispose();manual.length=0;ambient.clear();decisions.clear();if(surface)surface.width=surface.height=1;window.removeEventListener('message',message);window.removeEventListener('keydown',key);},{once:true});
try{await art.load();if(disposed)art.dispose();else{ready=true;if(params.has('cue'))trigger(params.get('cue'),undefined,Math.max(0,Math.min(11,Number(params.get('age'))||0)));document.querySelector('#loading').hidden=true;draw();start();live?.start();if(preview&&parent!==window)parent.postMessage({type:'living-lobby-ready',world:world.id},location.origin);}}
catch(error){if(!disposed){document.querySelector('#loading').textContent='The lobby artwork could not load. Keep the Streaming Hub running.';console.error(error);}}
