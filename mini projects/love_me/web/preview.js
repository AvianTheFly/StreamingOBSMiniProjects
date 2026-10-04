import {MoodRenderer} from './renderer.js';
const renderer=new MoodRenderer(document.getElementById('mood'));
let row=null,frame=0,started=0,time=0,running=false,audio=null,intent=0;
const parentOrigin='http://127.0.0.1:7420';
function stop(){cancelAnimationFrame(frame);frame=0;running=false;audio?.pause();}
function tick(now){if(!row||!running)return;time=audio?(audio.currentTime-row.audio_start)/row.audio_rate:(now-started)/1000;if(time>=row.duration){stop();return;}renderer.draw(Math.max(0,time),row);frame=requestAnimationFrame(tick);}
window.addEventListener('message',async event=>{
 if(event.source!==parent||!['http://127.0.0.1:7420','http://localhost:7420'].includes(event.origin))return;
 const message=event.data;if(message?.type!=='mood-preview')return;
 const ownedIntent=++intent;
 stop();audio?.removeAttribute('src');audio=null;
 if(message.row){row=message.row;time=message.time??row.audio_anchor;
  try{await renderer.prepare(row);}catch(error){if(intent===ownedIntent)parent.postMessage({type:'mood-preview-error',message:error.message||'Could not prepare cue artwork.'},event.origin);return;}
  if(intent!==ownedIntent)return;renderer.draw(time,row);}
 if(message.play&&row){
  time=0;started=performance.now();
  if(message.audio){
   const owned=audio=new Audio(message.audio),ownedRow=row;audio.playbackRate=row.audio_rate;
   owned.addEventListener('loadedmetadata',()=>{
    if(audio!==owned)return;
    if(owned.duration<ownedRow.audio_start+ownedRow.duration*ownedRow.audio_rate){parent.postMessage({type:'mood-preview-error',message:'Audio is shorter than this excerpt. Adjust trim start or length.'},event.origin);return;}
    owned.currentTime=ownedRow.audio_start;owned.play().then(()=>{if(audio===owned){running=true;frame=requestAnimationFrame(tick);}}).catch(()=>{if(audio===owned)parent.postMessage({type:'mood-preview-error',message:'Click preview again to allow audio.'},event.origin);});
   });
   owned.addEventListener('error',()=>{if(audio===owned)parent.postMessage({type:'mood-preview-error',message:'Could not play this audio file.'},event.origin);});
  }else{running=true;frame=requestAnimationFrame(tick);}
 }
});
window.addEventListener('pagehide',()=>{++intent;stop();audio?.removeAttribute('src');audio?.load();audio=null;renderer.clear();});
parent.postMessage({type:'mood-preview-ready'},parentOrigin);
