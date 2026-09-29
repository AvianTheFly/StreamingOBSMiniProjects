import {MuffinShow} from './muffins.js';
const project=location.pathname.split('/').pop();
const show=new MuffinShow(document.getElementById('effects'));
let current=null,audio=null,frame=0,lastGood=performance.now(),failedId=null;
async function ack(id,status){try{await fetch(`/api/ack/${project}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});}catch{}}
function stop(){cancelAnimationFrame(frame);frame=0;if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio=null;}show.clear();current=null;}
function tick(){if(!audio||!current)return;show.draw(audio.currentTime,audio.duration||7,current.effect);frame=requestAnimationFrame(tick);}
function start(item){
 stop();current=item;
 audio=new Audio(`/audio/${project}/${encodeURIComponent(item.id)}`);
 const owned=audio;
 audio.preload='auto';audio.volume=1;
 audio.addEventListener('loadedmetadata',()=>{if(audio!==owned)return;owned.currentTime=item.started?Math.min(item.elapsed,Math.max(0,owned.duration-.05)):0;if(!item.paused)owned.play().catch(()=>fail(item.id));});
 audio.addEventListener('playing',()=>{if(audio!==owned)return;ack(item.id,'playing');if(!frame)tick();});
 audio.addEventListener('ended',()=>{if(audio!==owned)return;ack(item.id,'ended');stop();failedId=item.id;});
 audio.addEventListener('error',()=>{if(audio===owned)fail(item.id);});
 audio.load();
}
function fail(id){failedId=id;ack(id,'error');stop();}
async function poll(){
 try{const r=await fetch(`/api/state/${project}`);if(!r.ok)throw Error();const state=await r.json();lastGood=performance.now();
  if(!state.active){stop();failedId=null;}
  else if(state.active.id!==current?.id&&state.active.id!==failedId)start(state.active);
  else if(current&&state.active.paused!==current.paused){current=state.active;if(current.paused){audio.pause();cancelAnimationFrame(frame);frame=0;}else audio.play().catch(()=>fail(current.id));}
 }catch{if(performance.now()-lastGood>2500)stop();}
 setTimeout(poll,current?100:350);
}
window.addEventListener('pagehide',stop);
poll();
