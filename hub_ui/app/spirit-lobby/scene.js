// One document-owned animation loop and a bounded screen-library refresh.
// No audio, hooks or scene writes. Hidden documents release frames and media.
import {W,H,readConfig,palettes} from './config.js';
import {Room} from './room.js';
import {Lighting} from './lighting.js';
import {Props} from './props.js';
import {Projection} from './projection.js';
import {Celebration} from './celebration.js';
import {Penguin} from './penguin.js';
import {ScreenContent} from './screen-content.js';
import {ActionLink} from './action-link.js';
import {PartyDirector} from './party-director.js';
import {drawDisplayFrame} from '../lobby-motion/shared/display-frame.js';

let holes=[[60,180,896,504],[1000,378,444,420],[1460,480,360,225]];
try{
 const saved=JSON.parse(new URLSearchParams(location.search).get('holes'));
 if(Array.isArray(saved)&&saved.length===3&&saved.every(r=>Array.isArray(r)&&r.length===4&&r.every(Number.isFinite)&&r[0]>=0&&r[1]>=0&&r[2]>=32&&r[3]>=32&&r[0]+r[2]<=W&&r[1]+r[3]<=H))holes=saved;
}catch{/* Retain the authored layout when the URL has no complete placement. */}

const canvas=document.querySelector('#stage'),c=canvas.getContext('2d',{alpha:true});
let config=readConfig(),frame=0,last=0,time=config.at,ready=false,disposed=false;
const screens=new ScreenContent(()=>{if(ready&&config.paused)draw();}),room=new Room(),lights=new Lighting(),props=new Props(screens),projection=new Projection(screens),confetti=new Celebration();
const penguin=new Penguin();
const party=new PartyDirector(confetti);
const actionLink=new ActionLink(cue=>action(cue.action,cue.id));
const fps=()=>config.quality==='low'?24:30;
function resize(){document.documentElement.classList.toggle('foreground',config.layer==='foreground');const scale=config.quality==='low'?.75:1;canvas.width=Math.round(W*scale);canvas.height=Math.round(H*scale);}
function draw(){
  if(!config.paused)party.tick(time,config.party,Date.now()/1000,config.speed);
  confetti.prune(time);
  const began=performance.now(),colors=palettes[config.palette],display=screens.effective(config);screens.tick(display);c.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
  c.clearRect(0,0,W,H);
  if(config.layer!=='foreground'){
  room.draw(c);projection.render(c,time,display,colors);lights.room(c,time,config.energy,colors);
  props.signs(c,time,display,colors);
  confetti.draw(c,time,colors,'back');
  lights.ball(c,495,143,84,time,colors);lights.ball(c,1428,144,77,time+3,colors);
  props.oddities(c,time,colors);
  props.speaker(c,545,time,0,config.energy,colors);props.speaker(c,1245,time,1,config.energy,colors);

  props.fixtures(c,time,colors);
  const penguinTime=confetti.waveTime(time);
  canvas.dataset.penguin=penguin.draw(c,penguinTime,{x:302,y:958,hue:175,opacity:config.penguinOpacity,colorTime:time});
  penguin.draw(c,penguinTime,{x:1618,y:958,hue:295,mirror:true,opacity:config.penguinOpacity,colorTime:time});
  canvas.dataset.waveHand=penguinTime%3.8<1.9?'right':'left';
  canvas.dataset.penguinCount='2';
  }
  if(config.layer!=='background'){
    if(config.cameraGuide&&config.layer==='full'){
      const [x,y,w,h]=holes[1];c.save();c.strokeStyle='#b7fff1aa';c.lineWidth=2;c.setLineDash([8,8]);c.strokeRect(x,y,w,h);c.setLineDash([]);
      c.fillStyle='#b7fff1';c.font='18px Segoe UI';c.textAlign='center';c.fillText('YOUR LIVE FACE CAM',x+w/2,y+h/2);c.restore();
    }
    props.desk(c,time,display,colors);lights.front(c,time,config.energy,colors);
    // Accents surround the live camera without passing over the user's face.
    c.save();c.beginPath();c.rect(0,0,W,H);c.rect(...holes[1]);c.clip('evenodd');confetti.draw(c,time,colors);c.restore();
  }
  // Native layers leave every live desktop/chat pixel clear; full studio keeps
  // the selected media programs visible inside the authored main display.
  if(config.layer!=='full'){
   if(config.layer==='foreground')drawDisplayFrame(c,holes[0],{accent:'#86e5de'});
   for(const rect of config.layer==='foreground'?holes:[holes[1],holes[2]])c.clearRect(...rect);
  }
  canvas.dataset.ready='true';canvas.dataset.time=time.toFixed(3);canvas.dataset.paused=String(config.paused);
  canvas.dataset.paintMs=((Number(canvas.dataset.paintMs)||0)*.9+(performance.now()-began)*.1).toFixed(2);
  canvas.dataset.screen=screens.choice('main',display);
  canvas.dataset.screenReady=String(screens.slots.get('main')?.ready||['cosmos','liquid','spirit'].includes(canvas.dataset.screen));
  canvas.dataset.effectCount=String(confetti.instances.length);
  canvas.dataset.effects=JSON.stringify(confetti.instances.map(e=>({id:e.id,kind:e.kind,started:e.started,ends:e.ends})));
  canvas.dataset.party=config.party;
  canvas.dataset.ambientCount=String(confetti.instances.filter(e=>e.ambient).length);
}
function loop(now){
  frame=0;if(disposed||document.hidden||config.paused)return;
  if(now-last>=1000/fps()-1){const delta=last?Math.min(.1,(now-last)/1000):0;time+=delta*config.speed;last=now;draw();}
  frame=requestAnimationFrame(loop);
}
function start(){if(ready&&!frame&&!disposed&&!document.hidden&&!config.paused){last=0;frame=requestAnimationFrame(loop);}}
function stop(){if(frame)cancelAnimationFrame(frame);frame=0;last=0;}
function action(name,id){
  if(!ready)return {ok:false,reason:'The room is still loading.'};
  if(name==='clear-preview'){confetti.clear();draw();return {ok:true};}
  const result=confetti.trigger(time,name,id);if(config.paused)draw();
  if(window.parent!==window)window.parent.postMessage({type:'spirit-party-result',...result,count:confetti.instances.length},location.origin);
  return result;
}
function onKey(e){if(e.repeat||e.ctrlKey||e.altKey||e.metaKey)return;const spec=confetti.catalog.find(item=>item.key===e.key.toLowerCase());if(spec){e.preventDefault();const cue={action:spec.id,id:crypto.randomUUID()},result=action(cue.action,cue.id);if(result.ok&&config.layer!=='full')actionLink.publish(cue);}}
function onMessage(e){
  if(e.origin!==location.origin||e.source!==window.parent||!e.data||e.data.type!=='spirit-lobby')return;
  if(e.data.action)action(e.data.action,e.data.id);
  if(typeof e.data.query==='string'){
    config=readConfig(e.data.query);screens.refresh();resize();stop();if(ready){draw();start();}
  }
}
document.addEventListener('visibilitychange',()=>{screens.suspend(document.hidden);if(document.hidden){stop();actionLink.stop();}else{start();actionLink.start();}});
window.addEventListener('keydown',onKey);window.addEventListener('message',onMessage);
window.addEventListener('pagehide',()=>{disposed=true;stop();screens.dispose();party.dispose();confetti.dispose();actionLink.dispose();window.removeEventListener('keydown',onKey);window.removeEventListener('message',onMessage);},{once:true});
resize();
try {
  await Promise.all([screens.load(),props.load(),confetti.load(),...(config.layer==='foreground'?[]:[room.load(),penguin.load()])]);ready=true;
  document.querySelector('#loading').hidden=true;draw();start();actionLink.start();
} catch(error) {
  document.querySelector('#loading').textContent='The clubhouse could not load its artwork. Open this overlay through the running Hub.';
  console.error(error);
}
