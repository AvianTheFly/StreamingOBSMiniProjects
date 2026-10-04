import {SpiritTransition} from './renderer.js';
import {spirits,timing,animationTiming,clips} from './catalog.js';
import {camera} from './motion.js';
const show=new SpiritTransition(document.querySelector('canvas'));
const cards=document.querySelector('#cards'),play=document.querySelector('#play'),random=document.querySelector('#random'),variant=document.querySelector('#variant');
const scrub=document.querySelector('#scrub'),time=document.querySelector('#time'),scene=document.querySelector('#scene'),title=document.querySelector('#sceneTitle');
let selected='bear',raf=0,started=0,generation=0,bag=[],last=null,audio=null;
const performances={bear:0,turtle:0,ram:0,phoenix:0};
function stop(){cancelAnimationFrame(raf);raf=0;if(audio){audio.pause();audio.currentTime=0;}play.textContent='Play transition';}
scrub.max=timing.duration;
function draw(t){
 show.draw(t);const id=clips[selected].spirit,k=camera(id,t),cut=animationTiming(id).cut;
 scene.style.transform=`translate(${k.x/19.2}%,${k.y/10.8}%) scale(${k.zoom})`;
 scrub.value=t;time.textContent=`${t.toFixed(2)} / ${timing.duration.toFixed(2)}`;
 scene.classList.toggle('next',t>=cut);title.textContent=t>=cut?'The next scene, revealed':'The scene you’re leaving';
}
async function select(clip){
 stop();const token=++generation;play.disabled=random.disabled=variant.disabled=true;selected=clip;
 try{
  await show.load(clip);if(token!==generation)return;draw(0);
  const id=clips[clip].spirit;
  variant.replaceChildren(...Object.entries(clips).filter(([,v])=>v.spirit===id).map(([key,v])=>{const o=document.createElement('option');o.value=key;o.textContent=v.name;return o;}));variant.value=clip;
  document.querySelector('.hint').textContent=`Preview only · ${clips[clip].name}. Scene cut at ${animationTiming(id).cut.toFixed(2)} seconds, inside the fully covered interval.`;
  for(const b of cards.children)b.classList.toggle('selected',b.dataset.id===id);
  document.querySelector('#error').textContent='';
 }catch(e){document.querySelector('#error').textContent=`Artwork could not load: ${e.message}`;return;}
 play.disabled=random.disabled=variant.disabled=false;
}
for(const [id,spec] of Object.entries(spirits)){
 const b=document.createElement('button');b.className='card';b.dataset.id=id;b.style.setProperty('--accent',spec.color);
 b.innerHTML=`<b>${spec.name}</b><span>${spec.subtitle}</span>`;b.onclick=()=>select(id);cards.append(b);
}
function next(){
 if(!bag.length){bag=Object.keys(spirits);for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}if(bag.at(-1)===last)[bag[0],bag[bag.length-1]]=[bag.at(-1),bag[0]];}
 last=bag.pop();return last+(performances[last]++%2?'-alt':'');
}
function start(){
 stop();started=performance.now();play.textContent='Replay';
 if(document.querySelector('#sound').checked){audio=new Audio(`./audio/${selected}.wav`);audio.volume=.65;audio.play().catch(()=>{});}
 function frame(now){const t=Math.min(timing.duration,(now-started)/1000);draw(t);if(t<timing.duration)raf=requestAnimationFrame(frame);else stop();}raf=requestAnimationFrame(frame);
}
play.onclick=start;variant.onchange=()=>select(variant.value);random.onclick=async()=>{await select(next());if(!play.disabled)start();};
scrub.oninput=()=>{stop();draw(Number(scrub.value));};document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',()=>{stop();show.dispose();});
await select(selected);window.spiritPreview={show,draw,select};
