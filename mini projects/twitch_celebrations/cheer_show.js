import {smooth,trace,EdgeFinish} from './subtle.js';
import {celebrationWorld,celebrationArtReady} from './raid_art.js';
// Four small, original Bit celebrations. The count and name stay in the top
// strip; all scenic art is native and masked away from the gameplay opening.
const TAU=Math.PI*2;
const WORLDS={crab:['#ffc496','#97e3e5','A LITTLE PEARL OF GENEROSITY'],dragon:['#c2a6ff','#f7d59b','YOU PUT THE MAGIC IN THIS PLACE'],cat:['#8ee5ed','#ffb9de','YOUR SPARKS FOUND THEIR CONSTELLATION'],frog:['#c1e693','#f5b9d5','THAT IS A VERY HAPPY SPLASH']};
export class CheerShow{
 constructor(stage){this.stage=stage;this.ready=celebrationArtReady;this.finish=new EdgeFinish();this.reduced=matchMedia('(prefers-reduced-motion:reduce)');}
 start(item,settings){
  this.stop();this.item=item;this.theme=WORLDS[item.theme]?item.theme:'crab';this.colors=WORLDS[this.theme];this.stage.classList.add('cheer');this.stage.dataset.cheerWorld=this.theme;
  this.layer=document.createElement('div');this.layer.id='cheerLayer';this.canvas=document.createElement('canvas');this.canvas.width=1920;this.canvas.height=1080;this.canvas.id='cheerCanvas';this.layer.append(this.canvas);this.stage.prepend(this.layer);this.c=this.canvas.getContext('2d');
  const count=Number(item.count).toLocaleString(),details={crab:`${count} Bits, tucked into the stream’s treasure chest.`,dragon:`${count} Bits. The little alchemy engine runs on your kindness.`,cat:`${count} Bits. One brighter corner of the universe.`,frog:`${count} Bits. Even the lily pads are doing a happy wiggle.`};
  this.stage.querySelector('#kicker').textContent=this.colors[2];this.stage.querySelector('#detail').textContent=details[this.theme];
  const custom=settings.custom?.[this.theme]?.visual;
  if(custom){this.media=document.createElement(/\.(mp4|webm)$/i.test(custom)?'video':'img');this.media.id='cheerCustom';this.media.src='/media/'+encodeURIComponent(custom);if(this.media.tagName==='VIDEO'){this.media.muted=true;this.media.autoplay=true;this.media.loop=true;this.media.playsInline=true;}this.layer.append(this.media);}
  this.previousFont=this.stage.querySelector('#name').style.fontSize;this.fit();document.fonts?.ready.then(()=>{if(this.item===item)this.fit();});
 }
 fit(){const name=this.stage.querySelector('#name');name.style.fontSize='';const base=parseFloat(getComputedStyle(name).fontSize);let size=base;while(name.scrollWidth>name.clientWidth&&size>5){size-=1;name.style.fontSize=size+'px';}}
 update(elapsed){
  if(!this.item)return;const c=this.c;c.clearRect(0,0,1920,1080);if(elapsed<0||elapsed>=this.item.duration)return;
  const t=this.reduced.matches?3.8:elapsed,p=t/this.item.duration,[a,b]=this.colors;
  c.save();c.lineCap='round';c.lineJoin='round';c.globalAlpha=smooth(elapsed/.65)*smooth((this.item.duration-elapsed)/.75);celebrationWorld(c,this.theme,t,this.item.duration,'cheer');c.restore();this.finish.apply(c,10);
 }
 stop(){if(this.media?.tagName==='VIDEO'){this.media.pause();this.media.removeAttribute('src');this.media.load();}if(this.item)this.stage.querySelector('#name').style.fontSize=this.previousFont||'';this.media=null;this.layer?.remove();this.layer=null;this.item=null;this.stage.classList.remove('cheer');delete this.stage.dataset.cheerWorld;}
}
