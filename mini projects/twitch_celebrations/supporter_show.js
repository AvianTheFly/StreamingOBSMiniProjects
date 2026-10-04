// Dynamic supporter copy/layout and the preserved follower cameo.
import {smooth,trace,EdgeFinish} from './subtle.js';
import {celebrationWorld,celebrationArtReady} from './raid_art.js';
const TAU=Math.PI*2,clamp=x=>Math.max(0,Math.min(1,x)),lerp=(a,b,p)=>a+(b-a)*p;
export const SPIRITS={
 crab:{id:'bear',name:'STORMCLAW',color:'#85dcff',secondary:'#bbb5ff'},
 dragon:{id:'turtle',name:'VERDANT AEGIS',color:'#b9f4b0',secondary:'#67e8cc'},
 cat:{id:'ram',name:'SUNDERING GOLD',color:'#ffe0a0',secondary:'#ffb579'},
 frog:{id:'phoenix',name:'CINDER ASCENSION',color:'#ffba7a',secondary:'#ffd9a9'},
};
const files=['bear-attack','turtle','ram-charge','phoenix-hero'];
const images={};
let borderFinish;
export const artReady=Promise.all([celebrationArtReady,Promise.all(files.map(async name=>{const im=new Image();im.src='/spirit/assets/'+name+'.png';await im.decode();images[name]=im;}))]);
function stroke(c,pts,color,w=2,a=1){c.save();c.globalAlpha*=a;c.strokeStyle=color;c.lineWidth=w;c.lineCap='round';c.lineJoin='round';c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();c.restore();}
function polygon(c,pts,color,a=.15){c.save();c.globalAlpha*=a;c.fillStyle=color;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();c.restore();stroke(c,[...pts,pts[0]],color,1.5,a*2);}
function glow(c,x,y,r,color,a=.3){c.save();c.globalAlpha*=a;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color+'b0');g.addColorStop(.35,color+'40');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);c.restore();}
function ring(c,x,y,r,color,a=.5,flat=1){c.save();c.globalAlpha*=a;c.strokeStyle=color;c.lineWidth=1.7;c.beginPath();c.ellipse(x,y,r,r*flat,0,0,TAU);c.stroke();c.restore();}
function star(c,x,y,r,color,a=1){stroke(c,[[x-r,y],[x+r,y]],color,1.5,a);stroke(c,[[x,y-r],[x,y+r]],color,1.5,a);}
function pose(c,file,frame,x,y,size,angle=0,alpha=1){const im=images[file];if(!im)return;const cols=file==='turtle'?4:file==='phoenix-hero'||file==='phoenix-egg'?1:2,rows=cols===1?1:2,w=im.width/cols,h=im.height/rows;
 c.save();c.globalAlpha*=alpha;c.translate(x,y);c.rotate(angle);const gutter=file==='ram-hop'&&frame===3?w*.07:0;c.drawImage(im,frame%cols*w+gutter,Math.floor(frame/cols)*h,w-gutter,h,-size/2+size*gutter/w,-size/2,size*(1-gutter/w),size);c.restore();}
