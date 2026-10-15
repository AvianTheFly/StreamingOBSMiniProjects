import {clamp,smooth,path,light,scenes} from './scene-map.js';
import {ring,feather,lightning,TAU} from './vfx-ink.js';
const phase=(a,start,end)=>smooth((a-start)/(end-start));
function star(c,x,y,r,color){const pts=[];for(let i=0;i<=10;i++){const a=i*Math.PI/5-Math.PI/2,k=i%2?r*.43:r;pts.push([x+Math.cos(a)*k,y+Math.sin(a)*k]);}path(c,pts,color,1.3,.9);}
function cup(c,x,y,color){c.fillStyle='#725137';c.globalAlpha=.95;c.fillRect(x-6,y-10,12,10);path(c,[[x-5,y-10],[x+6,y-10],[x+10,y-8],[x+10,y-3],[x+6,y-3]],color,1.6,.9);}
function shadow(c,x,y,h){c.save();c.globalAlpha=.27;c.fillStyle='#06121a';c.beginPath();c.ellipse(x,y,h*.3,3,0,0,TAU);c.fill();c.restore();}

// A small physical gag: approach, attempt, consequence, recovery. No captions.
// Coordinates are local to a checked scenic pocket; feet use its painted surface.
export function paintVisitor(c,t,theme,spot,assets){
 const a=spot.age*.75,v=spot.variation,h=spot.h,color=scenes[theme].colors[spot.x>960?1:0];
 const alpha=smooth(spot.age/.9)*(1-smooth((spot.age-14.8)/1.2));
 const enter=phase(a,0,1.8),leave=phase(a,10.4,12),walk=-30*(1-enter)+leave*32;
 const draw=(pose,x=0,y=0,options={})=>assets.sprite(c,pose,x,y,h,{alpha,...options,name:spot.name});
 c.save();c.translate(spot.x,spot.y);shadow(c,walk,0,h);
 if(spot.name==='kirby'){
  // Kirby inhales a local treasure, overinflates, then sneezes it back out.
  const inhale=phase(a,2,4.5),sneeze=phase(a,6,7),q=phase(a,7,9);
  let x=54-inhale*40,y=-24-Math.sin(inhale*Math.PI)*12;
  if(a>6){x=14+q*75;y=-28-Math.sin(q*Math.PI)*35;}
  if(a<4.6||a>6){if(theme==='turtle')ring(c,x,y,6+v,6+v,color,alpha,1.5);else if(theme==='phoenix')feather(c,x,y,8,q*4,color,alpha);else star(c,x,y,7,color);}
  if(a>2&&a<4.5)for(let i=0;i<3;i++)path(c,[[18+i*9,-29-i*3],[33+i*9,-32-i*3]],color,1,alpha*.35);
  draw(a<2?0:a<4.8?1:a<7?2:0,walk,-Math.sin(sneeze*Math.PI)*9,{squash:a>4.5&&a<6?.86:1,turn:a>6&&a<7?-.14:0});
  if(a>6&&a<7.4){ring(c,17,-h*.6,8+(a-6)*14,3+(a-6)*4,color,(1-(a-6)/1.4)*.5,1);}
 }else if(spot.name==='crewmate'){
  // Repair box: wrong switch, startled recoil, then a satisfied little salute.
  c.fillStyle='#243748';c.globalAlpha=alpha;c.fillRect(28,-30,25,30);
  const powered=a>5&&a<9;path(c,[[32,-23],[48,-23]],powered?color:'#567383',2.5,alpha);
  path(c,[[31,-15],[38,-15],[38,-6],[48,-6]],'#a2b8bc',1,alpha*.6);
  const shock=Math.max(0,1-Math.abs(a-5.3)/.55);
  draw(a<2?0:a<5?1:a<6.4?2:1,walk+(a>2&&a<5?7:0)-shock*7,-shock*12,{turn:-shock*.18});
  if(shock)lightning(c,[30,-22],[10,-h*.6],color,shock,t,1.3,false);
  if(a>6.5&&a<9){if(v===1)star(c,41,-39,6,color);else light(c,41,-23,15,8,color,.3);}
 }else if(spot.name==='creeper'){
  // An ominous wind-up ends in a harmless tiny flower, bubble or confetti hiccup.
  const wind=phase(a,2,4),pop=phase(a,4,4.9),land=phase(a,4.9,5.7),q=phase(a,4.5,7);
  draw(a<2?0:a<4?1:a<5.7?2:0,walk,-Math.sin(pop*Math.PI)*18,{squash:a>2&&a<4?1-wind*.15:1,turn:Math.sin(a*18)*wind*(1-pop)*.025});
  if(a>4&&a<7)for(let i=0;i<5;i++){const x=(i-2)*12*q,y=-h-24*q+q*q*28;
   if(v===1)ring(c,x,y,3,4,color,(1-q)*alpha,1);else feather(c,x,y,4,i+q*3,i%2?color:'#ffc1dc',(1-q)*alpha);}
  if(a>6&&a<10){path(c,[[22,0],[22,-16]],'#7dbd8b',1,alpha);for(let i=0;i<5;i++)feather(c,22+Math.cos(i*TAU/5)*4,-18+Math.sin(i*TAU/5)*4,4,i,'#f6d694',alpha*.8);}
  if(land>0&&land<1)ring(c,0,1,15+land*20,4,color,(1-land)*.4,1);
 }else if(spot.name==='boo'){
  // Boo tries to scare its own glowing reflection, hides, then peeks back.
  const peek=phase(a,2,4),fright=phase(a,5,6),recover=phase(a,8,10);
  ring(c,38,0,19,4,color,.25,1);light(c,38,-4,13,6,color,.2);
  draw(a<4?0:a<5.4?1:a<8?2:0,walk+peek*13-fright*16+recover*10,-6-Math.sin(a*1.7)*3-fright*(1-recover)*10);
  if(a>3&&a<5)star(c,38,-7-peek*8,4+v,color);
  if(a>5.2&&a<6.2)for(let i=0;i<3;i++)path(c,[[20+i*6,-65],[23+i*7,-72]],color,1,alpha*(6.2-a));
 }else if(spot.name==='goose'){
  // The already-painted knife hooks a cup/pearl; goose steals it and looks innocent.
  const steal=phase(a,4,6),escape=phase(a,7.4,10),x=walk+steal*5+escape*43;
  const propX=48+escape*42,propY=-3-Math.sin(steal*Math.PI)*7;
  if(v===1){ring(c,propX,propY-4,5,5,color,alpha,1.8);}else cup(c,propX,propY,color);
  draw(a<2?0:a<6.8?1:2,x,-Math.abs(Math.sin(a*(escape?11:4)))*(escape?2:0),{turn:escape?-.04:0});
 }else if(spot.name==='salvager'){
  // A precious cup gets dropped, bounces twice, and is chased back to safety.
  const collect=phase(a,1,3),drop=phase(a,5.6,8.8),chase=phase(a,8.8,10.6),x=walk+collect*8+chase*38;
  draw(a<3?0:a<5.6?1:a<8.8?2:1,x,-Math.abs(Math.sin(a*7))*.6,{turn:a>5.6&&a<7?-.12:0});
  if(a<3)cup(c,34,-4,color);
  if(a>=5.6&&a<8.8){cup(c,28+drop*35,-Math.abs(Math.sin(drop*Math.PI*2))*25*(1-drop),color);if(drop>.8)star(c,60,-9,4,color);}
  if(v===2&&a>9){path(c,[[x+18,-35],[x+32,-46],[x+29,-38]],color,1,alpha*.7);}
 }else if(spot.name==='hornet'){
  // Needle pins a loose thread; a silk swing ends in a clean landing or a wobble.
  const leap=phase(a,2,6.3),x=-30+leap*83+leave*25,y=-Math.sin(leap*Math.PI)*60;
  if(a>2&&a<7){path(c,[[64,-105],[x+20,y-51],[x,y-h*.55]],'#d9e9e8',.9,alpha*.65);}
  draw(a<2?0:a<6.3?1:2,x,y,{turn:Math.sin(leap*Math.PI)*.12+(v===1&&a>6.3&&a<7?Math.sin(a*20)*.08:0)});
  if(a>6.3&&a<7.5)ring(c,x,0,10+(a-6.3)*22,3,color,(1-(a-6.3)/1.2)*.4,1);
  if(v===2&&a>7&&a<9)feather(c,x+14,-40-(a-7)*8,5,a,color,alpha*.65);
 }else if(spot.name==='climber'){
  // The sledge head stays planted on a small stone step while the pot swings up.
  const lift=phase(a,2.2,5.6),slip=phase(a,6.2,7.2),fall=phase(a,7.2,9),contact=a>=2.2&&a<7.2;
  const anchor=[55,-57],length=55,angle=2.85+lift*1.1-slip*.65;
  const grip=[anchor[0]+Math.cos(angle)*length,anchor[1]+Math.sin(angle)*length];
  const scale=h/70,x=(grip[0]-28)*scale*(1-fall),y=(grip[1]+37)*scale*(1-fall);
  // A shaded stone foothold, seated on the shelf, gives the hammer a visible contact.
  c.save();c.scale(scale,scale);c.globalAlpha=alpha;c.fillStyle='#29343d';c.beginPath();
  c.moveTo(37,0);c.lineTo(40,-51);c.lineTo(46,-57);c.lineTo(69,-57);c.lineTo(73,-49);c.lineTo(69,0);c.closePath();c.fill();
  path(c,[[40,-51],[46,-57],[69,-57],[73,-49]],'#71828a',1.5,alpha*.8);
  path(c,[[46,-55],[49,-35],[45,-17],[48,0]],'#42505a',1,alpha*.7);c.restore();
  const pose=a<2.2?0:a<7.2?1:2,offset=pose===0?[0,-44]:pose===1?[28,-37]:[27,-62];
  draw(pose,x,y);const hand=[x+offset[0]*scale,y+offset[1]*scale];
  const end=contact?[anchor[0]*scale,anchor[1]*scale]:[hand[0]+Math.cos(a)*length*scale,hand[1]-Math.abs(Math.sin(a))*length*scale];
  path(c,[hand,end],'#ad885a',3,alpha);path(c,[[end[0]-8,end[1]],[end[0]+8,end[1]]],'#cad1ca',6,alpha);
  if(a>7.4&&a<8.2)ring(c,x,0,15+(a-7.4)*20,3,color,(1-(a-7.4)/.8)*.4,1);
 }
 c.restore();
}
