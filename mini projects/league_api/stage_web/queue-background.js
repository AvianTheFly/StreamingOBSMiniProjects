// Feature-owned spirit atmosphere. Four bounded art surfaces; no video decoder,
// animation loop, event subscription or timer here. The queue page owns lifetime.
import {SPIRITS} from './queue-art.js';
import {paintEffect} from './queue-effects.js';
import {themeFrame} from './queue-theme.js';
import {paintPerformanceWorld} from './queue-performances.js';
const WIDTH=604,HEIGHT=154;
const GRADING={bear:'saturate(.75)',turtle:'hue-rotate(22deg) saturate(.65)',ram:'saturate(.75)',phoenix:'hue-rotate(245deg) saturate(.6)'};

export async function loadSpiritArt(signal){
  const surfaces={};
  await Promise.allSettled(Object.keys(SPIRITS).map(async theme=>{
    const response=await fetch(new URL(`./queue-${theme}.webp`,import.meta.url),{signal});
    if(!response.ok)return;
    const bitmap=await createImageBitmap(await response.blob());
    if(signal.aborted){bitmap.close();return;}
    const surface=document.createElement('canvas');surface.width=WIDTH;surface.height=HEIGHT;
    const ctx=surface.getContext('2d');ctx.filter=GRADING[theme];
    // The upper spirit silhouette supplies the texture; keep the human portrait
    // below this crop so it does not compete with the queue information.
    ctx.drawImage(bitmap,0,0,bitmap.width,145,375,24,330,96);bitmap.close();
    ctx.filter='none';ctx.globalCompositeOperation='destination-in';
    let feather=ctx.createLinearGradient(375,0,475,0);feather.addColorStop(0,'transparent');feather.addColorStop(1,'black');
    ctx.fillStyle=feather;ctx.fillRect(0,0,WIDTH,HEIGHT);
    feather=ctx.createLinearGradient(0,24,0,120);feather.addColorStop(0,'transparent');feather.addColorStop(.3,'black');feather.addColorStop(.7,'black');feather.addColorStop(1,'transparent');
    ctx.fillStyle=feather;ctx.fillRect(0,0,WIDTH,HEIGHT);
    surfaces[theme]=surface;
  }));
  return surfaces;
}

