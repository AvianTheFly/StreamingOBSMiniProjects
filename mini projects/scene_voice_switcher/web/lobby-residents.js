// Decoded painted cast and continuous room business, owned by one presentation.
import {smooth,ellipse,TAU} from './shared/world-motion.js';
import {tag,ring} from './chaos-ink.js';
const habitats={
 arcade:[[433,839,136],[832,842,105],[1660,842,100]],
 tavern:[[571,992,135],[1450,988,120],[1080,1057,98]],
 forge:[[427,858,131],[1476,854,116],[712,859,107]],
 future:[[508,834,124],[1360,772,130],[1795,1034,104]],
 'sky-harbor':[[404,976,145],[1236,298,120],[1455,1007,114]]
};
const colors={arcade:['#f396d7','#8ff3e0'],tavern:['#ffcb75','#b8e9b1'],forge:['#ffb264','#88e5f0'],future:['#8deef0','#cb9fee'],'sky-harbor':['#ffcc8b','#a2e1dd']};
export class LobbyResidents{
 constructor(id){this.id=id;this.sprites=[];this.bounds=[];this.disposed=false;}
 async load(){
  const image=new Image();image.src=new URL(`./art/${this.id}-cast-v1.png`,import.meta.url).href;await image.decode();
  if(this.disposed)return;
  // Isolate connected silhouettes once, including tails that extend past a third.
  // These render caches leave the source sheet intact and preserve its alpha.
  const scratch=document.createElement('canvas');scratch.width=image.width;scratch.height=image.height;
  const c=scratch.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);const pixels=c.getImageData(0,0,image.width,image.height).data;
  const w=image.width,h=image.height,labels=new Uint32Array(w*h),queue=new Uint32Array(w*h),parts=[];let serial=0;
  for(let start=0;start<w*h;start++){
   if(labels[start]||pixels[start*4+3]<8)continue;
   const id=++serial;let head=0,tail=1,x0=w,y0=h,x1=0,y1=0;queue[0]=start;labels[start]=id;
   while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
    for(const n of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(n>=0&&!labels[n]&&pixels[n*4+3]>=8){labels[n]=id;queue[tail++]=n;}}
   if(tail>1000)parts.push({id,count:tail,rect:[x0,y0,x1-x0+1,y1-y0+1]});
  }
  const subjects=parts.sort((a,b)=>b.count-a.count).slice(0,3).sort((a,b)=>a.rect[0]-b.rect[0]);
  if(subjects.length!==3)throw new Error('The painted cast needs three separate silhouettes');
  for(const part of subjects){const [x0,y0,sw,sh]=part.rect,sprite=document.createElement('canvas');sprite.width=sw;sprite.height=sh;const sc=sprite.getContext('2d'),data=sc.createImageData(sw,sh);
   for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const source=(y+y0)*w+x+x0;if(labels[source]===part.id){const dest=(y*sw+x)*4;for(let channel=0;channel<4;channel++)data.data[dest+channel]=pixels[source*4+channel];}}
   sc.putImageData(data,0,0);this.sprites.push(sprite);this.bounds.push(part.rect);
  }
  scratch.width=scratch.height=1;
 }
 sprite(c,slot,x,y,h,tilt=0,flip=false,alpha=1,breath=1){
  if(!this.sprites[slot]||this.disposed)return;const sprite=this.sprites[slot],w=h*sprite.width/sprite.height;
  c.save();c.globalAlpha*=alpha;c.translate(x,y);c.rotate(tilt);c.scale(flip?-1:1,breath);c.drawImage(sprite,-w/2,-h,w,h);c.restore();
 }
 draw(c,t,events){
  const busy=events.reduce((sum,e)=>sum+(e.impact||.5),0),alpha=.96-Math.min(.3,busy*.065),[warm,cool]=colors[this.id];
  habitats[this.id].forEach(([home,y,h],slot)=>{
   // A resident leaves its perch while taking part in a finite performance.
   const away=events.filter(e=>e.residentSlots?.includes(slot)).reduce((n,e)=>Math.max(n,smooth((t-e.started)/.6)*smooth((e.started+e.life-t)/.75)),0);
   const presence=alpha*(1-away);if(presence<.005)return;
   const a=t*(.42+slot*.06)+slot*2.1,x=home+Math.sin(a*.55)*(slot===1?30:18),flying=slot===1&&(this.id==='future'||this.id==='sky-harbor');
   const hop=flying?Math.sin(a*1.2)*12:Math.abs(Math.sin(a*1.8))*4;
   if(!flying){c.save();c.globalAlpha*=presence;ellipse(c,x,y+3,h*.24,4,'#08121b55');c.restore();}
   this.sprite(c,slot,x,y-hop,h,Math.sin(a*1.8)*.035,false,presence,1+Math.sin(a*1.3)*.018);
   // Little recurring actions are offset from the larger automatic entrances.
   const phase=(t+slot*11)%37;
   if(phase>25&&phase<31){const fade=smooth((phase-25)/.6)*smooth((31-phase)/.8);c.save();c.globalAlpha*=fade*presence;
    if(slot===0){for(let i=0;i<3;i++)ellipse(c,x-18+i*18,y-h-15-Math.sin(phase*3+i)*4,3,3,warm);}
    if(slot===1)ring(c,x,y+4,phase,cool);
    if(slot===2)tag(c,x,y-h-12,this.id==='future'?'zzz':this.id==='forge'?'BONK?':'GG',warm,.7);
    c.restore();}
  });
  this.setting(c,t);
 }
 setting(c,t){
  const [warm,cool]=colors[this.id];c.save();
  if(this.id==='arcade'){
   // Marquee bulbs chase around the physical header; tokens bounce on the counter.
   for(let i=0;i<19;i++){c.globalAlpha=.2+.7*Math.max(0,Math.sin(t*3-i*.55));ellipse(c,309+i*30,141,3.5,3.5,i%2?warm:cool);}
   c.globalAlpha=.8;for(let i=0;i<3;i++)ellipse(c,667+i*31,823-Math.abs(Math.sin(t*2+i))*12,5+3*Math.abs(Math.cos(t*3+i)),9,'#e9bf71');
  }else if(this.id==='tavern'){
   // Potion bubbles climb out of the painted bottle, and a little wick dances.
   for(let i=0;i<7;i++){const q=(t*.23+i/7)%1;c.globalAlpha=(1-q)*.5;c.strokeStyle='#e795a4';c.lineWidth=1.5;c.beginPath();c.arc(645+Math.sin(t+i)*10,865-q*100,3+q*5,0,TAU);c.stroke();}
   c.globalAlpha=.6;for(let i=0;i<3;i++)ellipse(c,1325+i*22,1014-Math.abs(Math.sin(t*1.4+i))*6,7,3,warm);
  }else if(this.id==='forge'){
   for(let i=0;i<17;i++){const q=(t*.18+i/17)%1;c.globalAlpha=(1-q)*.7;ellipse(c,1770+Math.sin(i*7)*q*85,827-q*155,2,2,warm);}
   c.globalAlpha=.4;c.strokeStyle=cool;c.lineWidth=2;c.beginPath();for(let i=0;i<50;i++){const x=250+i*3,y=756+Math.sin(t*5+i*.8)*3;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();
  }else if(this.id==='future'){
   // A little spacecraft traffic queue crawls across the upper window.
   for(let i=0;i<6;i++){const x=1040+((t*13+i*44)%360),y=305+Math.sin(t*.8+i)*7;c.globalAlpha=.65;ellipse(c,x,y,10,3,i%2?cool:warm);ellipse(c,x+3,y-3,4,3,'#b6eeed');}
   c.globalAlpha=.38;c.strokeStyle=cool;c.lineWidth=2;c.beginPath();c.ellipse(1020,958,96+Math.sin(t)*12,12,0,0,TAU);c.stroke();
  }else{
   // Wind ribbons and tiny distant couriers live entirely above the host.
   c.globalAlpha=.35;c.strokeStyle='#fff1cd';c.lineWidth=1.6;
   for(let i=0;i<4;i++){const x=851+((t*31+i*137)%555),y=320+i*15;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+18,y-7,x+31,y+7,x+49,y);c.stroke();}
   c.globalAlpha=.65;for(let i=0;i<3;i++){const x=622+i*22,y=1005+Math.sin(t*2+i)*4;ellipse(c,x,y,5,3,warm);}
  }
  c.restore();
 }
 dispose(){this.disposed=true;for(const sprite of this.sprites)sprite.width=sprite.height=1;this.sprites=[];this.bounds=[];}
}
