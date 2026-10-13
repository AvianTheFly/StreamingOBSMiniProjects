// Finite stagecraft: scenery builds, rockets arrive, cannons fire, ribbons unfurl.
// Analytic particles have bounded counts and no independent timers or queues.
import {clamp,ease,lerp,arc} from './raid_story.js';
import {beatTime} from './raid_music.js';
export const COLORS=['#ff5ba9','#42eee0','#ffd35c','#a888ff','#c7fa69'];
export function path(c,points,color,width=3){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
export function ellipse(c,x,y,rx,ry,color){c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,7);c.fillStyle=color;c.fill();}
export function polygon(c,points,color){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();}
export function star(c,x,y,r,color,rotation=0){c.save();c.translate(x,y);c.rotate(rotation);polygon(c,Array.from({length:10},(_,i)=>{const a=i*Math.PI/5-Math.PI/2,d=i%2?r*.45:r;return [Math.cos(a)*d,Math.sin(a)*d];}),color);c.restore();}
export function record(c,x,y,r,rotation=0){c.save();c.translate(x,y);c.rotate(rotation);ellipse(c,0,0,r,r,'#182135');for(const d of [.58,.78]){c.beginPath();c.arc(0,0,r*d,0,7);c.strokeStyle='#596683';c.lineWidth=1;c.stroke();}ellipse(c,0,0,r*.3,r*.3,'#ff71b9');ellipse(c,0,0,2,2,'#ffe5a3');path(c,[[0,-r*.92],[r*.55,-r*.48]],'#eaf7f9',2);c.restore();}
export function burst(c,x,y,age,color,seed=0,count=24){
 if(age<0||age>1.5)return;
 c.save();c.globalAlpha*=1-ease((age-.6)/.9);
 for(let i=0;i<count;i++){const a=(i/count)*Math.PI*2+seed*.17,speed=65+(i*37%95),d=age*speed;
  c.save();c.translate(x+Math.cos(a)*d,y+Math.sin(a)*d+age*age*45);c.rotate(a+age*(i%2?3:-4));
  c.fillStyle=COLORS[(i+seed)%COLORS.length]||color;
  if(i%4===0)star(c,0,0,5,c.fillStyle);else c.fillRect(-2,-5,4,10);c.restore();
 }c.restore();
}
function speaker(c,x,y,t,side,punch){
 c.save();c.translate(x,y+100*(1-ease(t/.5)));c.rotate(side*.08);
 c.fillStyle='#17273c';c.strokeStyle='#bb9fff';c.lineWidth=3;c.beginPath();c.roundRect(-34,-100,68,136,12);c.fill();c.stroke();
 for(const [cy,size]of [[-65,19],[-5,26]]){const r=size*(1+punch*.12);ellipse(c,0,cy,r,r,'#57648d');ellipse(c,0,cy,r*.72,r*.72,'#212f4a');ellipse(c,0,cy,r*.25,r*.25,'#54ecdf');}
 for(let i=0;i<5;i++)path(c,[[-23+i*11,-90],[-23+i*11,-83]],COLORS[i],3);c.restore();
}
function borderRibbon(c,t,side,color,offset){
 const grow=ease((t-.2-offset*.01)/.8),end=1080*grow;
 c.beginPath();for(let y=0;y<=end;y+=8){const x=21+offset+Math.sin(y/110-t*.7+offset)*12+(t>6?Math.sin(y/170)*12*ease((t-6)/1):0);y?c.lineTo(side?1920-x:x,y):c.moveTo(side?1920-x:x,y);}c.strokeStyle=color;c.lineWidth=offset===0?6:2;c.stroke();
}
function balloons(c,t,seed){
 for(let i=0;i<12;i++){
  const at=.4+i*.37,p=(t-at)/5.7;if(p<0||p>1)continue;
  const side=i%2,x=(side?1858:60)+Math.sin(p*4+i)*34,y=1170-p*1260;
  c.save();c.globalAlpha*=ease(p*8)*ease((1-p)*8);
  path(c,[[x,y+23],[x+Math.sin(p*5)*12,y+70],[x-8,y+102]],'#bdd6eb90',1.5);
  ellipse(c,x,y,17+(i%3)*3,24+(i%3)*3,COLORS[(i+seed)%5]);ellipse(c,x-6,y-8,4,7,'#ffffff80');polygon(c,[[x,y+21],[x-4,y+28],[x+5,y+28]],COLORS[(i+seed)%5]);c.restore();
 }
}
function bunting(c,t){
 const drop=ease((t-.25)/.65);c.save();c.translate(0,-90*(1-drop));
 for(const side of [0,1]){c.save();if(side){c.translate(1920,0);c.scale(-1,1);}path(c,[[0,35],[85,71],[180,85],[280,65],[400,22]],'#ffd96a',3);
  for(let n=0;n<10;n++){const x=n*39+8,y=30+Math.sin(x/400*Math.PI)*50;polygon(c,[[x,y],[x+29,y+9],[x+11,y+37+Math.sin(t+n)*3]],COLORS[n%5]);}c.restore();}c.restore();
}
function floor(c,t,seed){
 const grow=ease((t-.6)/1.2),top=1045-30*grow;
 const g=c.createLinearGradient(0,top-30,0,1080);g.addColorStop(0,'#48216c00');g.addColorStop(1,'#7931938c');c.fillStyle=g;c.fillRect(0,top-30,1920,1080-top+30);
 for(let n=0;n<45;n++){const x=n*44,level=12+((n*47+seed)%23)+arc(clamp((t-1.2-n*.07)/1.6))*24;c.fillStyle=COLORS[n%5]+'70';c.fillRect(x,1080-level*grow,28,level*grow);}
 path(c,[[0,top],[1920,top]],'#ba8cff',2);
 // The wave of cheering hands travels once, then settles into the finale.
 for(let n=0;n<28;n++){const cue=4.9+n*.064,lift=arc((t-cue)/.95),x=38+n*69,y=1090-lift*38-ease((t-6.4)/.6)*12;
  c.save();c.translate(x,y);c.rotate((n%2?1:-1)*lift*.3);path(c,[[-7,30],[-9,0],[-16,-10],[-12,-14],[-4,-5],[-5,-23],[0,-25],[4,-7],[9,-22],[14,-20],[10,3],[10,30]],COLORS[n%5],8);c.restore();}
}
function fireworks(c,t,seed,music){
 const cues=[[.22,95,145],[.66,1825,150],[1.95,90,820],[3.15,1830,300],[4.15,90,270],[5.38,1825,840],[6.18,340,80],[6.52,1580,80],[6.72,125,480],[7.02,1800,610],[7.15,620,945],[7.34,1290,950]];
 for(let n=0;n<cues.length;n++){const [at,x,y]=cues[n],age=music.seconds===undefined?t-at:music.seconds-beatTime(music.theme,at);
  if(age>-.32&&age<0){const p=(age+.32)/.32;path(c,[[x,y+100*(1-p)],[x,y+100*(1-p)+22]],COLORS[n%5],3);}
  burst(c,x,y,age,COLORS[n%5],seed%7+n,n>5?32:18);
 }
}
function finaleStreamers(c,t,seed){
 if(t<5.9)return;const p=ease((t-5.9)/1.6);
 for(const side of [0,1])for(let n=0;n<7;n++){
  c.beginPath();for(let j=0;j<=45;j++){const u=j/45*p,x=side?1920-u*(190+n*14):u*(190+n*14),y=1080-Math.sin(u*Math.PI*.83)*(200+n*43)+Math.sin(u*18+n)*10; j?c.lineTo(x,y):c.moveTo(x,y);}
  c.strokeStyle=COLORS[(n+seed)%5];c.lineWidth=3+n%2;c.stroke();
 }
}
export function drawStagecraft(c,t,seed,music={punch:0}){
 // Saturated little lights and luminous edges; no frame-wide pulses or strobing.
 for(const side of [0,1]){
  const g=c.createLinearGradient(side?1920:0,0,side?1680:240,0);g.addColorStop(0,side?'#723ac342':'#dd409b42');g.addColorStop(1,'#30215c00');c.fillStyle=g;c.fillRect(side?1680:0,0,240,1080);
  borderRibbon(c,t,side,'#ff67bb',0);borderRibbon(c,t,side,'#48ebdd',12);borderRibbon(c,t,side,'#ffd25e',25);
  for(let n=0;n<16;n++){const y=70+n*65,arrival=ease((t-.12-n*.023)/.35);ellipse(c,side?1907:13,y,4*arrival,4*arrival,COLORS[(n+seed)%5]);}
  speaker(c,side?1858:62,1032,t,side?1:-1,music.punch);
 }
 bunting(c,t);balloons(c,t,seed);floor(c,t,seed);fireworks(c,t,seed,music);finaleStreamers(c,t,seed);
 // Two mirror balls drop separately, spin their facets slowly, then lift out.
 for(const [i,x]of [285,1635].entries()){
  const p=ease((t-.35-i*.26)/.8),y=lerp(-80,85,p)-ease((t-7.25)/.7)*170;
  path(c,[[x,0],[x,y-33]],'#8799c7',2);ellipse(c,x,y,34,34,'#384b80');c.save();c.beginPath();c.arc(x,y,32,0,7);c.clip();
  c.globalAlpha*=.65;for(let row=-5;row<5;row++)for(let col=-5;col<5;col++){c.fillStyle=COLORS[Math.abs(row*3+col+seed)%5];c.fillRect(x+col*9+Math.sin(t*.7)*6,y+row*9,7,7);}c.restore();
  for(let n=0;n<3;n++)star(c,x+Math.cos(t*.4+n*2)*53,y+Math.sin(t*.4+n*2)*41,4,'#fff0bb',t);
 }
}
