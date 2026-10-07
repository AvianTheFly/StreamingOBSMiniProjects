// Feature-owned stateless light drawing. Coordinates stay in a narrow edge band.
// No broad plates, opaque scenery, raster cast, flashing or independent loop.
const EDGE_COLORS={
 candy:['#ff92ca','#94e8ed','#ffe1a4'], mint:['#7de9cc','#b9eaff','#ffe3b1'],
 peach:['#ffa675','#ffd594','#ff92ae'], sunset:['#d3a0ff','#ffbbcb','#9eece5'],
 gold:['#ffdc87','#fff1c7','#f6add1'], sand:['#d7c99f','#a6dfc4','#ffe5ad'],
 ocean:['#6de0dd','#9ccaff','#d0f8ef'], sky:['#90d9ff','#c3b7ff','#a9f0e8'],
 lime:['#c5ec82','#74e8c3','#d4b0ff'], moon:['#b4d0ef','#dfc8f2','#edf5e1'],
 violet:['#b692f5','#e2acf4','#86dfe5'], rose:['#eda0bc','#bebdf1','#f9d5b0'],
};
const edgeFraction=v=>v-Math.floor(v);
function edgeSeed(key){let n=0;for(const ch of key)n=(n*31+ch.charCodeAt(0))>>>0;return n%997;}
function edgeXY(side,u,inset){
 return side===0?[u*1920,inset]:side===1?[1920-inset,u*1080]:
  side===2?[1920-u*1920,1080-inset]:[inset,1080-u*1080];
}
function edgeStroke(c,points,color,width=1,alpha=1){
 c.save();c.globalAlpha*=alpha;c.strokeStyle=color;c.lineWidth=width;
 c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();c.restore();
}
function edgeDot(c,x,y,r,color,alpha=1){
 c.save();c.globalAlpha*=alpha;c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();c.restore();
}
function edgeRing(c,x,y,rx,ry,color,alpha=1,angle=0){
 c.save();c.globalAlpha*=alpha;c.strokeStyle=color;c.lineWidth=1.1;c.beginPath();
 c.ellipse(x,y,rx,ry,angle,0,TAU);c.stroke();c.restore();
}
function edgeGlow(c,x,y,color,alpha){
 c.save();c.globalAlpha*=alpha;
 const g=c.createRadialGradient(x,y,0,x,y,11);
 g.addColorStop(0,color+'b0');g.addColorStop(.25,color+'50');g.addColorStop(1,color+'00');
 c.fillStyle=g;c.fillRect(x-11,y-11,22,22);c.restore();
}
// Local optical flourishes distinguish the families even at thumbnail size.
// Local x follows the edge; y points inward. None extends more than 90px inward.
function edgeFlourish(c,motion,side,phase,t,colors,alpha){
 const [x,y]=edgeXY(side,.35+edgeFraction(phase)*.3,43);
 c.save();c.translate(x,y);c.rotate(side*Math.PI/2);c.globalAlpha*=alpha;
 if(motion==='ripple'||motion==='bubble'||motion==='orbit'){
  for(let j=0;j<3;j++){
   const p=edgeFraction(t*.13+j/3),a=Math.sin(p*Math.PI)*.62;
   edgeRing(c,Math.sin(t*.45+phase)*15,0,18+p*48,6+p*22,colors[j],a,Math.sin(t*.3+j)*.12);
  }
 }else if(motion==='prism'){
  const points=Array.from({length:7},(_,j)=>[-84+j*28,Math.sin(j*2+phase+t*.3)*22]);
  edgeStroke(c,points,colors[0],1.4,.48);
  points.forEach(([x,y],j)=>{
   const a=.4+.25*Math.sin(t+j);edgeGlow(c,x,y,colors[j%3],a);
   edgeAccent(c,'diamond',x,y,.65+j%2*.2,Math.PI/8,colors[j%3],t);
  });
 }else if(motion==='bounce'){
  for(let j=0;j<3;j++){
   const x=-48+j*48,y=-4-Math.sin(t*1.7+j)*12;
   edgeStroke(c,Array.from({length:20},(_,n)=>[x-16+n*1.5,15+Math.sin(n*.7+t)*4]),colors[j],1.6,.5);
   edgeAccent(c,'grub',x,y,1.15,Math.sin(t+j)*.2,colors[j],t);
  }
 }else{
  for(let j=0;j<2;j++){
   const points=Array.from({length:65},(_,n)=>{
    const u=n/64,a=u*TAU*1.2+phase+t*.22;
    return [-84+u*168+Math.sin(a)*20,Math.sin(a+j*.6)*(11+11*Math.sin(u*Math.PI))];
   });
   edgeStroke(c,points,colors[j],10,.045);
   edgeStroke(c,points,colors[j],1.7,.5);
   const head=edgeFraction(t*.1+j*.42)*1.3;
   for(let n=1;n<65;n++){
    const lag=head-n/64;if(lag<0||lag>.22)continue;
    edgeStroke(c,[points[n-1],points[n]],colors[(j+1)%3],2.6,
     .8*(1-lag/.22)*Math.sin(n/64*Math.PI));
   }
  }
 }
 c.restore();
}
// Line-drawn jokes, 12-28px across. Light trails remain the main show.
function edgeAccent(c,type,x,y,size,angle,color,t){
 c.save();c.translate(x,y);c.rotate(angle);c.scale(size,size);
 c.strokeStyle=color;c.fillStyle=color;c.lineWidth=1.3;c.beginPath();
 if(type==='heart'){
  c.moveTo(0,7);c.bezierCurveTo(-17,-3,-6,-13,0,-5);c.bezierCurveTo(6,-13,17,-3,0,7);
 }else if(type==='ghost'){
  c.moveTo(-7,7);c.lineTo(-7,-1);c.bezierCurveTo(-7,-12,7,-12,7,-1);
  c.lineTo(7,7);c.quadraticCurveTo(3,2,0,7);c.quadraticCurveTo(-3,3,-7,7);
 }else if(type==='plane'){
  c.moveTo(-11,-6);c.lineTo(12,0);c.lineTo(-9,7);c.lineTo(-4,0);c.closePath();
  c.moveTo(-4,0);c.lineTo(12,0);
 }else if(type==='duck'){
  c.moveTo(-10,1);c.bezierCurveTo(-6,12,11,9,9,0);c.lineTo(13,-2);
  c.lineTo(8,-4);c.bezierCurveTo(7,-13,-3,-10,0,-1);c.quadraticCurveTo(-5,3,-10,1);
 }else if(type==='eye'){
  c.ellipse(0,0,11,1+5*Math.abs(Math.sin(t*.65+1)),0,0,TAU);c.moveTo(3,0);c.arc(0,0,3,0,TAU);
 }else if(type==='bubble'||type==='loop'||type==='coin'){
  c.ellipse(0,0,type==='coin'?5+Math.abs(Math.sin(t))*3:8,9,0,0,TAU);
 }else if(type==='grub'){
  c.ellipse(0,0,9,5,Math.sin(t)*.2,0,TAU);
 }else if(type==='pebble'||type==='seed'||type==='petal'){
  c.moveTo(-8,0);c.quadraticCurveTo(0,-11,9,0);c.quadraticCurveTo(0,8,-8,0);
 }else if(type==='diamond'||type==='scale'){
  c.moveTo(0,-9);c.lineTo(7,0);c.lineTo(0,9);c.lineTo(-7,0);c.closePath();
 }else{
  for(let j=0;j<8;j++){const a=j*TAU/8,r=j%2?2.5:9;const pt=[Math.cos(a)*r,Math.sin(a)*r];j?c.lineTo(...pt):c.moveTo(...pt);}c.closePath();
 }
 c.stroke();
 if(type==='ghost'||type==='grub'){edgeDot(c,-2,-1,1,color);edgeDot(c,3,-1,1,color);}
 c.restore();
}
function paintEdgeCue(c,e,cue){
 const [motion,palette,accent,voices,tempo]=cue,colors=EDGE_COLORS[palette];
 const t=Math.max(0,e.elapsed||0),seed=edgeSeed(e.key),phase=seed*.071;
 const sustained=!Number.isFinite(e.duration),pace=tempo*(sustained?.6:1);
 const main=seed%4; // Two principal sides, two sparse answering phrases.
 c.save();c.lineCap='round';c.lineJoin='round';
 for(let side=0;side<4;side++){
  const major=side%2===main%2,count=major?voices:Math.max(1,Math.ceil(voices/2));
  const sideAlpha=(major?.85:.58)*(sustained?.67:1);
  for(let j=0;j<count;j++){
   const color=colors[(j+side)%3],shift=phase+j*1.8+side*1.3;
   const along=.15+edgeFraction(seed*.003+side*.27+j*.19)*.12;
   const span=major?.6:.42,depth=17+j*8;
   // Open paths; tails stay inside [0,1] and never connect across a wrap.
   const path=u=>{
    let inset=depth+9*Math.sin(u*8+shift-t*pace*.6);
    if(motion==='braid')inset+=13*Math.sin(u*18+shift+t*pace);
    if(motion==='breeze')inset+=12*Math.sin(u*11+shift-t*pace*.8)*Math.sin(u*Math.PI);
    if(motion==='ripple')inset+=10*Math.sin(u*23-t*pace*2+shift);
    if(motion==='pulse')inset+=12*Math.exp(-(((u-.52)*11)**2))*Math.sin(u*37-t*pace*2);
    if(motion==='prism')inset+=9*(2/Math.PI)*Math.asin(Math.sin(u*22+shift+t*pace*.4));
    if(motion==='bounce')inset+=17*Math.abs(Math.sin(u*14-t*pace*1.6+shift));
    if(motion==='ember')inset+=u*18+8*Math.sin(u*17-t*pace+shift);
    if(motion==='orbit')inset+=14*Math.sin(u*TAU*2+shift+t*pace);
    if(motion==='bloom')inset+=15*Math.sin(u*20+shift-t*pace)*Math.sin(u*Math.PI);
    return edgeXY(side,along+u*span,Math.max(8,inset));
   };
   // Soft halo under a hairline; never a filled strip.
   const points=Array.from({length:53},(_,n)=>path(n/52));
   edgeStroke(c,points,color,10,sideAlpha*.04);
   edgeStroke(c,points,color,1.7,sideAlpha*.48);
   const head=edgeFraction(t*pace*.19+j*.24+side*.17+seed*.001)*1.42-.12;
   for(let n=0;n<18;n++){
    const u=head-n*.013,v=u-.013;if(v<0||u>1)continue;
    const alpha=(1-n/18)*Math.sin(Math.PI*u)*sideAlpha;
    edgeStroke(c,[path(v),path(u)],color,3.6,alpha*.95);
    if(n<5)edgeStroke(c,[path(v),path(u)],'#f0faff',1.1,alpha*.8);
   }
   // Separate particles breathe slowly, with no hard blinking.
   const particles=major?5:3;
   for(let n=0;n<particles;n++){
    const u=edgeFraction(n/particles+shift*.03+t*pace*.035);
    const [x,y]=path(u),a=Math.sin(u*Math.PI)*(.44+.16*Math.sin(t*1.4+n+shift))*sideAlpha;
    edgeGlow(c,x,y,color,a*.7);
    edgeDot(c,x,y,1.8+n%2*.55,color,Math.min(1,a*1.5));
    if(motion==='bubble'||motion==='ripple'){
     const cycle=edgeFraction(t*pace*.12+n*.31),r=4+cycle*12;
     edgeRing(c,x,y,r,r*.65,color,a*Math.sin(cycle*Math.PI)*.65,side*1.57);
    }else if(motion==='orbit'){
     edgeRing(c,x,y,13+n%2*5,5,color,a*.48,side*1.57+shift+t*.12);
    }else if(motion==='prism'&&n%2===0){
     c.save();c.globalAlpha*=a;edgeAccent(c,'diamond',x,y,.4,t*.15+shift,color,t);c.restore();
    }
   }
  }
  // One accent on each principal side; no repeated prop wallpaper.
  if(major){
   edgeFlourish(c,motion,side,phase,t*pace,colors,sideAlpha*.85);
   const travel=edgeFraction(t*pace*.045+side*.27+phase*.03);
   const u=.22+travel*.56,depth=47+8*Math.sin(t*pace+side);
   const [x,y]=edgeXY(side,u,depth);
   c.save();c.globalAlpha*=sideAlpha*Math.sin(Math.PI*travel)*.9;
   edgeAccent(c,accent,x,y,accent==='ghost'||accent==='duck'?1.5:1.2,
    Math.sin(t*pace+side)*.2+(accent==='plane'?side*Math.PI/2:0),colors[(side+1)%3],t);
   c.restore();
  }
 }
 c.restore();
}
