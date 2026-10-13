import {pollVisible} from '/shared/visible-poll.js';
import {renderReport,renderView,loadArt} from './postgame-render.js';
const params=new URLSearchParams(location.search),stream=params.get('stream')==='1',control=params.get('control')==='1';
const el=id=>document.getElementById(id),views=['highlights','tempo','combat','build','economy','vision','moments'];
document.body.classList.toggle('stream',stream);document.body.classList.toggle('controller',control);
el('showControls').hidden=!control;
let latest=null,signature='',viewSignature='',pending=false,closed=false;
let abort=new AbortController();
function controls(){if(!latest)return;const show=latest.show||{};
 el('rotation').textContent=show.hold_remaining>0?'Auto in '+Math.ceil(show.hold_remaining)+'s':show.playing?'Auto':'Paused';
 el('pause').textContent=show.playing?'Ⅱ':'▶';el('pause').setAttribute('aria-label',show.playing?'Pause automatic pages':'Resume automatic pages');
 el('showStatus').textContent=show.visible?'● Ready for OBS':show.safe===false?'Preview · waiting for lobby':'○ Preview only';
 el('showStatus').classList.toggle('on-air',!!show.visible);
 el('showToggle').textContent=show.visible?'Hide from OBS':'Show on OBS';
 el('showToggle').disabled=pending||!latest.match||(!show.visible&&!show.safe);
 el('autoToggle').textContent=show.auto?'✓ Auto after games':'Auto after games';el('autoToggle').setAttribute('aria-pressed',String(!!show.auto));
 el('autoToggle').disabled=pending;
 document.querySelectorAll('#tabs button,#pause,#next,#previous').forEach(b=>b.disabled=pending||!control||!latest.match);
}
function update(data){if(closed)return;if(latest?.show?.match_id===data.show?.match_id&&data.show?.revision<latest.show.revision)return;
 latest=data;el('connection').textContent='';el('chronicle').hidden=!data.match||(stream&&!data.visible);el('empty').hidden=!!data.match||stream;
 const {show,visible,...content}=data,key=JSON.stringify(content),changed=key!==signature;
 if(data.match){if(changed){signature=key;renderReport(data);}const selected=views.indexOf(show?.view),index=Math.max(0,selected),page=show?.page||0,nextKey=`${index}:${page}`;
  if(changed||nextKey!==viewSignature){renderView(data,index,page);viewSignature=nextKey;}}
 controls();
}
async function command(action,extra={}){if(!control||pending||closed||!latest)return;pending=true;controls();el('controlError').textContent='';
 try{const r=await fetch('/api/league-stats/postgame-control',{method:'POST',headers:{'Content-Type':'application/json'},signal:abort.signal,body:JSON.stringify({action,...extra,match_id:latest.show?.match_id,revision:latest.show?.revision})});const data=await r.json();if(!r.ok)throw Error(data.error||'Control unavailable');update(data);}
 catch(e){if(e.name!=='AbortError'&&!closed)el('controlError').textContent=e.message;}
 finally{pending=false;if(!closed)controls();}
}
await loadArt();
pollVisible({url:'/api/league-stats/postgame',interval:1000,onData:data=>{if(!pending)update(data);},onError:()=>{el('connection').textContent='Connection lost';if(stream)el('chronicle').hidden=true;if(control){el('showStatus').textContent='Disconnected';el('showToggle').disabled=true;}}});
el('tabs').addEventListener('click',e=>{const target=e.target.closest('[data-view]');if(target)command('view',{view:views[Number(target.dataset.view)]});});
el('pause').addEventListener('click',()=>command(latest?.show?.playing?'pause':'play'));
el('previous').addEventListener('click',()=>command('previous'));el('next').addEventListener('click',()=>command('next'));
el('showToggle').addEventListener('click',()=>command(latest?.show?.visible?'hide':'show'));
el('autoToggle').addEventListener('click',()=>command(latest?.show?.auto?'hide':'auto'));
el('popOut').addEventListener('click',()=>window.open('/league-stats/postgame.html?control=1','_blank','noopener'));
el('allEvents').addEventListener('click',()=>{const opened=el('fullTimeline').hidden;el('fullTimeline').hidden=!opened;el('allEvents').textContent=opened?'Close details ↑':'All stats ↗';if(opened)el('fullTimeline').scrollIntoView({behavior:'smooth'});});
addEventListener('pagehide',()=>{closed=true;abort.abort();});

addEventListener('pageshow',()=>{closed=false;if(abort.signal.aborted)abort=new AbortController();});
