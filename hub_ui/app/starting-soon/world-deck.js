// Two-image presentation lifetime. Latest intent cancels and replaces its reveal.
export const WORLD_TRANSITIONS={dissolve:'Cinematic dissolve',portal:'Celestial aperture',gates:'Stormglass gates',embers:'Ember sweep'};
const duration=1800;
export class WorldDeck{
 constructor(elements){this.elements=elements;this.shown='';this.current=0;this.intent=0;this.animations=[];this.disposed=false;}
 cancel(){for(const animation of this.animations)animation.cancel();this.animations=[];}
 async show(name,{style='dissolve',motion='still'}={}){
  if(this.disposed)return;
  for(const el of this.elements)el.dataset.motion=motion==='drift'?'drift':'still';
  if(this.pending===name)return;
  if(this.shown===name){
   if(this.pending){this.intent++;this.pending='';this.cancel();this.elements[1-this.current].classList.remove('visible');}
   return;
  }
  this.pending=name;
  const intent=++this.intent,url='/starting-soon/art/'+encodeURIComponent(name),img=new Image();img.src=url;
  try{await img.decode();}catch{if(intent===this.intent)this.pending='';return;}
  if(this.disposed||intent!==this.intent)return;
  this.pending='';
  this.cancel();const previous=this.elements[this.current],next=this.elements[1-this.current];
  const first=!this.shown;next.style.backgroundImage=`url("${url}")`;next.style.zIndex='1';previous.style.zIndex='0';
  next.classList.add('visible');this.shown=name;this.current=1-this.current;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(first||reduced){previous.classList.remove('visible');return;}
  const frames={
   dissolve:[{opacity:0},{opacity:1}],
   portal:[{clipPath:'circle(0% at 50% 50%)',filter:'brightness(1.35)'},{clipPath:'circle(80% at 50% 50%)',filter:'brightness(1)'}],
   gates:[{clipPath:'inset(0 50% 0 50%)',filter:'brightness(1.2)'},{clipPath:'inset(0 0% 0 0%)',filter:'brightness(1)'}],
   embers:[{clipPath:'polygon(0 0,0 0,0 100%,0 100%)',filter:'sepia(.6) brightness(1.3)'},{clipPath:'polygon(0 0,100% 0,100% 100%,0 100%)',filter:'sepia(0) brightness(1)'}]
  }[style]||[{opacity:0},{opacity:1}];
  const animation=next.animate(frames,{duration,easing:'cubic-bezier(.22,.65,.2,1)',fill:'both'});this.animations=[animation];
  try{await animation.finished;}catch{return;}
  if(this.disposed||intent!==this.intent)return;
  previous.classList.remove('visible');this.cancel();
 }
 dispose(){this.disposed=true;this.intent++;this.cancel();}
}
