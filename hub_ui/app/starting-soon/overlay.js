import {WorldDeck} from './world-deck.js';
const $=id=>document.getElementById(id), query=new URLSearchParams(location.search);
let loadedAt=0,fetching=false,draft={},lastState=null,viewSignature='',disposed=false,request=null,sourceVisible=true;
const deck=new WorldDeck([$('bg1'),$('bg2')]);
function visibility(){deck.setVisible(sourceVisible&&!document.hidden);}
addEventListener('obsSourceVisibleChanged',e=>{sourceVisible=e.detail?.visible!==false;visibility();});
document.addEventListener('visibilitychange',visibility);visibility();
const demoPage=query.has('demo');
const layerMode=['artwork','message','frame'].includes(query.get('layer'))?query.get('layer'):'full';
document.documentElement.dataset.layer=layerMode;
function resize(){$('stage').style.transform=`scale(${Math.min(innerWidth/1920,innerHeight/1080)})`;}
resize();addEventListener('resize',resize);
function fitHeading(limit=262){
 const heading=$('title'),header=heading.parentElement;
 let size=Number(header.dataset.font)||69;heading.style.fontSize=size+'px';
 while(header.offsetTop+header.offsetHeight>limit&&size>16){size-=2;heading.style.fontSize=size+'px';}
}
function place(box){
 if(!Array.isArray(box)||box.length!==4||box.some(v=>!Number.isFinite(v)))box=[690,320,1144,643.5];
 const [x,y,w,h]=box,frame=$('clip-frame'),header=$('title').parentElement;
 frame.style.left=(x-10)+'px';frame.style.top=(y-41)+'px';frame.style.width=(w+20)+'px';
 document.querySelector('.opening').style.height=(h+20)+'px';
 const corner=w<950;header.style.left=(corner?690:x)+'px';header.style.right='auto';header.style.width=(corner?1144:w)+'px';
 header.style.top=(y<280?20:71)+'px';header.dataset.font=y<280?'52':'69';
 header.classList.toggle('compact',y<280);document.querySelector('footer').style.left=(corner?690:x)+'px';
 document.querySelector('footer').style.right=(1920-(corner?1834:x+w))+'px';
 document.querySelector('footer').style.display=y+h>990?'none':'flex';
 fitHeading(corner?262:y-55);
}
function render(s){
 if(disposed)return;
 const available=s.available_artwork||[],art=s.artwork?.filter(name=>available.includes(name))||[];
 const index=(s.artwork_index||0)%Math.max(1,art.length);
 const name=draft.art||query.get('art')||art[index];
 if(!['message','frame'].includes(layerMode)&&name&&available.includes(name)){
  // Do not block status polling or text changes on a two-second reveal.
  deck.show(name,{style:draft.transition_style??s.transition_style,motion:draft.motion??s.motion});
 }
 const info=s.artwork_catalog?.find(a=>a.file===name);
 const legacy={'fjord.png':'FJORD SANCTUARY','forest.png':'THE SPIRIT GROVE','mountain.png':'FORGE ABOVE THE CLOUDS'};
 const enabled=draft.highlights_enabled??s.highlights_enabled??true;
 const demo=enabled&&demoPage&&(draft.demo??true);
 const view={location:info?.title.toUpperCase()||legacy[name]||name?.replace(/\.png$/,'').toUpperCase()||'',
  title:draft.title??s.title??'STREAM STARTING SOON',subtitle:draft.subtitle??s.subtitle??'',
  message:layerMode!=='artwork'&&(draft.show_message??s.show_message??true),
  clip:s.clip_title||(demo?'Selected highlight · placement preview':''),demo,
  playing:enabled&&!demoPage&&!!s.playing&&!!s.active,art,index,
  box:draft.clip_box||s.clip_box||[690,320,1144,643.5],footer:draft.show_footer??s.show_footer??true};
 const signature=JSON.stringify(view);
 if(signature===viewSignature)return;
 viewSignature=signature;
 $('location').textContent=view.location;$('title').textContent=view.title;$('subtitle').textContent=view.subtitle;
 $('title').parentElement.hidden=!view.message;$('clip-title').textContent=view.clip;
 document.body.classList.toggle('playing',view.playing);document.body.classList.toggle('demo',demo);
 $('dots').replaceChildren(...art.map((_,i)=>{const d=document.createElement('i');d.className=i===index?'active':'';return d;}));
 place(view.box);
 if(!view.footer)document.querySelector('footer').style.display='none';
}
addEventListener('message',e=>{
 if(!demoPage||e.source!==parent||e.origin!==location.origin||!e.data?.startingSoonPreview)return;
 const v=e.data.startingSoonPreview;draft=v.reset?{}:{...draft,...v};if(lastState)render(lastState);
});
async function refresh(){
 if(fetching||disposed)return;fetching=true;
 const controller=new AbortController();request=controller;
 const timeout=setTimeout(()=>controller.abort(),3000);
 try{const r=await fetch('/api/starting-soon',{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error();const state=await r.json();if(disposed)return;lastState=state;loadedAt=Date.now();render(lastState);}
 catch{if(!disposed&&Date.now()-loadedAt>3000){document.body.classList.remove('playing');viewSignature='';}}
 finally{clearTimeout(timeout);if(request===controller)request=null;fetching=false;}
}
refresh();const poll=setInterval(refresh,750);
addEventListener('pagehide',()=>{disposed=true;clearInterval(poll);request?.abort();deck.dispose();},{once:true});

