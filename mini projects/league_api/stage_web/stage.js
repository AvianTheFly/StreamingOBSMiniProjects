import {pollVisible} from '/shared/visible-poll.js';
import {createRoster} from './loading-roster.js';
import {loadingEffects} from './loading-effects.js';
const loading=document.querySelector('#stage'),queue=document.querySelector('#queue');
const queueMode=location.pathname.endsWith('/queue'),updateRoster=createRoster();
const effects=loadingEffects(document.querySelector('#loadingEffects'));
let artwork='';
function resize(){loading.style.transform=`scale(${Math.min(innerWidth/1920,innerHeight/1080)})`;}
addEventListener('resize',resize);resize();
function render(state){
  const image=state.appearance?.image_url;
  if(image?.startsWith('/stage/art/')&&image!==artwork){artwork=image;document.querySelector('.sanctuary').style.backgroundImage=`url("${image}")`;}
  // Only the scene owner hands off gameplay; held scenes keep their complete art.
  loading.hidden=queueMode;queue.hidden=!queueMode||!state.queue;
  document.querySelector('#queueLabel').textContent=state.queue_label||'IN QUEUE';
  document.querySelector('#loadingLabel').textContent=state.playing?'MATCH READY':state.connected===false?'WAITING FOR CLIENT':state.loading?'ENTERING THE RIFT':'WAITING FOR MATCH';
  updateRoster(state.roster);
}
const demo=new URLSearchParams(location.search).get('demo')==='1';
let poller;
if(demo){
  const champions=[['Udyr',77],['Ahri',103],['Jinx',222],['Ornn',516],['Nami',267],['Lee Sin',64],['Lux',99],['Ashe',22],['Garen',86],['Braum',201]];
  render({loading:true,queue:true,connected:true,roster:champions.map(([name,id],i)=>({name,championId:id,image:`/champ-select/icons/${id}.png`,slot:i%5,label:['Spirit Walker','Moonlit Fox','Rocket Heart','Forge Keeper','Tidecaller'][i%5],role:['JUNGLE','MIDDLE','BOTTOM','TOP','UTILITY'][i%5],team:i<5?'allies':'enemies'}))});
  let sourceVisible=true,shown=true;
  const sync=()=>effects.setVisible(sourceVisible&&shown&&!document.hidden&&!queueMode);
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('obsSourceVisibleChanged',e=>{sourceVisible=e.detail?.visible!==false;sync();});
  window.addEventListener('pagehide',()=>{shown=false;sync();});window.addEventListener('pageshow',()=>{shown=true;sync();});sync();
}else poller=pollVisible({url:'/stage/state',interval:500,onData:render,onVisibility:visible=>effects.setVisible(visible&&!queueMode),onError:()=>{queue.hidden=true;document.querySelector('#loadingLabel').textContent='RECONNECTING';}});
window.addEventListener('pagehide',e=>{if(!e.persisted){poller?.dispose();effects.dispose();removeEventListener('resize',resize);}});
