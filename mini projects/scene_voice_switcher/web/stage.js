// One visible-document loop owns a chosen world's painted motion and finite guests.
import {AmbientClock,smooth,hash} from './shared/world-motion.js';
import {loadWorld} from './worlds.js';
const params=new URLSearchParams(location.search),preview=params.get('preview')==='1';
const world=await loadWorld(params.get('world')||'reef'),{scene,cues,artists}=world;
const canvas=document.querySelector('#stage'),c=canvas.getContext('2d'),surface=document.createElement('canvas');surface.width=1920;surface.height=1080;const m=surface.getContext('2d');
document.title=world.label+' · Living lobby';canvas.setAttribute('aria-label','Animated '+world.label+' painting');
const art=world.createMotion(),clock=new AmbientClock(cues,world.seed||71),manual=[],ambient=new Map(),decisions=new Map();
let ready=false,disposed=false,frame=0,last=0,paused=params.get('paused')==='1',automatic=params.get('auto')!=='0',at=params.has('at')?Number(params.get('at')):null,time=Number.isFinite(at)&&at!==null?at:Date.now()/1000;
let holes=scene.holes;
try{const custom=JSON.parse(params.get('holes'));if(Array.isArray(custom)&&custom.length===3&&custom.every(r=>Array.isArray(r)&&r.length===4&&r.every(Number.isFinite)&&r[2]>=32&&r[3]>=32&&r[0]>=0&&r[1]>=0&&r[0]+r[2]<=1920&&r[1]+r[3]<=1080))holes=custom;}catch{ /* Use authored apertures when no complete valid placement is provided. */ }
function events(){
  for(let i=manual.length-1;i>=0;i--)if(time>=manual[i].started+manual[i].life)manual.splice(i,1);
  for(const [id,e] of ambient)if(time>=e.started+e.life)ambient.delete(id);
  for(const [id,end] of decisions)if(time>end+15)decisions.delete(id);
  if(automatic){const pressure=manual.reduce((sum,e)=>sum+e.impact,0);
    for(const event of clock.active(time)){if(decisions.has(event.id))continue;decisions.set(event.id,event.started+event.life);if(decisions.size>256)decisions.delete(decisions.keys().next().value);
      if(hash(event.seed+77)>1-Math.exp(-pressure*.25))ambient.set(event.id,event);}
  }
  return [...ambient.values(),...manual];
}
function draw(){
  if(!ready||disposed)return;const began=performance.now(),active=events();
  m.clearRect(0,0,1920,1080);art.draw(m,time,active);
  for(const event of active){const age=time-event.started,spec=cues.find(x=>x.id===event.kind);if(!spec)continue;const artist=artists[event.kind];if(!artist)continue;
    m.save();m.globalAlpha=smooth(age/.6)*smooth((spec.life-age)/.75);world.clip?.(m,spec);artist(m,age,event);m.restore();}
  // Saved live-camera, desktop and chat placement wins over every accent.
  for(const rect of holes)m.clearRect(...rect);
  c.clearRect(0,0,1920,1080);if(preview)c.drawImage(art.base,0,0);c.drawImage(surface,0,0);
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
}
function key(e){if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;const index=Number(e.key)-1;if(Number.isInteger(index)&&index>=0&&index<cues.length){e.preventDefault();trigger(cues[index].id);}}
document.addEventListener('visibilitychange',()=>document.hidden?stop():start());window.addEventListener('message',message);window.addEventListener('keydown',key);
window.addEventListener('pagehide',()=>{disposed=true;stop();art.dispose();clock.dispose();manual.length=0;ambient.clear();decisions.clear();surface.width=surface.height=1;window.removeEventListener('message',message);window.removeEventListener('keydown',key);},{once:true});
try{await art.load();if(disposed)art.dispose();else{ready=true;if(params.has('cue'))trigger(params.get('cue'),undefined,Math.max(0,Math.min(11,Number(params.get('age'))||0)));document.querySelector('#loading').hidden=true;draw();start();}}
catch(error){if(!disposed){document.querySelector('#loading').textContent='The lobby artwork could not load. Keep the Streaming Hub running.';console.error(error);}}
