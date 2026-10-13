import {pollVisible} from '/shared/visible-poll.js';
import {paintSpirit,paintTrack,SPIRITS} from './queue-art.js';
import {themeFrame,blendCues} from './queue-theme.js';
import {paintBackground,loadSpiritArt} from './queue-background.js';
import {EFFECT_NAMES} from './queue-effects.js';
const card=document.querySelector('#queueCard'),canvas=document.querySelector('#spirit'),timer=document.querySelector('#queueTime');
const atmosphere=document.querySelector('#queueAtmosphere'),artLifetime=new AbortController();
const track=document.querySelector('#queueTrack');
const labels={TOP:'Top',JUNGLE:'Jungle',MIDDLE:'Mid',BOTTOM:'Bot',UTILITY:'Support',FILL:'Fill'};
let data={},sample=performance.now(),frame=0,visible=false,disposed=false,art={},lastPaint=-Infinity,lastTheme='',dirty=true;
const params=new URLSearchParams(location.search),demo=params.get('demo')==='1',reduced=matchMedia('(prefers-reduced-motion:reduce)');
const demoEpoch=performance.now();let demoOffset=0,demoAnchor=demoEpoch,demoPaused=false,demoControls,demoMix=0,demoAct=null;
let visualEpoch=null;
let lastPresentation=null,handoff=null;
function documentSeed(){
  // Keep a browser refresh on its existing shuffle; a different browser session
  // gets fresh randomness. This is presentation state, never a Hub setting.
  let seed=crypto.getRandomValues(new Uint32Array(1))[0];
  try{const saved=sessionStorage.getItem('queue-visual-seed');if(saved!==null&&/^\d+$/.test(saved))seed=Number(saved)>>>0;else sessionStorage.setItem('queue-visual-seed',String(seed));}catch{}
  return seed;
}
const visualSeed=documentSeed();
function effectTime(now){return demo?demoOffset+(demoPaused?0:(now-demoAnchor)/1000):Math.max(0,(now-(visualEpoch??now))/1000);}
function beginHandoff(){
  if(!lastPresentation||reduced.matches||demoPaused){handoff=null;return;}
  handoff={theme:lastPresentation.current,cues:lastPresentation.current===lastPresentation.to?lastPresentation.cues:lastPresentation.fromCues,start:effectTime(performance.now())};
}
loadSpiritArt(artLifetime.signal).then(loaded=>{if(disposed){releaseArt(loaded);return;}art=loaded;dirty=true;atmosphere.dataset.artReady='true';atmosphere.dataset.artCount=String(Object.keys(art).length);});
function releaseArt(surfaces){for(const surface of Object.values(surfaces)){surface.width=surface.height=0;}}
function fitPreview(){card.style.setProperty('--queue-scale',String(Math.min(.8,Math.max(0,innerWidth-32)/604)));}
fitPreview();addEventListener('resize',fitPreview);
export function formatTime(seconds){const value=Math.max(0,Math.floor(Number(seconds)||0));return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`;}
function updateClock(seconds){
  const value=formatTime(seconds);if(timer.dataset.clock===value)return;timer.dataset.clock=value;
  timer.replaceChildren(...[...value].map((char,i)=>{const span=document.createElement('span');span.className=char===':'?'time-colon':'time-digit';span.textContent=char;span.style.animationDelay=`${i*.025}s`;return span;}));
}
function stop(){cancelAnimationFrame(frame);frame=0;lastPaint=-Infinity;}
function draw(now){
  frame=0;if(disposed||!visible||!data.active)return;
  if(now-lastPaint>=1000/24){
    lastPaint=now;
    const seconds=(data.seconds||0)+(data.running?(now-sample)/1000:0),motion=!reduced.matches;
    updateClock(seconds);
    const rotationSeconds=effectTime(now),presentation=themeFrame({...data,visual_seed:visualSeed+demoMix},rotationSeconds,motion);
    if(demo&&demoAct!==null){
      const phase=(rotationSeconds%45)/45;
      presentation.from=presentation.current=presentation.to=data.theme;presentation.mix=1;
      presentation.cue=motion?{id:demoAct,phase,amount:Math.sin(phase*Math.PI)**2,weight:1}:null;
      presentation.cues=presentation.cue?[presentation.cue]:[];
    }
    if(handoff){
      const u=Math.max(0,Math.min(1,(rotationSeconds-handoff.start)/4)),blend=u*u*(3-2*u);
      if(u>=1)handoff=null;
      else if(handoff.theme===presentation.to){presentation.cues=blendCues(handoff.cues,presentation.cues,blend);}
      else {presentation.from=handoff.theme;presentation.fromCues=handoff.cues;presentation.mix=blend;presentation.current=blend<.5?handoff.theme:presentation.to;}
    }
    lastPresentation=presentation;
    if(lastTheme!==presentation.current){lastTheme=presentation.current;dirty=true;card.dataset.theme=lastTheme;}
    if((motion&&(!demo||!demoPaused))||dirty){
      canvas.style.opacity=String(presentation.from===presentation.to?1:.65+.35*Math.abs(presentation.mix*2-1));
      const time=effectTime(now);
      const cue=presentation.current===presentation.to?presentation.cue:null;
      paintSpirit(canvas,presentation.current,time,motion,cue?.amount||0,cue);paintBackground(atmosphere,presentation,time,motion,art);paintTrack(track,presentation,time,motion);dirty=false;
      if(demoControls){
        if(!demoPaused)demoControls.querySelector('input').value=String(time%45);
        const caption=demoControls.querySelector('output'),text=demoAct===null?'This appearance: '+presentation.plan.map(id=>EFFECT_NAMES[presentation.to][id]).join(' · '):'Now exploring: '+EFFECT_NAMES[presentation.to][demoAct]+' · continuous motion';
        if(caption.textContent!==text)caption.textContent=text;
      }
    }
  }
  frame=requestAnimationFrame(draw);
}
function render(state){
  if(data.theme_mode&&data.theme_mode!==state.queue_timer?.theme_mode)beginHandoff();
  data=state.queue_timer||{};sample=performance.now();card.hidden=!data.active;
  // Queue API clock corrections update the digits, never seek the artwork.
  if(visualEpoch===null&&data.active)visualEpoch=sample-(Number(data.seconds)||0)*1000;
  dirty=true;document.querySelector('#queueStatus').textContent=data.status||'IN QUEUE';
  const roles=document.querySelector('#queueRoles');roles.replaceChildren();
  (data.roles||[]).forEach((role,i)=>{const span=document.createElement('span'),small=document.createElement('small');small.textContent=i?'SECONDARY':'PRIMARY';span.append(small,labels[role]||'');roles.append(span);});
  if(!roles.childNodes.length)roles.textContent='Roles unavailable for this queue';
  updateClock(data.seconds);
  stop();if(visible&&data.active)draw(performance.now());
}
function visibility(value){visible=value;document.body.classList.toggle('paused',!value);stop();if(value&&data.active)frame=requestAnimationFrame(draw);}
let transport;
function demoVisibility(){visibility(!document.hidden);}
function mountExplorer(){
  // Local preview controls never call a settings API or change the OBS source.
  demoControls=document.createElement('div');demoControls.className='queue-explorer';
  demoControls.innerHTML=`<label>Explore spirit <select aria-label="Preview spirit">${Object.entries(SPIRITS).map(([id,s])=>`<option value="${id}">${s.name.split(' · ')[0]}</option>`).join('')}<option value="rotate">SHUFFLE</option></select></label><button type="button">Pause</button><label class="effect-slider">Explore loop <input aria-label="Explore effect moment" type="range" min="0" max="44.9" step=".1" value="0"></label><button type="button" class="new-mix">New mix</button><label class="act-picker">Explore act <select aria-label="Preview performance"><option value="mix">Shuffled mix</option>${Object.entries(EFFECT_NAMES).map(([theme,names])=>`<optgroup label="${SPIRITS[theme].name.split(' · ')[0]}">${names.map((name,id)=>`<option value="${theme}:${id}">${id>=8?'✦ ':''}${name}</option>`).join('')}</optgroup>`).join('')}</select></label><output></output>`;
  const select=demoControls.querySelector('select'),button=demoControls.querySelector('button'),slider=demoControls.querySelector('input');
  select.value=data.theme_mode;
  const acts=demoControls.querySelector('[aria-label="Preview performance"]');
  function continuePlaying(){demoOffset=effectTime(performance.now());demoAnchor=performance.now();demoPaused=false;button.textContent='Pause';dirty=true;}
  select.onchange=()=>{beginHandoff();data={...data,theme:select.value==='rotate'?'bear':select.value,theme_mode:select.value};demoAct=null;acts.value='mix';dirty=true;};
  acts.onchange=()=>{beginHandoff();if(acts.value==='mix')demoAct=null;else {const [theme,id]=acts.value.split(':');demoAct=Number(id);data={...data,theme,theme_mode:theme};select.value=theme;}continuePlaying();};
  button.onclick=()=>{demoOffset=effectTime(performance.now());demoAnchor=performance.now();demoPaused=!demoPaused;button.textContent=demoPaused?'Play':'Pause';dirty=true;};
  slider.oninput=()=>{handoff=null;const now=performance.now();demoOffset=Math.floor(effectTime(now)/45)*45+Number(slider.value);demoAnchor=now;demoPaused=true;button.textContent='Play';dirty=true;};
  demoControls.querySelector('.new-mix').onclick=()=>{beginHandoff();demoMix++;demoAct=null;acts.value='mix';continuePlaying();};
  button.disabled=slider.disabled=reduced.matches;document.body.append(demoControls);
}
if(demo){document.body.classList.add('demo');visible=!document.hidden;document.addEventListener('visibilitychange',demoVisibility);render({queue_timer:{active:true,running:false,seconds:Number(params.get('seconds')||147),status:params.get('phase')||'IN QUEUE',roles:['BOTTOM','UTILITY'],theme:params.get('theme')==='rotate'?'bear':params.get('theme')||'bear',theme_mode:params.get('theme')||'bear'}});mountExplorer();}
else transport=pollVisible({url:'/stage/state',interval:1000,onData:render,onError:()=>{data={};card.hidden=true;stop();},onVisibility:visibility});
addEventListener('pagehide',()=>{disposed=true;stop();transport?.dispose();artLifetime.abort();releaseArt(art);art={};removeEventListener('resize',fitPreview);document.removeEventListener('visibilitychange',demoVisibility);},{once:true});
