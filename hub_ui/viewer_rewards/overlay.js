import {EffectShow} from './renderer.js';
const key=new URLSearchParams(location.search).get('key'),show=new EffectShow(document.getElementById('stage'));
let busy=false,lastGood=performance.now(),generation=0,programActive=true;
function hidden(){if(!programActive||document.hidden){generation++;show.cancel();}}
window.addEventListener('obsSourceActiveChanged',event=>{programActive=event.detail.active;hidden();});
document.addEventListener('visibilitychange',hidden);
async function acknowledge(effect,status){
 await fetch('/api/ack?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({id:effect.id,status})});
}
async function display(effect){
 busy=true;const owned=++generation;
 try{const played=await show.play(effect);await acknowledge(effect,played&&owned===generation?'played':'error');}
 catch{show.cancel();try{await acknowledge(effect,'error');}catch{}}
 finally{busy=false;}
}
async function poll(){
 try{
  const response=await fetch('/api/next?key='+encodeURIComponent(key)+'&active='+(programActive&&!document.hidden?'1':'0'));if(!response.ok)throw Error('Overlay unavailable');
  const effect=await response.json();lastGood=performance.now();
  if(effect?.id&&!busy)display(effect);
 }catch{if(performance.now()-lastGood>2500){generation++;show.cancel();}}
 setTimeout(poll,350);
}
window.addEventListener('pagehide',()=>{generation++;show.cancel();});
poll();