function radial(c,x,y,r,color,opacity){
  const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');
  c.globalAlpha=opacity;c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
}
function stroke(c,points,color,alpha,width=1){
  c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=width;c.beginPath();
  points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();
}
function bear(c,t,color,w){
  // Blue guardian vapor and long claw trails carry a slow electrical charge.
  for(let i=0;i<3;i++){
    const drift=Math.sin(t*.55+i)*4,x=437+i*41;
    c.globalAlpha=.18*w;c.strokeStyle=color;c.lineWidth=8;c.beginPath();
    c.moveTo(x+40,-12);c.bezierCurveTo(x+13,32,x-30,80+drift,x-43,160);c.stroke();
    c.globalAlpha=.38*w;c.lineWidth=1.4;c.stroke();
  }
  const charge=(.5+.5*Math.sin(t*Math.PI/7))**6;
  stroke(c,[[590,8],[558,38],[574,39],[534,80],[550,76],[518,120]],'#b7e7ff',(.15+charge*.45)*w,1.3);
  stroke(c,[[557,39],[529,33],[513,45]],color,(.12+charge*.2)*w);
  for(let i=0;i<4;i++){
    c.globalAlpha=.06*w;c.strokeStyle=color;c.lineWidth=12;c.beginPath();
    c.ellipse(496+Math.sin(t*.35+i)*12,91+i*13,82,21,-.25,Math.PI,Math.PI*1.92);c.stroke();
  }
}
function turtle(c,t,color,w){
  // A protective dome, overlapping shell cells and broad liquid caustics.
  for(let row=0;row<3;row++)for(let col=0;col<5;col++){
    const x=424+col*34+(row%2)*17,y=46+row*29;
    c.globalAlpha=(.10+.045*Math.sin(t*.8+row+col))*w;c.strokeStyle=color;c.lineWidth=1;
    c.beginPath();for(let k=0;k<=6;k++){const a=k*Math.PI/3;const px=x+19*Math.cos(a),py=y+19*Math.sin(a);k?c.lineTo(px,py):c.moveTo(px,py);}c.stroke();
  }
  for(let i=0;i<3;i++){
    const pulse=(t/12+i/3)%1;
    c.globalAlpha=Math.sin(pulse*Math.PI)*.23*w;c.strokeStyle=color;c.lineWidth=1.4;
    c.beginPath();c.ellipse(505,101,56+pulse*60,49+pulse*35,0,Math.PI,Math.PI*2);c.stroke();
  }
  for(let i=0;i<3;i++){
    c.globalAlpha=.11*w;c.strokeStyle='#a3f2da';c.lineWidth=2;c.beginPath();
    c.moveTo(351,100+i*16);c.bezierCurveTo(415,67+Math.sin(t*.65+i)*12,516,131-i*8,636,72+i*18);c.stroke();
  }
}
function ram(c,t,color,w){
  // Curled amber horns, stone facets and a rolling ground-impact wake.
  c.save();c.translate(509,88+Math.sin(t*.5)*2);
  for(const side of [-1,1]){
    c.save();c.scale(side,1);c.globalAlpha=.27*w;c.strokeStyle=color;c.lineWidth=2.5;
    c.beginPath();c.moveTo(9,0);c.bezierCurveTo(42,-56,82,-44,72,-10);
    c.bezierCurveTo(64,18,26,24,29,-3);c.bezierCurveTo(31,-25,56,-23,55,-4);c.stroke();c.restore();
  }c.restore();
  for(let i=0;i<5;i++){
    const x=383+i*48,y=120+Math.sin(i*2)*10;
    stroke(c,[[x,154],[x+13,y],[x+36,y+9],[x+48,154]],color,.14*w);
  }
  for(let i=0;i<2;i++){
    const pulse=(t/10+i/2)%1;c.globalAlpha=(1-pulse)*.18*w;c.strokeStyle=color;c.lineWidth=1;
    c.beginPath();c.ellipse(507,131,40+pulse*98,7+pulse*17,0,Math.PI,Math.PI*2);c.stroke();
  }
  for(let i=0;i<14;i++){
    const phase=(t/9+i*.137)%1,x=406+(i*53)%197,y=133-phase*69;
    c.globalAlpha=Math.sin(phase*Math.PI)*.23*w;c.fillStyle=color;
    c.fillRect(x+Math.sin(phase*3+i)*6,y,1.4,1.4);
  }
}
function phoenix(c,t,color,w){
  // Cold storm plumes open and fold; wind ribbons pass around the guardian.
  for(let i=0;i<6;i++){
    const sway=Math.sin(t*.55+i*.6)*7;
    c.globalAlpha=(.11+i*.017)*w;c.strokeStyle=i%2?'#d0d6ff':color;c.lineWidth=i%2?1:2;
    c.beginPath();c.moveTo(376+i*7,149);c.bezierCurveTo(432+i*8,119,465+i*12,50+sway,611,10+i*14);c.stroke();
    c.beginPath();c.moveTo(447+i*7,89);c.quadraticCurveTo(529+i*3,105+sway,608,55+i*9);c.stroke();
  }
  for(let i=0;i<3;i++){
    c.globalAlpha=.15*w;c.strokeStyle=color;c.lineWidth=1;c.beginPath();
    c.ellipse(509,84,91+i*19,19+i*6,-.32+Math.sin(t*.3+i)*.06,Math.PI*.8,Math.PI*1.8);c.stroke();
  }
  const charge=(.5+.5*Math.sin(t*Math.PI/8))**8;
  stroke(c,[[578,29],[559,52],[570,49],[548,74]],'#e2e3ff',(.08+charge*.24)*w);
}
const ARTISTS={bear,turtle,ram,phoenix};
function layer(c,theme,t,art,w,cues=[],shift=0){
  c.save();c.translate(shift,0);
  const color=SPIRITS[theme].color;
  radial(c,501+Math.sin(t*.23)*10,87,147,color,.17*w);
  radial(c,594,103+Math.cos(t*.4)*7,77,color,.1*w);
  if(art[theme]){c.globalAlpha=.025*w;c.globalCompositeOperation='screen';c.drawImage(art[theme],Math.sin(t*.35)*2,Math.cos(t*.3)*2);c.globalCompositeOperation='source-over';}
  c.lineCap='round';c.lineJoin='round';ARTISTS[theme](c,t,color,w*.14);
  paintPerformanceWorld(c,theme,cues,t,color,w);
  for(const cue of cues)if(cue.id<8)paintEffect(c,theme,cue,color,w*(cue.weight??1)*.32);
  c.restore();
}
export function paintBackground(canvas,frame,time=0,motion=true,art={}){
  const c=canvas.getContext('2d');c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,canvas.width,canvas.height);
  c.save();c.scale(canvas.width/WIDTH,canvas.height/HEIGHT);
  const t=motion?time:0;
  // Draw both themes into one bounded surface during a soft handoff.
  if(frame.from!==frame.to&&frame.mix<1)layer(c,frame.from,t,art,1-frame.mix,motion?frame.fromCues||[]:[],-frame.mix*14);
  const weight=frame.from===frame.to?1:frame.mix;
  const cues=!motion?[]:frame.cues||(frame.cue===undefined?themeFrame({theme:frame.to},time).cues:frame.cue?[frame.cue]:[]);
  if(weight>0)layer(c,frame.to,t,art,weight,cues,(1-weight)*14);
  // Protect the text column and top/bottom captions; keep atmosphere in empty space.
  c.globalCompositeOperation='destination-in';c.globalAlpha=1;
  let mask=c.createLinearGradient(0,0,WIDTH,0);
  for(const [at,a] of [[0,0],[.60,0],[.68,.25],[.80,1],[1,1]])mask.addColorStop(at,`rgba(0,0,0,${a})`);
  c.fillStyle=mask;c.fillRect(0,0,WIDTH,HEIGHT);
  mask=c.createLinearGradient(0,0,0,HEIGHT);
  for(const [at,a] of [[0,.12],[.15,.8],[.3,1],[.78,1],[.92,.2],[1,.02]])mask.addColorStop(at,`rgba(0,0,0,${a})`);
  c.fillStyle=mask;c.fillRect(0,0,WIDTH,HEIGHT);c.restore();
}
