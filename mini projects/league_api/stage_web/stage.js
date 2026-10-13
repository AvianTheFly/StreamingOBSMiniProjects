import {pollVisible} from '/shared/visible-poll.js';
const loading=document.querySelector('#stage'),queue=document.querySelector('#queue');
const queueMode=location.pathname.endsWith('/queue');
let signature='';
function resize(){loading.style.transform=`scale(${Math.min(innerWidth/1920,innerHeight/1080)})`;}
addEventListener('resize',resize);resize();
function render(state){
  if(state.appearance?.image_url?.startsWith('/stage/art/'))document.querySelector('.sanctuary').style.backgroundImage=`url("${state.appearance.image_url}")`;
  // This full scene stays painted under an explicit Hold view. The scene owner
  // performs the gameplay handoff; a transport sample must never expose black.
  loading.hidden=queueMode;queue.hidden=!queueMode||!state.queue;
  document.querySelector('#queueLabel').textContent=state.queue_label||'IN QUEUE';
  document.querySelector('#loadingLabel').textContent=state.playing?'MATCH READY':state.connected===false?'WAITING FOR CLIENT':state.loading?'ENTERING THE RIFT':'WAITING FOR MATCH';
  const next=JSON.stringify(state.roster||[]);if(next===signature)return;signature=next;
  for(const side of ['allies','enemies']){
    const rows=(state.roster||[]).filter(p=>p.team===side),host=document.querySelector('#'+side);host.replaceChildren();
    for(let i=0;i<5;i++){
      const p=rows[i]||{},row=document.createElement('div');row.className='player';
      const portrait=document.createElement('div');portrait.className='portrait';portrait.textContent='✧';
      if(p.image){const img=document.createElement('img');img.src=p.image;img.alt='';img.onerror=()=>img.remove();portrait.append(img);}
      const info=document.createElement('div');info.className='player-info';
      for(const [tag,text] of [['strong',p.name||'Champion pending'],['span',p.label||`Player ${i+1}`],['small',p.role||'Role unavailable']]){const el=document.createElement(tag);el.textContent=text;info.append(el);}
      row.append(portrait,info);host.append(row);
    }
  }
}
const demo=new URLSearchParams(location.search).get('demo');
if(demo==='1')render({loading:true,queue:true,connected:true,roster:['Udyr','Ahri','Jinx','Ornn','Nami','Lee Sin','Lux','Ashe','Garen','Braum'].map((name,i)=>({name,label:['Spirit Walker','Moonlit Fox','Rocket Heart','Forge Keeper','Tidecaller'][i%5],role:['JUNGLE','MIDDLE','BOTTOM','TOP','UTILITY'][i%5],team:i<5?'allies':'enemies'}))});
else pollVisible({url:'/stage/state',interval:500,onData:render,onError:()=>{queue.hidden=true;document.querySelector('#loadingLabel').textContent='RECONNECTING';}});
document.addEventListener('visibilitychange',()=>document.body.classList.toggle('paused',document.hidden));
