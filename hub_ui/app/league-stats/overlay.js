import {n,chooseView,focus} from './model.js';
const el=id=>document.getElementById(id),params=new URLSearchParams(location.search);
document.documentElement.dataset.theme=['teal','violet','gold'].includes(params.get('theme'))?params.get('theme'):'teal';
const period=['all','today','session'].includes(params.get('period'))?params.get('period'):'all';
let busy=false,latest=null,expiry=null,signature='',timer=null,version=0,controller=null,stopped=true;
function render(s){
 const c=s.current||s.recap,m=c?.metrics||{},a=s.summary;
 el('champion').textContent=c?.champion||'LEAGUE STATS';
 el('state').textContent=s.current?.connected?'LIVE':c?.state==='complete'||!s.current&&s.recap?'LAST GAME':c?'LAST TRACKED':'SESSION';
 el('state').dataset.live=String(!!s.current?.connected);
 el('kda').textContent=[m.kills,m.deaths,m.assists].map(n).join(' / ');
 el('cs').textContent=n(c?.cs_per_minute??m.cs_per_minute);
 el('record').textContent=`${a.wins} W · ${a.losses} L`;
 el('recordScope').textContent=period==='session'?'SESSION RECORD':period==='today'?'TODAY RECORD':'ALL RECORDED';
 el('misses').textContent=`Melee ${n(m.missed_melee)} · Ranged ${n(m.missed_ranged)} · Cannon ${n(m.missed_cannon)}`;
 const spot=s.spotlight&&(!s.spotlight.expires_at||s.spotlight.expires_at*1000>Date.now())?s.spotlight:null;
 showSpotlight(spot||focus(s,chooseView(params,s)));
}
function showSpotlight(data){
 const card=el('spotlight'),key=JSON.stringify(data);
 if(key===signature)return;signature=key;clearTimeout(expiry);card.hidden=!data;
 if(!data)return;
 card.dataset.kind=data.kind||'viewer';
 el('spotTitle').textContent=data.title+(data.requested_by?' · requested by '+data.requested_by:'');
 el('spotText').textContent=data.text;el('spotScope').textContent=data.scope||'';
 el('spotBar').hidden=data.progress==null;el('spotBar').value=data.progress??0;
 if(data.expires_at)expiry=setTimeout(()=>{signature='';if(latest)render(latest);},Math.max(0,data.expires_at*1000-Date.now()));
}
async function poll(){
 if(busy||stopped)return;busy=true;const ticket=version,request=new AbortController();controller=request;
 try{const response=await fetch('/api/league-stats?period='+encodeURIComponent(period),{signal:request.signal});if(!response.ok)throw Error();const data=await response.json();if(ticket!==version||stopped)return;latest=data;document.body.dataset.offline='false';render(latest);}
 catch{if(ticket===version&&!stopped){el('state').textContent='HUB OFFLINE';el('state').dataset.live='false';document.body.dataset.offline='true';showSpotlight(null);}}
 finally{if(ticket===version){busy=false;controller=null;}}
}
function activate(){if(!stopped)return;stopped=false;version++;poll();timer=setInterval(poll,2000);}
addEventListener('pagehide',()=>{stopped=true;version++;controller?.abort();controller=null;busy=false;clearInterval(timer);timer=null;clearTimeout(expiry);});
addEventListener('pageshow',activate);activate();
