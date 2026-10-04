import {ClipTransition} from './clip-transition.js';
const params=new URLSearchParams(location.search),root=document.getElementById('stage'),$=id=>document.getElementById(id);
const preview=params.has('preview'),art=params.get('render')==='art',motionLayer=params.get('layer')==='motion';
document.body.classList.toggle('motion',motionLayer);document.body.classList.toggle('art',art);document.body.classList.toggle('preview',preview);
let previousRevision,timer,snapshot,previewTimer;
const time=ms=>{const s=Math.max(0,Math.floor(ms/1000));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
const transition=new ClipTransition($('handoff'),(revision,event)=>{
  if(preview){if(event==='revealed')render({...snapshot,phase:'playing'});return;}
  if(art||!motionLayer)return;
  fetch('/api/projects/instant_replay/stage-cue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event,revision})})
    .then(r=>r.ok?r.json():null).then(r=>{$('handoff').dataset.acknowledged=String(!!r?.accepted);}).catch(()=>{});
});
function fit(){root.style.transform=`scale(${Math.min(innerWidth/1920,innerHeight/1080)})`;}
window.addEventListener('resize',fit);fit();
function render(s){
  snapshot=s;
  const view=s.view||(s.companion?'live':'off'),live=view!=='off',camera=s.camera===true,side=live||camera;
  const layout=s.layout||{media:side?[56,182,1376,774]:[184,144,1552,873],footer:side?[56,985,1376,66]:[184,1029,1552,36],camera:[1480,live?466:182,384,216],next_y:live&&camera?754:466};
  ['x','y','w','h'].forEach((key,i)=>root.style.setProperty(`--${key}`,`${layout.media[i]}px`));
  ['fx','fy','fw'].forEach((key,i)=>root.style.setProperty(`--${key}`,`${layout.footer[i]}px`));
  ['cx','cy','cw','ch'].forEach((key,i)=>root.style.setProperty(`--${key}`,`${(layout.camera||[1480,live?466:182,384,216])[i]}px`));
  root.style.setProperty('--next-y',`${layout.next_y||466}px`);
  for(const [name,on] of Object.entries({'side':side,'live-view':live,'camera':camera,'live-offline':s.live_online===false,'camera-offline':s.camera_online===false,'still':s.motion===false,'handoff-active':!!s.handoff}))document.body.classList.toggle(name,on);
  document.body.dataset.kind=s.kind||'clip';document.body.dataset.phase=art?'playing':s.phase||'idle';
  $('heading').textContent=s.mode==='replay'||!s.mode&&s.kind==='replay'?'REPLAY':s.kind==='highlights'?'HIGHLIGHTS':'CLIPS';
  $('liveStatus').textContent=view==='desktop'&&s.desktop_visible===false?'Screen hidden':'No live signal';
  $('clipTitle').textContent=s.title||'';$('clipContext').textContent=s.context||'';
  const total=Number(s.total);
  const count=s.total==='∞'?`CLIP ${s.index} · SHUFFLE`:Number.isFinite(total)&&total>1?`CLIP ${s.index} / ${total}`:'';
  $('chapter').textContent=count;$('nextTitle').textContent=s.next_title||'';$('sideSession').hidden=!s.next_title;
  $('sequence').replaceChildren();
  if(Number.isFinite(total)&&total>1)for(let i=0;i<Math.min(total,24);i++){const e=document.createElement('i');e.className=i+1<s.index?'done':i+1===s.index?'current':'';$('sequence').append(e);}
  $('phaseLabel').textContent=s.phase==='returning'?'Returning':'Loading';$('phaseTitle').textContent=s.phase==='returning'?'':s.title||'';
  $('handoffTitle').textContent=s.title||'';$('handoffIndex').textContent=count;
  const cursor=Number(s.cursor_ms)||0,duration=Number(s.duration_ms)||0;
  $('progress').style.width=`${duration>0?Math.min(100,cursor/duration*100):0}%`;
  $('timecode').textContent=duration>0?`${s.paused?'PAUSED  ':''}${time(cursor)} / ${time(duration)}`:s.paused?'PAUSED':'';
  if(previousRevision!==s.revision&&s.phase==='playing'){document.body.classList.remove('reveal');void root.offsetWidth;document.body.classList.add('reveal');previousRevision=s.revision;}
  if(!art)transition.update(s);
  root.dataset.ready='true';
}
if(preview){
  const replay=params.get('preview')==='replay';
  render({active:true,kind:replay?'replay':'highlights',mode:replay?'replay':'showcase',view:params.get('view')||(replay?'live':'off'),camera:params.get('camera')!=='off',camera_online:true,live_online:true,phase:'playing',title:'Baron steal',context:'Game 1061 · Sep 18',index:1,total:replay?1:3,cursor_ms:12000,duration_ms:38000,next_title:replay?'':'Teamfight · 22:37',clip_transition:replay?'sweep':'iris',revision:1});
  window.addEventListener('message',e=>{
    if(e.origin!==location.origin||e.source!==parent)return;
    if(e.data?.type==='replay-layout')render({...snapshot,...e.data.state,layout:undefined});
    if(e.data?.type==='replay-transition-preview'){
      clearTimeout(previewTimer);
      render({...snapshot,revision:snapshot.revision+1,handoff:true,phase:'covering',clip_transition:e.data.style||snapshot.clip_transition,index:2,total:3,title:'Teamfight · 22:37',cursor_ms:0});
      previewTimer=setTimeout(()=>render({...snapshot,phase:'revealing',next_title:''}),1000);
    }
  });
}else{
  async function refresh(){
    try{const r=await fetch('/api/projects/instant_replay/stage',{cache:'no-store'});if(r.ok)render(await r.json());}catch{}
    timer=setTimeout(refresh,['covering','revealing','loading'].includes(snapshot?.phase)?100:snapshot?.active?300:1500);
  }
  refresh();
}
window.addEventListener('pagehide',()=>{clearTimeout(timer);clearTimeout(previewTimer);transition.reset();},{once:true});
