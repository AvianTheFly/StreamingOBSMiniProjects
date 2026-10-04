import {WorldDeck} from './world-deck.js';
const $=id=>document.getElementById(id), query=new URLSearchParams(location.search);
let loadedAt=0,fetching=false,draft={},lastState=null,renderVersion=0;
const deck=new WorldDeck([$('bg1'),$('bg2')]);
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
async function render(s){
 const version=++renderVersion;
 const available=s.available_artwork||[],art=s.artwork?.filter(name=>available.includes(name))||[];
 const index=(s.artwork_index||0)%Math.max(1,art.length);
 const name=draft.art||query.get('art')||art[index];
 if(!['message','frame'].includes(layerMode)&&name&&available.includes(name)){
  // Do not block status polling or text changes on a two-second reveal.
  deck.show(name,{style:draft.transition_style??s.transition_style,motion:draft.motion??s.motion});
 }
 if(version!==renderVersion)return;
 const info=s.artwork_catalog?.find(a=>a.file===name);
 const legacy={'fjord.png':'FJORD SANCTUARY','forest.png':'THE SPIRIT GROVE','mountain.png':'FORGE ABOVE THE CLOUDS'};
 $('location').textContent=info?.title.toUpperCase()||legacy[name]||name?.replace(/\.png$/,'').toUpperCase()||'';
 $('title').textContent=draft.title??s.title??'STREAM STARTING SOON';$('subtitle').textContent=draft.subtitle??s.subtitle??'';
 $('title').parentElement.hidden=layerMode==='artwork'||!(draft.show_message??s.show_message??true);
 const enabled=draft.highlights_enabled??s.highlights_enabled??true;
 const demo=enabled&&demoPage&&(draft.demo??true);
 $('clip-title').textContent=s.clip_title||(demo?'Selected highlight · placement preview':'');
 document.body.classList.toggle('playing',enabled&&!demoPage&&!!s.playing&&!!s.active);
 document.body.classList.toggle('demo',demo);
 $('dots').replaceChildren(...art.map((_,i)=>{const d=document.createElement('i');d.className=i===index?'active':'';return d;}));
 place(draft.clip_box||s.clip_box||[690,320,1144,643.5]);
 if(!(draft.show_footer??s.show_footer??true))document.querySelector('footer').style.display='none';
}
addEventListener('message',e=>{
 if(!demoPage||e.source!==parent||e.origin!==location.origin||!e.data?.startingSoonPreview)return;
 const v=e.data.startingSoonPreview;draft=v.reset?{}:{...draft,...v};if(lastState)render(lastState);
});
async function refresh(){
 if(fetching)return;fetching=true;
 try{const r=await fetch('/api/starting-soon',{cache:'no-store'});if(!r.ok)throw Error();lastState=await r.json();loadedAt=Date.now();await render(lastState);}
 catch{if(Date.now()-loadedAt>3000)document.body.classList.remove('playing');}
 finally{fetching=false;}
}
refresh();const poll=setInterval(refresh,750);
addEventListener('pagehide',()=>{clearInterval(poll);deck.dispose();},{once:true});