function cells(c,x,y,r,color,t){for(let i=0;i<6;i++){const a=i*TAU/6;const pts=Array.from({length:6},(_,j)=>{const q=j*TAU/6;return [x+Math.cos(a)*r*.8+Math.cos(q)*r*.45,y+Math.sin(a)*r*.8+Math.sin(q)*r*.45];});polygon(c,pts,color,.07+Math.sin(t*2+i)*.025);}}
function hash(value){return Array.from(String(value).toLowerCase()).reduce((n,ch)=>Math.imul(n^ch.charCodeAt(0),16777619)>>>0,2166136261);}
// Event-authored wording, selected from the event ID so every overlay agrees.
// The live name has its own DOM line; no username is baked into artwork.
const WORDS={
 bear:{
  new:[['THE BEAR SAVED YOU A SPOT','Thunder outside. Front-row seat inside. Welcome to the den.'],['FRESH PAWPRINT. BIG BEAR ENERGY.','Come for the stream. Stay for the questionable den decisions.'],['DEN MEMBERSHIP: PAW-APPROVED','The bear checked your credentials. Excellent snack-sharing potential.']],
  returning:[['YOUR PAWPRINT NEVER LEFT','Same den. More chaos. Really glad you came back.'],['THE DEN KNOWS THAT NAME','The bear heard you coming and saved your favorite spot.'],['BACK FOR ANOTHER STORM','Some people bring an umbrella. You bring the thunder.']],
  gift:[['BEAR HUGS FOR THE WHOLE CREW','{count} new {seats} in the den. That is one very big bear hug.'],['YOU JUST MADE THE DEN BIGGER','{count} gifted {subs}. The bear is making room on the couch.'],['THUNDER SHARED IS THUNDER DOUBLED','{count} gifted {subs}, and a whole crew under one roof.']],
  anniversary:['THE DEN REMEMBERS EVERY STORM','{months} months of pawprints. This place would not feel the same without you.']
 },
 turtle:{
  new:[['SHELL YEAH. YOU ARE IN.','The turtle grew a little leaf just for your arrival.'],['A NEW NAME IN THE GROVE','Your seat is shaded. Your snacks are guarded by a tiny turtle.'],['THE GROVE HAS ROOM FOR YOU','Settle in. Even our chaos comes with a protective shell.']],
  returning:[['YOUR LEAF IS STILL HERE','The grove kept growing. Your little corner stayed yours.'],['THE TURTLE REMEMBERED YOU','No need to knock. Your name is already on the shell.'],['BACK UNDER OUR FAVORITE SHELL','One more season of this wonderfully strange little grove.']],
  gift:[['LOOK AT ALL THOSE NEW LEAVES','{count} gifted {subs}. You just grew the grove a little wider.'],['A LITTLE SHELTER FOR THE WHOLE CREW','{count} new {seats} beneath the shell. The turtle approves.'],['YOU PLANTED SOMETHING GOOD','{count} gifted {subs}. Tiny leaves, very big kindness.']],
  anniversary:['LOOK HOW FAR YOUR LEAF HAS GROWN','{months} months in the grove. The turtle has kept every ring.']
 },
 ram:{
  new:[['HORNS UP. YOU ARE WITH US.','The ram stamped your name in gold. Subtle? Absolutely never.'],['THE GOLDEN GATE JUST OPENED','Walk in like you own the place. The ram already does.'],['ONE GOOD HOP. YOU ARE IN.','A little gold, a little mischief, and a place in this crew.']],
  returning:[['THAT NAME STILL SHINES','The ram polished your spot. Then headbutted the welcome sign.'],['BACK THROUGH THE GOLDEN GATE','Your usual entrance? A hop, a horn salute, and mild property damage.'],['THE RAM HEARD A FAMILIAR STEP','Still golden. Still with us. Still terrible at quiet entrances.']],
  gift:[['GOLD FOR THE WHOLE CREW','{count} gifted {subs}. The ram is handing out tiny gold crowns.'],['YOU BLEW THE GOLDEN GATE OPEN','{count} new {seats}. Nobody tell the ram doors have handles.'],['THAT IS A GENEROUS AMOUNT OF GOLD','{count} gifted {subs}. Even the ram stopped showing off to applaud.']],
  anniversary:['YOUR NAME IS PART OF THE GOLD','{months} months with the crew. The ram made the engraving permanent.']
 },
 phoenix:{
  new:[['ONE MORE SPARK IN THE FLOCK','Your first feather is glowing. We saved you a place by the fire.'],['A LITTLE EMBER. A NEW BEGINNING.','The phoenix lit the welcome trail. Follow the warm little sparks.'],['THE FLOCK JUST GOT BRIGHTER','Come warm your wings. There is room for your kind of weird here.']],
  returning:[['THAT SPARK LOOKS FAMILIAR','Your ember never went out. Good to see those wings again.'],['BACK WHERE YOUR FEATHERS BELONG','The phoenix kept a little fire burning for your return.'],['THE FLOCK KNOWS THAT GLOW','Another flight together. Same wonderfully chaotic flock.']],
  gift:[['YOU SHARED THE SPARK','{count} gifted {subs}. Watch all those little embers find their wings.'],['A WHOLE FLOCK OF NEW BEGINNINGS','{count} new {seats} by the fire. You made this place warmer.'],['LOOK WHAT YOUR KINDNESS LIT','{count} gifted {subs}, each with a tiny feather of their own.']],
  anniversary:['YOUR EMBER HAS A HISTORY HERE','{months} months of shared flights. The flock remembers every one.']
 }
};
export function copyFor(item){
 const spirit=SPIRITS[item.theme]||SPIRITS.crab,d=item.details||{},words=WORDS[spirit.id];
 if(item.kind==='follow')return {kicker:'A NEW FRIEND APPEARED',message:'',detail:'Glad you found us.'};
 const kind=item.kind==='gift'?'gift':d.renewal||d.months>1?'returning':'new',variants=words[kind];
 const anniversary=kind==='returning'&&Number.isInteger(d.months)&&d.months>=12&&d.months%12===0;
 const [kicker,message]=anniversary?words.anniversary:variants[hash(`${item.id||item.name}|${item.kind}|${d.months||0}`)%variants.length];
 const count=Number(item.count)||1,fill=text=>text.replace(/\{(count|months|seats|subs)\}/g,(_,key)=>({count:count.toLocaleString(),months:d.months,seats:count===1?'seat':'seats',subs:count===1?'sub':'subs'}[key]));
 return {kicker,message:d.message||fill(message),detail:detailFor(item)};
}
export function detailFor(item){const d=item.details||{},tier={'1000':'TIER I','2000':'TIER II','3000':'TIER III'}[d.tier];const facts=[];if(item.kind==='gift')facts.push(`${Number(item.count).toLocaleString()} GIFTED ${item.count===1?'SUB':'SUBS'}`);else if(d.months)facts.push(`${d.months} ${d.months===1?'MONTH':'MONTHS'} TOGETHER`);else facts.push(d.renewal?'RETURNING SUB':'NEW SUB');if(tier)facts.push(tier);return facts.join('  ·  ');}
export class SupporterShow{
 constructor(stage){this.stage=stage;this.ready=celebrationArtReady;this.reduced=matchMedia('(prefers-reduced-motion:reduce)');}
 start(item,settings){
  document.getElementById('cast').replaceChildren();
  this.item=item;this.spirit=SPIRITS[item.theme]||SPIRITS.crab;this.seed=hash(item.name);this.follow=item.kind==='follow';this.custom=!!settings.custom?.[item.theme]?.visual;
  if(!this.follow){this.edgeCanvas??=document.createElement('canvas');this.edgeCanvas.width=1920;this.edgeCanvas.height=1080;this.edgeContext=this.edgeCanvas.getContext('2d');borderFinish??=new EdgeFinish();}
  this.stage.classList.add('supporter',this.follow?'follower':'subscriber');this.stage.dataset.spirit=this.spirit.id;
  this.stage.style.setProperty('--spirit',this.spirit.color);this.stage.style.setProperty('--spirit-second',this.spirit.secondary);
  const layer=document.createElement('div');layer.id='supporterLayer';this.layer=layer;
  const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;canvas.id='supporterCanvas';this.canvas=canvas;this.c=canvas.getContext('2d');layer.append(canvas);
  const panel=document.createElement('section');panel.id='supporterPanel';
  const copy=copyFor(item);
  for(const [tag,id,text] of [['small','supporterKicker',copy.kicker],['strong','supporterName',item.name],['span','supporterDetail',copy.detail],['span','supporterMessage',copy.message]]){const node=document.createElement(tag);node.id=id;node.textContent=text;panel.append(node);}layer.append(panel);this.stage.append(layer);this.panel=panel;
  const nameNode=panel.querySelector('#supporterName');
  if(this.follow){if(nameNode.scrollWidth>nameNode.clientWidth){nameNode.style.fontSize=Math.max(12,parseFloat(getComputedStyle(nameNode).fontSize)*nameNode.clientWidth/nameNode.scrollWidth*.98)+'px';if(nameNode.scrollWidth>nameNode.clientWidth){nameNode.style.whiteSpace='normal';nameNode.style.overflowWrap='anywhere';}}}
  else{
   this.fitName();this.resizeObserver?.disconnect();this.resizeObserver=new ResizeObserver(()=>{if(this.layer===layer)this.fitName();});this.resizeObserver.observe(this.stage);
   document.fonts.ready.then(()=>{if(this.layer===layer)this.fitName();});
  }
  if(this.custom){const name=settings.custom[item.theme].visual;const media=document.createElement(/\.(mp4|webm)$/i.test(name)?'video':'img');media.id='supporterCustom';media.src='/media/'+encodeURIComponent(name);if(media.tagName==='VIDEO'){media.muted=true;media.autoplay=true;media.playsInline=true;media.currentTime=item.elapsed||0;}media.onerror=()=>{media.remove();this.custom=false;};document.getElementById('cast').append(media);}
 }
 fitName(){
  const node=this.panel.querySelector('#supporterName');node.style.removeProperty('font-size');node.style.removeProperty('white-space');node.style.removeProperty('overflow-wrap');node.classList.remove('wrapped-name');
  let size=parseFloat(getComputedStyle(node).fontSize),floor=Math.max(8,size*.5);
  while(node.scrollWidth>node.clientWidth&&size>floor){size=Math.max(floor,size-1);node.style.fontSize=size+'px';}
  if(node.scrollWidth>node.clientWidth){node.classList.add('wrapped-name');node.style.whiteSpace='normal';node.style.overflowWrap='anywhere';}
 }
 update(elapsed){
  const duration=this.item.duration||3.8,t=this.reduced.matches?(this.follow?1:1.7):elapsed;
  this.stage.dataset.supportPhase=elapsed<.55?'arrival':elapsed<1.3?'impact':elapsed<duration-.55?'honor':'exit';
  if(!this.follow){const reveal=this.reduced.matches?1:smooth((elapsed-.42)/.48);this.panel.querySelector('#supporterName').style.clipPath=`inset(0 ${(1-reveal)*100}% 0 0)`;const message=this.panel.querySelector('#supporterMessage');message.style.opacity=this.reduced.matches?1:smooth((elapsed-.68)/.35);}
  const c=this.c;c.clearRect(0,0,1920,1080);if(elapsed>=duration||elapsed<0)return;
  c.save();c.globalAlpha=smooth(elapsed/.18)*smooth((duration-elapsed)/.55);c.lineCap='round';c.lineJoin='round';
  if(this.follow)this.followArt(c,t);else{
   const edge=this.edgeContext;edge.clearRect(0,0,1920,1080);this.borderArt(edge,t);borderFinish.apply(edge,10);c.drawImage(this.edgeCanvas,0,0);
   
  }
  c.restore();
 }
 borderArt(c,t){celebrationWorld(c,this.spirit.id,t,this.item.duration||3.8,this.item.kind==='gift'?'gift':'supporter',this.seed);}
 followArt(c,t){
  const p=smooth(t/.35),x=135+Math.sin(Math.min(t,1)*Math.PI)*12,y=825;glow(c,x,y,90,this.spirit.color,.22);
  if(!this.custom){const file={bear:'bear-attack',turtle:'turtle',ram:'ram-charge',phoenix:'phoenix-hero'}[this.spirit.id];pose(c,file,this.spirit.id==='turtle'?2:0,x,lerp(860,y,p),145,Math.sin(t*3)*.025);}
  if(this.spirit.id==='bear'){for(let j=0;j<3;j++)stroke(c,[[220+j*9,880],[260+j*12,850]],this.spirit.color,1.5,.55);}
  else if(this.spirit.id==='turtle'){cells(c,245,845,24,this.spirit.color,t);}
  else if(this.spirit.id==='ram'){for(let j=0;j<3;j++)polygon(c,[[230+j*14,875],[240+j*14,860],[250+j*14,881]],this.spirit.color,.22);}
  else{stroke(c,[[210,885],[242,852],[264,866],[286,842]],this.spirit.color,1.5,.6);}
  if(!this.reduced.matches)trace(c,u=>[220+u*490,894+Math.sin(u*Math.PI)*10],t,{color:this.spirit.color,speed:.35,tail:.2,width:1.5});
  for(let j=0;j<5;j++)star(c,210+j*24,778+Math.sin(t*2+j)*8,2,this.spirit.secondary,.45);
 }
 stop(){this.resizeObserver?.disconnect();this.c?.clearRect(0,0,1920,1080);this.layer?.remove();this.layer=null;this.stage.classList.remove('supporter','follower','subscriber');delete this.stage.dataset.spirit;delete this.stage.dataset.supportPhase;this.item=null;}
}
