import {MoodRenderer} from './renderer.js';
const renderer=new MoodRenderer(document.getElementById('mood'));
let current=null,audio=null,frame=0,elapsed=0,lastTick=0,failedId=null,lastGood=performance.now(),timer=0;
async function ack(id,status){try{await fetch('/api/ack/love_me',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});}catch{}}
function stop(){cancelAnimationFrame(frame);frame=0;renderer.clear();if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio=null;}current=null;}
function finish(status){const id=current?.id;if(!id)return;failedId=id;ack(id,status);stop();}
function tick(now){
 if(!current||current.paused)return;
 const row=current.effect;
 if(audio)elapsed=(audio.currentTime-row.audio_start)/row.audio_rate;
 else elapsed+=(now-lastTick)/1000;
 lastTick=now;
 if(elapsed>=row.duration){finish('ended');return;}
 renderer.draw(Math.max(0,elapsed),row);
 frame=requestAnimationFrame(tick);
}
function resume(){if(!current||current.paused)return;lastTick=performance.now();if(!frame)frame=requestAnimationFrame(tick);}
async function start(item){
 stop();current=item;elapsed=item.started?item.elapsed:0;lastTick=performance.now();
 const row=item.effect;
 try{await renderer.prepare(row);}catch{if(current?.id===item.id)finish('error');return;}
 if(current?.id!==item.id)return;
 if(!row.audio){ack(item.id,'playing');resume();return;}
 const owned=audio=new Audio('/audio/love_me/'+encodeURIComponent(item.id));
 owned.preload='auto';owned.playbackRate=row.audio_rate;owned.preservesPitch=true;
 owned.addEventListener('loadedmetadata',()=>{
  if(audio!==owned)return;
  // Reject short/incorrect files instead of silently stretching, drifting or looping early.
  if(!Number.isFinite(owned.duration)||owned.duration+.08<row.audio_start+row.duration*row.audio_rate){finish('error');return;}
  owned.currentTime=row.audio_start+elapsed*row.audio_rate;
  if(!current.paused)owned.play().catch(()=>{if(audio===owned)finish('error');});
 });
 owned.addEventListener('playing',()=>{if(audio===owned){ack(item.id,'playing');resume();}});
 owned.addEventListener('ended',()=>{if(audio===owned)finish(elapsed>=row.duration-.1?'ended':'error');});
 owned.addEventListener('error',()=>{if(audio===owned)finish('error');});owned.load();
}
async function poll(){
 try{
  const response=await fetch('/api/state/love_me');if(!response.ok)throw Error();
  const state=await response.json();lastGood=performance.now();
  if(!state.active){stop();failedId=null;}
  else if(state.active.id!==current?.id&&state.active.id!==failedId)start(state.active);
  else if(current&&current.paused!==state.active.paused){
   current=state.active;
   if(current.paused){if(!audio&&frame)elapsed+=(performance.now()-lastTick)/1000;audio?.pause();cancelAnimationFrame(frame);frame=0;}
   else if(audio){const owned=audio;if(owned.readyState>=1)owned.play().catch(()=>{if(audio===owned)finish('error');});}
   else resume();
  }
 }catch{if(performance.now()-lastGood>2500)stop();}
 timer=setTimeout(poll,current?80:350);
}
window.addEventListener('pagehide',()=>{clearTimeout(timer);stop();});poll();
