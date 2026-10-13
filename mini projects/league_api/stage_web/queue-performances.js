// Persistent miniature worlds: choreography changes their shape, never their clock.
// Geometry and trailing motion are sampled analytically, with no retained history.
export const PERFORMANCE_NAMES={
  bear:['Stormbear invocation','Thousand voices','Ursine aurora','Thunderclaw awakening'],
  turtle:['Lotus awakening','Immovable guardian','Spirit sanctuary','Veil of the moonpool'],
  ram:['Fire below the mountain','Hearth-Home reverie','Molten remembrance','Ancestral forge'],
  phoenix:['Everwinter rebirth','Frostbound procession','Eye of the whiteout','Cryophoenix passage']
};
const TAU=Math.PI*2;
const PALETTES={bear:['#13314d','#337eaa','#a7eaff'],turtle:['#103d39','#46a68e','#c0ffe3'],ram:['#482f30','#b67d49','#ffe1a4'],phoenix:['#302951','#9785d0','#f0e5ff']};
const mix=(a,b,v)=>a+(b-a)*v,clamp=v=>Math.max(0,Math.min(1,v));
export function sampleWorldPose(cues=[]){
  const modes=[0,0,0,0];let total=0;
  for(const cue of cues){const weight=clamp(cue.weight??1);modes[cue.id%4]+=weight;total+=weight;}
  if(total<1)for(let i=0;i<4;i++)modes[i]+=(1-total)*[.4,.2,.2,.2][i];
  if(total>1)for(let i=0;i<4;i++)modes[i]/=total;
  return modes;
}
function path(c,points,color,a=1,width=1,close=false,fill=null){
  if(!points.length)return;c.save();c.globalAlpha*=a;c.strokeStyle=color;c.lineWidth=width;
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));if(close)c.closePath();
  if(fill){c.fillStyle=fill;c.fill();}if(color)c.stroke();c.restore();
}
function halo(c,x,y,r,color,a){
  c.save();c.globalAlpha*=a;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(.3,color+'80');g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();
}
function ellipse(c,x,y,rx,ry,color,a=1,width=1,turn=0){
  c.save();c.globalAlpha*=a;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),turn,0,TAU);c.stroke();c.restore();
}
function camera(t){
  const yaw=.12*Math.sin(t*.09),co=Math.cos(yaw),si=Math.sin(yaw);
  return (x,y,z=0)=>{const dx=x*co+z*si,dz=z*co-x*si,s=1+dz/440;return [518+dx*s,77+y*s+dz*.34,dz];};
}
function crystal(c,P,x,y,z,r,h,turn,palette,a=1){
  const ring=Array.from({length:6},(_,i)=>P(x+Math.cos(turn+i*TAU/6)*r,y,z+Math.sin(turn+i*TAU/6)*r));
  const top=P(x,y-h,z),bottom=P(x,y+r*.8,z);
  const faces=ring.flatMap((v,i)=>[{v:[top,v,ring[(i+1)%6]],z:(v[2]+ring[(i+1)%6][2])/2,i},{v:[bottom,ring[(i+1)%6],v],z:(v[2]+ring[(i+1)%6][2])/2,i:i+6}]).sort((a,b)=>a.z-b.z);
  for(const face of faces){
    const g=c.createLinearGradient(top[0]-r,top[1],bottom[0]+r,bottom[1]);g.addColorStop(0,palette[2]);g.addColorStop(.35,face.i%2?palette[1]:palette[0]);g.addColorStop(1,palette[0]);
    path(c,face.v,palette[2]+'70',a*.92,.45,true,g);
  }
  path(c,[top,ring[0],bottom],palette[2],a*.8,.8);
}
function ribbon(c,P,t,{radius=64,height=0,twist=1,width=8,color='#91d9ff',alpha=.4,offset=0}={}){
  const upper=[],lower=[],spine=[];
  for(let i=0;i<=72;i++){
    const a=i/72*TAU+offset+t*.12,x=Math.cos(a)*radius,z=Math.sin(a)*radius*.6,y=height+Math.sin(a*twist+t*.38)*18;
    upper.push(P(x,y-width/2,z));lower.push(P(x,y+width/2,z));spine.push(P(x,y,z));
  }
  const g=c.createLinearGradient(430,35,585,130);g.addColorStop(0,color+'00');g.addColorStop(.4,color+'70');g.addColorStop(.7,color+'20');g.addColorStop(1,color+'00');
  path(c,[...upper,...lower.reverse()],null,alpha,0,true,g);path(c,spine,color,alpha*.65,.65);
}
function stars(c,t,color,w=.6){
  for(let i=0;i<28;i++){
    const a=i*2.399+t*(.045+(i%4)*.014),r=25+i%9*8,x=520+Math.cos(a)*r,y=77+Math.sin(a)*r*.58,light=(.5+.5*Math.sin(t*.65+i*1.7))**2;
    c.save();c.globalAlpha*=w*(.1+light*.65);c.fillStyle=color;c.beginPath();c.arc(x,y,i%7===0?1.1:.55,0,TAU);c.fill();
    if(i%7===0){path(c,[[x-3,y],[x+3,y]],color,.55,.5);path(c,[[x,y-3],[x,y+3]],color,.55,.5);}c.restore();
  }
}
function plinth(c,P,palette,t){
  const points=Array.from({length:12},(_,i)=>P(Math.cos(i*TAU/12)*75,45+Math.sin(i*2+t*.2)*1.5,Math.sin(i*TAU/12)*36)),lower=points.map(([x,y,z])=>[mix(x,518,.12),y+10,z]);
  const g=c.createLinearGradient(440,108,570,140);g.addColorStop(0,palette[0]+'00');g.addColorStop(.45,palette[1]+'65');g.addColorStop(1,palette[0]+'00');
  path(c,[...points,...lower.reverse()],null,.8,0,true,g);path(c,points,palette[2],.22,.7,true);
  for(let i=0;i<3;i++)ellipse(c,518,124+i*3,78-i*8,8-i,palette[1],.11,1);
}
function thunder(c,P,t,m,palette){
  const [gate,bloom,bridge,fracture]=m,pieces=[];
  for(let i=0;i<11;i++){
    const a=i/11*TAU+t*.08,r=48+fracture*18+bloom*6,x=mix(Math.cos(a)*r,(i-5)*14,bridge*.87),z=mix(Math.sin(a)*r*.66,Math.sin(i*.5+t*.2)*12,bridge);
    const y=18-Math.sin(a)*7-bloom*11+fracture*Math.sin(a*2+t*.4)*18,h=18+gate*(18+15*Math.sin(a+.5))+bloom*(18+15*Math.cos(i*2))+bridge*(7+Math.sin(i/10*Math.PI)*20);
    pieces.push({x,y,z,h,r:7+bloom*2+fracture*2,i});
  }
  halo(c,520,81,72,palette[1],.17);
  ribbon(c,P,t,{radius:72,height:-15-bridge*5,twist:2,width:12+bridge*12,color:'#89e6e8',alpha:.28+bridge*.3});
  pieces.sort((a,b)=>a.z-b.z);
  for(const q of pieces){const bob=Math.sin(t*.65+q.i*.7)*3;crystal(c,P,q.x,q.y+bob,q.z,q.r,q.h,t*.12+q.i*.5,palette,.9);const tip=P(q.x,q.y+bob-q.h,q.z);halo(c,tip[0],tip[1],9,palette[2],.16);}
  // Continuous travelling current; no regenerated random lightning on each frame.
  const wire=[];
  for(let i=0;i<=70;i++){const a=i/70*TAU+t*.08,r=48+fracture*18+bloom*6,x=mix(Math.cos(a)*r,Math.sin(a)*70,bridge);wire.push(P(x,-19+Math.sin(a*3+t*1.2)*3+Math.sin(a)*12,Math.sin(a)*r*.65));}
  path(c,wire,palette[2],.25+gate*.25,.8);
  const arc=[];for(let i=0;i<12;i++){const a=t*.9+i*.022,r=48+fracture*18+bloom*6;arc.push(P(mix(Math.cos(a)*r,Math.sin(a)*70,bridge),-19+Math.sin(a*3+t*1.2)*3+Math.sin(a)*12,Math.sin(a)*r*.65));}
  path(c,arc,'#effdff',.8,1.6);halo(c,arc[4][0],arc[4][1],12,palette[2],.25);
  for(let band=0;band<3;band++)ribbon(c,P,t-band*.6,{radius:38+band*15+fracture*12,height:-4+band*7,twist:2,width:3,color:palette[2],alpha:.13+fracture*.13,offset:band});
}
function petal(c,P,a,r,y,zLift,open,palette,alpha=1){
  const root=P(Math.cos(a)*r*.12,y,Math.sin(a)*r*.12),tip=P(Math.cos(a)*r,y-zLift,Math.sin(a)*r);
  const left=P(Math.cos(a-.26)*r*.76,y-zLift*.75-open,Math.sin(a-.26)*r*.76),right=P(Math.cos(a+.26)*r*.76,y-zLift*.45+open,Math.sin(a+.26)*r*.76);
  const g=c.createLinearGradient(root[0],root[1],tip[0],tip[1]);g.addColorStop(0,palette[0]);g.addColorStop(.55,palette[1]);g.addColorStop(1,palette[2]);
  c.save();c.globalAlpha*=alpha;c.fillStyle=g;c.strokeStyle=palette[2];c.lineWidth=.55;c.beginPath();c.moveTo(root[0],root[1]);c.quadraticCurveTo(left[0],left[1],tip[0],tip[1]);c.quadraticCurveTo(right[0],right[1],root[0],root[1]);c.fill();c.globalAlpha*=.6;c.stroke();
  path(c,[root,P(Math.cos(a)*r*.62,y-zLift*.47,Math.sin(a)*r*.62),tip],palette[2],.4,.6);c.restore();
}
function koi(c,P,t,offset,palette,amount){
  const a=t*.28+offset,r=58+Math.sin(t*.2+offset)*9,p=P(Math.cos(a)*r,29+Math.sin(a*2)*3,Math.sin(a)*r*.45);
  const next=P(Math.cos(a+.02)*r,29+Math.sin((a+.02)*2)*3,Math.sin(a+.02)*r*.45),angle=Math.atan2(next[1]-p[1],next[0]-p[0]);
  c.save();c.translate(p[0],p[1]);c.rotate(angle);c.scale(.7,.7);c.globalAlpha*=amount;
  c.fillStyle=palette[2];c.beginPath();c.moveTo(13,0);c.bezierCurveTo(7,-6,-5,-4,-11,0);c.bezierCurveTo(-3,5,7,6,13,0);c.fill();
  const swish=Math.sin(t*3+offset)*4;path(c,[[-10,0],[-19,-6+swish],[-16,swish],[-19,6+swish]],palette[1],.8,.7,true,palette[1]+'88');
  c.fillStyle=palette[0];c.beginPath();c.arc(9,-1,1,0,TAU);c.fill();c.restore();
}
function sanctuary(c,P,t,m,palette){
  const [lotus,dome,garden,moon]=m,opening=.5+.5*Math.sin(t*.33),petals=[];
  for(let ring=0;ring<2;ring++)for(let i=0;i<10;i++){const a=i*TAU/10+ring*.31+t*.045,r=33+ring*20+lotus*9+garden*5;petals.push({a,r,y:20-ring*2,z:Math.sin(a)*r,lift:20+(1-opening)*10+ring*8+dome*15,ring});}
  for(let i=0;i<5;i++)ellipse(c,520,112,38+i*13+Math.sin(t*.55-i*.6)*2,5+i*2,palette[2],.12-i*.01,.65);
  halo(c,520,72,58,palette[1],.3);petals.sort((a,b)=>a.z-b.z);
  for(const q of petals)petal(c,P,q.a,q.r,q.y,q.lift,6+opening*6,palette,.58+q.ring*.16);
  crystal(c,P,0,8+Math.sin(t*.8)*2,0,10,26,t*.24,palette,.85);
  for(let i=0;i<9;i++){
    const a=i*TAU/9+t*.075,pts=[];
    for(let k=0;k<=28;k++){const b=k/28*Math.PI,rr=43+moon*12;pts.push(P(Math.cos(a)*Math.sin(b)*rr,21-Math.cos(b/2)*Math.sin(b)*(42+dome*27),Math.sin(a)*Math.sin(b)*rr));}
    path(c,pts,palette[2],.09+dome*.26,.65);
  }
  for(let i=0;i<5;i++){
    const a=i*TAU/5-t*.08,x=Math.cos(a)*72,z=Math.sin(a)*29,y=16+Math.sin(t*.55+i)*8-garden*20;
    path(c,[P(x,39,z),P(x-5,y+14,z),P(x,y,z)],palette[1],.1+garden*.65,.7);
    for(let j=0;j<5;j++)petal(c,(u,v,w)=>P(x+u,y+v,z+w),j*TAU/5+t*.1,8+garden*3,0,5,2,palette,.2+garden*.6);
  }
  koi(c,P,t,0,palette,.5+moon*.5);koi(c,P,t,Math.PI,palette,.5+moon*.5);
  for(const side of [-1,1])for(let band=0;band<3;band++)ellipse(c,520+side*(45+moon*12),105,15+band*5,5+band*2,palette[2],moon*.35,.65,-side*.2);
}
function gear(c,P,r,y,tilt,spin,palette,alpha=1){
  const ring=[];
  for(let i=0;i<=128;i++){const a=i/128*TAU+spin,rr=r+(Math.floor(i/2)%2?3:0),x=Math.cos(a)*rr,z=Math.sin(a)*rr;ring.push(P(x,y+z*Math.sin(tilt),z*Math.cos(tilt)));}
  path(c,ring,palette[2],alpha*.5,.8,true);
  const inner=Array.from({length:65},(_,i)=>{const a=i/64*TAU+spin;return P(Math.cos(a)*(r-4),y+Math.sin(a)*(r-4)*Math.sin(tilt),Math.sin(a)*(r-4)*Math.cos(tilt));});
  path(c,inner,palette[1],alpha*.7,2,true);
  for(let i=0;i<8;i++){const a=i*TAU/8+spin,pt=rr=>P(Math.cos(a)*rr,y+Math.sin(a)*rr*Math.sin(tilt),Math.sin(a)*rr*Math.cos(tilt));path(c,[pt(r-4),pt(r-11)],palette[2],alpha*.55,.8);}
}
function forge(c,P,t,m,palette){
  const [ascent,anvil,cascade,orbit]=m,rotation=t*.17,rocks=[];
  halo(c,520,93,53,palette[1],.3);gear(c,P,60+orbit*10,1,-.5+Math.sin(t*.2)*.13,rotation,palette,.7);gear(c,P,44,8,.7+orbit*.35,-rotation*.8,palette,.8);
  for(let i=0;i<8;i++){const a=i*TAU/8+rotation,r=54+orbit*12;rocks.push({x:Math.cos(a)*r,z:Math.sin(a)*r*.5,y:26-Math.sin(a)*ascent*28+Math.sin(t*.5+i)*4,i,a});}
  rocks.sort((a,b)=>a.z-b.z);
  for(const q of rocks){crystal(c,P,q.x,q.y,q.z,8,10+cascade*10,q.a,palette,.85);const p=P(q.x,q.y+7,q.z);path(c,[[p[0],p[1]],[p[0]-3,p[1]+5+cascade*8]],palette[1],.3+cascade*.3,.8);}
  const center=P(0,26,5),x=center[0],y=center[1],g=c.createLinearGradient(x-25,y-22,x+25,y+10);g.addColorStop(0,'#e5bd80');g.addColorStop(.3,'#8b6346');g.addColorStop(.8,'#332939');g.addColorStop(1,'#c58d52');
  path(c,[[x-29,y-20],[x+31,y-20],[x+22,y-11],[x+9,y-8],[x+8,y],[x+20,y+7],[x-18,y+7],[x-8,y],[x-11,y-9],[x-24,y-12]],palette[2],.7+anvil*.3,.65,true,g);
  path(c,[[x-29,y-20],[x-7,y-24],[x+35,y-23],[x+31,y-20]],palette[2],.8,.6,true,'#d5ab75');
  const swing=Math.sin(t*.9),lift=(.5+.5*swing)*20;c.save();c.translate(x+Math.cos(t*.45)*3,y-32-lift);c.rotate(swing*.16);
  path(c,[[0,-17],[0,7]],palette[1],.45+anvil*.5,3);path(c,[[-14,-8],[12,-8],[16,-4],[16,6],[-12,6],[-16,2]],palette[2],.45+anvil*.5,.6,true,g);c.restore();
  crystal(c,P,0,-18+Math.sin(t*.5)*5,-6,9,20,rotation,palette,.45+orbit*.45);
  for(let i=0;i<20;i++){const q=((t*.16+i*.061)%1),a=i*2.399,r=8+q*64,pt=P(Math.cos(a)*r,10-q*60+q*q*54,Math.sin(a)*r*.4),light=Math.sin(q*Math.PI)**2;path(c,[[pt[0],pt[1]],[pt[0]-Math.cos(a)*2,pt[1]+2]],palette[2],light*(.25+cascade*.6),.8);}
}
function flightPose(t,m){
  const [rebirth,flock,dive,comet]=m,a=t*.24;
  return {x:Math.sin(a)*(14+comet*37+dive*19),y:Math.sin(a*.8+1)*(8+dive*23)-rebirth*4,z:Math.cos(a)*14,roll:Math.cos(a)*(.06+dive*.24+comet*.15)};
}
function phoenixBody(c,x,y,size,t,roll,palette,alpha=1){
  c.save();c.translate(x,y);c.rotate(roll);c.scale(size,size);c.globalAlpha*=alpha;
  const beat=Math.sin(t*1.65),lag=Math.sin(t*1.65-.55);
  for(const side of [-1,1])for(let i=10;i>=0;i--){
    const u=i/10,tx=side*(29+u*38),ty=-11-u*26+beat*(10+u*15),rootY=5+u*13,g=c.createLinearGradient(side*4,rootY,tx,ty);g.addColorStop(0,palette[0]);g.addColorStop(.45,palette[1]);g.addColorStop(1,palette[2]);
    c.fillStyle=g;c.strokeStyle=palette[2]+'99';c.lineWidth=.45;c.beginPath();c.moveTo(side*3,rootY);c.bezierCurveTo(side*(20+u*5),rootY-7+lag*8,tx-side*10,ty+18+lag*5,tx,ty);c.bezierCurveTo(tx+side*2,ty+16,side*(25+u*17),28+lag*8,side*3,rootY+6);c.fill();c.stroke();
  }
  for(let strand=0;strand<5;strand++){const points=[];for(let i=0;i<=22;i++){const q=i/22;points.push([(strand-2)*q*7+Math.sin(t*1.4-q*4+strand*.3)*q*7,16+q*(37-Math.abs(strand-2)*3)]);}path(c,points,strand%2?palette[1]:palette[2],.7,1.2);}
  const body=c.createLinearGradient(-5,-25,7,28);body.addColorStop(0,palette[2]);body.addColorStop(.45,palette[1]);body.addColorStop(1,palette[0]);
  c.fillStyle=body;c.beginPath();c.moveTo(0,-23);c.bezierCurveTo(10,-24,10,-14,5,-8);c.bezierCurveTo(2,4,10,14,0,27);c.bezierCurveTo(-12,14,-7,-1,-4,-10);c.bezierCurveTo(-9,-17,-7,-25,0,-23);c.fill();
  path(c,[[5,-21],[13,-17],[6,-15]],palette[2],1,.7,true,palette[2]);path(c,[[-3,-22],[-8,-30],[1,-25]],palette[2],.8,.6,true,palette[1]);c.fillStyle='#fff';c.beginPath();c.arc(4,-19,1,0,TAU);c.fill();c.restore();
}
function aviary(c,P,t,m,palette){
  const [rebirth,flock,dive,comet]=m,pose=flightPose(t,m),p=P(pose.x,pose.y,pose.z);halo(c,p[0],p[1],53,palette[1],.2);
  for(let band=0;band<7;band++){const points=[];for(let i=0;i<46;i++){const age=i*.095,old=flightPose(t-age,m);points.push(P(old.x+(band-3)*i*.11,old.y+20+i*.38+Math.sin(t-age-band*.15)*i*.14,old.z));}path(c,points,band%2?palette[1]:palette[2],.08+comet*.09,1+band*.06);}
  for(let i=0;i<3;i++){const points=[];for(let k=0;k<=70;k++){const a=k/70*TAU+t*.1;points.push(P(Math.cos(a)*(49+i*8),Math.sin(a)*(22+dive*18)+9,Math.sin(a)*(30-i*4)));}path(c,points,palette[1],.16+dive*.14,.65);}
  const companions=[];for(let i=0;i<5;i++){const a=t*.23+i*TAU/5,r=61+Math.sin(t*.14+i)*8;companions.push({x:Math.cos(a)*r,y:Math.sin(a*2)*16-4,z:Math.sin(a)*32,i});}
  for(const q of companions.filter(v=>v.z<0)){const b=P(q.x,q.y,q.z);phoenixBody(c,b[0],b[1],.14+flock*.08,t+q.i*.7,Math.sin(t*.4+q.i)*.25,palette,.25+flock*.55);}
  phoenixBody(c,p[0],p[1],.84+pose.z/240,t,pose.roll,palette);
  for(const q of companions.filter(v=>v.z>=0)){const b=P(q.x,q.y,q.z);phoenixBody(c,b[0],b[1],.17+flock*.09,t+q.i*.7,Math.sin(t*.4+q.i)*.25,palette,.2+flock*.6);}
  for(let i=0;i<8;i++){const a=i*TAU/8+t*.12;petal(c,P,a,43+rebirth*13,28,14+rebirth*20,4,palette,.1+rebirth*.25);}
}
// Original lore-inspired tableaux. Bear/ram/frost phoenix evoke the Freljord;
// the retained turtle follows Spirit Guard's Ionian protection and harmony.
function spiritWalker(c,t,color){
  const x=452+Math.sin(t*.19)*2,y=122,breath=Math.sin(t*.8)*.5;
  c.save();c.translate(x,y);c.scale(.72,.72);
  const robe=c.createLinearGradient(-15,-35,15,0);robe.addColorStop(0,'#132a36');robe.addColorStop(1,'#060e1b');
  path(c,[[-7,-26],[-16,-23],[-21,-10],[-17,-7],[-10,-18],[-9,-6],[-13,0],[-5,0],[0,-8],[5,0],[13,0],[9,-6],[10,-18],[17,-7],[21,-10],[16,-23],[7,-26]],color+'77',.9,.65,true,robe);
  c.fillStyle='#152431';c.beginPath();c.ellipse(0,-30+breath,7,9,0,0,TAU);c.fill();
  path(c,[[-7,-33],[-10,-24],[-6,-17],[-3,-23],[0,-19],[4,-24],[8,-20],[7,-34],[3,-38],[-4,-37]],color+'88',.8,.6,true,'#0b1522');
  for(const side of [-1,1]){
    path(c,[[side*4,-22],[side*7,-18],[side*3,-14]],color,.75,.8);
    halo(c,side*18,-10,9,color,.3);
  }
  c.restore();
  // Two slow currents leave the wrapped hands and join the spirit field.
  for(const side of [-1,1]){
    const pts=[];for(let i=0;i<38;i++){const q=i/37;pts.push([x+side*13+q*62+Math.sin(q*7-t*.7)*q*5,y-8-q*58+Math.sin(q*6-t*.5)*q*8]);}
    path(c,pts,color,.23,.8);
  }
}
function talismans(c,t,color,mode){
  for(let i=0;i<5;i++){
    const a=-Math.PI*.88+i*.52+t*.035,x=525+Math.cos(a)*77,y=88+Math.sin(a)*60;
    c.save();c.translate(x,y);c.rotate(Math.sin(t*.45+i)*.15);
    path(c,[[0,-9],[0,2]],color,.3,.6);
    path(c,[[-4,0],[3,-1],[5,9],[0,15],[-4,8]],color,.45,.6,true,'#0c1825');
    path(c,[[-2,4],[2,4],[mode%2?0:-2,8],[2,10]],color,.7,.7);c.restore();
  }
}
function stormAncestor(c,t,m,palette){
  const strength=.65+.2*(.5+.5*Math.sin(t*.26))**2,awakening=m[0]+m[3]*.6;
  c.save();c.translate(525+Math.sin(t*.21)*5,62+Math.cos(t*.28)*3);c.globalAlpha*=strength;
  const spirit=c.createLinearGradient(-35,-33,30,44);spirit.addColorStop(0,'#9bdfffaa');spirit.addColorStop(.45,'#1e5670cc');spirit.addColorStop(1,'#06182a00');
  c.fillStyle=spirit;c.strokeStyle='#9bddff99';c.lineWidth=.7;c.beginPath();c.moveTo(-34,-12);
  c.bezierCurveTo(-50,-35,-20,-48,-17,-28);c.bezierCurveTo(-4,-35,8,-33,18,-27);c.bezierCurveTo(22,-47,47,-35,36,-12);
  c.bezierCurveTo(43,9,27,37,0,48);c.bezierCurveTo(-28,36,-42,12,-34,-12);c.fill();c.stroke();
  for(const side of [-1,1]){
    for(let i=0;i<5;i++){
      const pts=[];for(let j=0;j<18;j++){const q=j/17;pts.push([side*(19+i*2-q*13)+Math.sin(q*6+t*.6+i)*2,-15+q*(41+i*2)]);}
      path(c,pts,palette[2],.09+i*.025,.65);
    }
    path(c,[[side*28,-7],[side*10,-3],[side*17,2],[side*25,0]],'#d9f6ff',.7+awakening*.25,.7,true,'#bcf3ff');
    path(c,[[side*10,17],[side*9,31],[side*4,20]],palette[2],.55,.6,true,'#71bbd4');
  }
  path(c,[[-11,12],[0,8],[11,12],[0,22]],palette[2],.8,.6,true,'#102736');
  path(c,[[2,-30],[-7,-16],[2,-18],[-2,-6],[11,-23],[3,-21]],'#e2faff',.65,.8);
  c.restore();
  // Three long spirit claws shear through the aurora with an eased travelling crest.
  for(let claw=0;claw<3;claw++){
    const pts=[],phase=t*.36-claw*.3;
    for(let i=0;i<=38;i++){const q=i/38;pts.push([480+claw*24+q*32+Math.sin(q*4+phase)*4,30+q*77]);}
    path(c,pts,palette[2],.1+awakening*.13,1);
    for(let i=0;i<8;i++){const q=(.5+.5*Math.sin(phase))*30+i;const p=pts[Math.min(38,Math.floor(q))];halo(c,p[0],p[1],3,palette[2],.035*(1-i/8));}
  }
  talismans(c,t,palette[2],0);
}
function jadeAncestor(c,t,m,palette){
  const breath=.5+.5*Math.sin(t*.31),x=526+Math.sin(t*.18)*13,y=66+Math.cos(t*.3)*5;
  c.save();c.translate(x,y);c.rotate(Math.sin(t*.25)*.075);
  // A guardian swims above its sanctuary; limb lag follows the same absolute clock.
  for(const side of [-1,1])for(const back of [-1,1]){
    const flap=Math.sin(t*.85+side+back*.7)*5;
    c.fillStyle='#54b69b88';c.strokeStyle=palette[2]+'88';c.lineWidth=.65;c.beginPath();c.moveTo(back*17,side*9);c.quadraticCurveTo(back*34,side*(30+flap),back*9,side*25);c.quadraticCurveTo(back*8,side*15,back*17,side*9);c.fill();c.stroke();
  }
  const jade=c.createRadialGradient(-9,-12,2,0,0,37);jade.addColorStop(0,'#d1ffe8cc');jade.addColorStop(.28,'#62cba6cc');jade.addColorStop(.8,'#144b48dd');jade.addColorStop(1,'#98efbe99');
  c.fillStyle=jade;c.strokeStyle='#caffdf';c.lineWidth=.8;c.beginPath();c.ellipse(0,0,34,23,0,0,TAU);c.fill();c.stroke();
  c.save();c.clip();
  for(let row=-2;row<=2;row++)for(let col=-3;col<=3;col++){
    const cx=col*14+(row%2)*7,cy=row*12,pts=Array.from({length:6},(_,i)=>[cx+Math.cos(i*TAU/6)*8,cy+Math.sin(i*TAU/6)*8]);path(c,pts,palette[2],.35,.7,true);
  }c.restore();
  c.fillStyle='#75caaa';c.beginPath();c.ellipse(36+breath*2,-1,10,7,.1,0,TAU);c.fill();halo(c,40,-3,3,'#d9ffe3',.8);
  path(c,[[-33,1],[-43,5],[-32,7]],palette[2],.45,.7,true,'#2e6e62');c.restore();
  // Prayer beads move in front of and behind the guardian's curved protective veil.
  for(let i=0;i<18;i++){const a=i*TAU/18+t*.17,r=59+breath*3,bx=x+Math.cos(a)*r,by=y+Math.sin(a)*r*.56;
    c.save();c.globalAlpha*=.2+.5*(Math.sin(a)+1)/2;c.fillStyle=i%3?palette[1]:'#eff6bc';c.beginPath();c.arc(bx,by,i%6===0?2.8:1.4,0,TAU);c.fill();c.restore();
  }
  for(let i=0;i<3;i++)ellipse(c,x,y,60+i*3,40+i*2,palette[2],(.1+m[1]*.13)/(i+1),.7,Math.sin(t*.2)*.1);
  talismans(c,t,palette[2],1);
}
function mountainMemory(c,t,m,palette){
  // A distant, volcanic silhouette gives the floating forge a place and scale.
  const pulse=.5+.5*Math.sin(t*.45),heat='#ff9764';
  const ridge=[[408,123],[435,80],[447,89],[472,47],[485,58],[506,29],[519,36],[537,28],[551,57],[563,48],[597,99],[618,127]];
  const rock=c.createLinearGradient(500,30,500,130);rock.addColorStop(0,'#5a434755');rock.addColorStop(.5,'#382e38aa');rock.addColorStop(1,'#121b2800');
  path(c,ridge,'#dcbca344',.75,.65,true,rock);
  for(let i=0;i<4;i++){
    const pts=[];for(let j=0;j<35;j++){const q=j/34;pts.push([514+(i-1.5)*4+q*(i-1.5)*22+Math.sin(q*9+i)*3,42+q*79]);}
    path(c,pts,heat,.15+m[0]*.15,3);path(c,pts,'#ffd5a0',.25,.6);
  }
  // Vast ram horns loom over the small physical anvil, carved out of warm smoke.
  for(const side of [-1,1]){
    c.save();c.translate(524,70);c.scale(side,1);c.strokeStyle='#e4aa75';c.globalAlpha*=.22+.16*pulse;c.lineWidth=5;c.beginPath();c.moveTo(10,-1);c.bezierCurveTo(18,-43,63,-43,66,-13);c.bezierCurveTo(68,12,39,20,34,0);c.bezierCurveTo(29,-16,49,-20,51,-7);c.stroke();c.lineWidth=.7;c.strokeStyle='#ffe8b8';c.stroke();c.restore();
  }
  halo(c,524,98,48,heat,.14+pulse*.08);
  // Ash spirals lift out of the hearth, fading at both ends of each path.
  for(let i=0;i<22;i++){const q=(t*.075+i*.071)%1,a=i*2.399+t*.22,x=521+Math.cos(a)*(8+q*45),y=118-q*104;
    path(c,[[x,y],[x+Math.sin(a)*2,y-3]],i%3?heat:palette[2],Math.sin(q*Math.PI)**2*.55,.9);
  }
}
function winterMemory(c,P,t,m,palette){
  const winter='#c5f1ff',vortex=m[2],rebirth=m[0];
  // Six branching ice currents wind into a storm eye, not a generic circular halo.
  for(let arm=0;arm<6;arm++){
    const pts=[];for(let i=0;i<44;i++){const q=i/43,a=arm*TAU/6+q*(2.1+vortex)+t*.11,r=10+q*78;pts.push(P(Math.cos(a)*r,-3+Math.sin(a)*r*.47,Math.sin(a)*r*.25));}
    path(c,pts,winter,.12+vortex*.15,.8);
    for(let k=8;k<40;k+=8){const p=pts[k],next=pts[k+1],angle=Math.atan2(next[1]-p[1],next[0]-p[0]);for(const side of [-1,1])path(c,[[p[0]+Math.cos(angle+side*.65)*7,p[1]+Math.sin(angle+side*.65)*7],p],winter,.22,.6);}
  }
  for(let i=0;i<36;i++){
    const a=i*2.399+t*(.09+(i%3)*.015),r=20+i%9*8,x=524+Math.cos(a)*r,y=77+Math.sin(a)*r*.6;
    const scale=.5+.5*Math.sin(t*.33+i);path(c,[[x-1-scale,y],[x+1+scale,y]],winter,.15+scale*.25,.65);
    if(i%4===0)path(c,[[x,y-2],[x,y+2]],winter,.35,.6);
  }
  const eggY=112+Math.sin(t*.6)*2;
  for(let i=0;i<6;i++){const a=i*TAU/6+t*.16;petal(c,(x,y,z)=>[524+x,eggY+y+z*.28,z],a,13+rebirth*6,0,23,3,[palette[0],'#75accb',winter],.25+rebirth*.3);}
  halo(c,524,eggY-12,22,winter,.12+rebirth*.1);
}
const WORLDS={bear:thunder,turtle:sanctuary,ram:forge,phoenix:aviary};
export function paintPerformanceWorld(c,theme,cues,time,color,weight=1){
  if(weight<=0)return;const t=Number.isFinite(time)?time:0,P=camera(t),palette=PALETTES[theme],m=sampleWorldPose(cues);
  c.save();c.globalAlpha=weight;c.lineCap='round';c.lineJoin='round';
  if(theme==='ram')mountainMemory(c,t,m,palette);
  if(theme==='phoenix')winterMemory(c,P,t,m,palette);
  plinth(c,P,palette,t);stars(c,t,palette[2],.25);
  c.save();c.globalAlpha*=theme==='bear'?.24:theme==='turtle'?.5:1;WORLDS[theme](c,P,t,m,palette);c.restore();
  if(theme==='bear')stormAncestor(c,t,m,palette);
  if(theme==='turtle')jadeAncestor(c,t,m,palette);
  spiritWalker(c,t,palette[2]);c.restore();
}
export function paintPerformance(c,theme,id,phase,color,weight=1){
  paintPerformanceWorld(c,theme,[{id:id+8,weight:1}],phase*45,color,weight);
}
