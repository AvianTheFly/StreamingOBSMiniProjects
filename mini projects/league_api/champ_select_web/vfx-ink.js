import {clamp,smooth,path,light} from './scene-map.js';
// Analytic, bounded particles: no emitter queues, timers, or mutable random state.
export const TAU=Math.PI*2;
export const seed=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
export const out=n=>1-(1-clamp(n))**3;
export const envelope=(age,inTime,hold,end)=>smooth(age/inTime)*(1-smooth((age-hold)/(end-hold)));
export function arc(a,b,q,bend=100){return [a[0]+(b[0]-a[0])*q,a[1]+(b[1]-a[1])*q-Math.sin(q*Math.PI)*bend];}
export function ribbon(c,a,b,head,color,{bend=100,width=20,tail=.4,alpha=1,phase=0}={}){
 if(head<=0||alpha<=0)return;
 const points=[],normals=[];
 for(let i=0;i<25;i++){const q=Math.max(0,head-tail)+Math.min(head,tail)*i/24,p=arc(a,b,q,bend),next=arc(a,b,q+.001,bend),dx=next[0]-p[0],dy=next[1]-p[1],len=Math.hypot(dx,dy)||1;
  const w=Math.sin(i/24*Math.PI)*width*(.65+.35*Math.sin(q*19+phase));points.push(p);normals.push([-dy/len*w,dx/len*w]);}
 c.save();c.globalAlpha=alpha*.26;c.fillStyle=color;c.beginPath();
 for(let i=0;i<25;i++)c.lineTo(points[i][0]+normals[i][0],points[i][1]+normals[i][1]);
 for(let i=24;i>=0;i--)c.lineTo(points[i][0]-normals[i][0],points[i][1]-normals[i][1]);c.closePath();c.fill();
 path(c,points,color,2.8,alpha*.9);path(c,points.slice(18),'#f3ffff',1.1,alpha*.8);c.restore();
}
export function lightning(c,a,b,color,strength=1,time=0,width=2,branches=true){
 if(strength<=0)return;const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,phase=Math.floor(time*19),pts=[];
 for(let i=0;i<=12;i++){const q=i/12,j=(seed(i+phase*13)-.5)*Math.sin(q*Math.PI)*Math.min(70,len*.23);pts.push([a[0]+dx*q-dy/len*j,a[1]+dy*q+dx/len*j]);}
 path(c,pts,color,width*5,strength*.1);path(c,pts,color,width*1.8,strength*.75);path(c,pts,'#e7faff',width*.52,strength);
 if(branches)for(let k=3;k<11;k+=3){const p=pts[k],d=k%2?1:-1;path(c,[p,[p[0]+d*22,p[1]+13],[p[0]+d*(35+k*3),p[1]+36]],color,width*.7,strength*.65);}
}
export function ring(c,x,y,rx,ry,color,alpha=1,width=2,angle=0){
 if(alpha<=0||rx<=0||ry<=0)return;c.save();c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.ellipse(x,y,rx,ry,angle,0,TAU);c.stroke();c.restore();
}
export function feather(c,x,y,size,angle,color,alpha=1){
 c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha=alpha;c.fillStyle=color;c.beginPath();c.moveTo(0,-size);c.bezierCurveTo(size*.65,-size*.6,size*.4,size*.7,0,size);c.bezierCurveTo(-size*.2,size*.3,-size*.55,-size*.5,0,-size);c.fill();path(c,[[0,-size*.7],[0,size]],'#f0fbff',.6,alpha*.65);c.restore();
}
export function burst(c,x,y,age,color,{kind='spark',count=40,speed=260,life=1.9,gravity=150,seedOffset=0}={}){
 if(age<0||age>life)return;
 for(let i=0;i<count;i++){const n=i+seedOffset*37,delay=seed(n+77)*.1,a=age-delay,span=life*(.5+seed(n+3)*.5);if(a<0||a>span)continue;
  const q=a/span,angle=seed(n)*TAU,v=speed*(.25+seed(n+1)*.75),drag=(1-Math.exp(-a*2))/2,dx=Math.cos(angle)*v,dy=Math.sin(angle)*v;
  const px=x+dx*drag,py=y+dy*drag+gravity*a*a*.5,alpha=(1-q)**1.6,size=(2+seed(n+4)*5)*(1-q*.5);
  if(kind==='feather'){feather(c,px,py,size*2.4,angle+a*(seed(n+9)-.5)*5,color,alpha);continue;}
  if(kind==='water'){ring(c,px,py,size,size*1.3,color,alpha*.8,1.2);light(c,px-1,py-2,size*.55,size*.7,'#edfff5',alpha);continue;}
  c.save();c.translate(px,py);c.rotate(angle+a*3);c.globalAlpha=alpha;
  if(kind==='stone'){c.fillStyle='#3c302c';c.beginPath();c.moveTo(-size,-size*.6);c.lineTo(size*.6,-size);c.lineTo(size,size*.4);c.lineTo(-size*.3,size);c.closePath();c.fill();path(c,[[-size,-size*.6],[size*.6,-size],[size,size*.4]],color,1.3,alpha);}
  else{c.fillStyle=color;c.fillRect(-size*.2,-size*2,size*.4,size*4);c.fillStyle='#fffbdf';c.fillRect(-.5,-size,.9,size);}
  c.restore();
 }
}
export function mist(c,x,y,age,color,alpha=.25,spread=90){
 if(age<0||age>2.6)return;const q=age/2.6;
 for(let i=0;i<7;i++){const dx=(seed(i+20)-.5)*spread*(.3+q),dy=(seed(i+32)-.6)*spread*q;
  light(c,x+dx,y+dy-q*45,20+q*50,12+q*26,color,Math.sin(q*Math.PI)*alpha*(.4+seed(i)));}
}
// Painted effects erode into wisps. The scene bitmap is never sampled.
export function apparition(c,image,x,y,w,h,{alpha=1,turn=0,dissolve=0,wing=0}={}){
 if(!image||alpha<=0)return;c.save();c.globalCompositeOperation='source-over';c.translate(x,y);c.rotate(turn);
 if(dissolve<.01){c.globalAlpha=alpha;
  if(wing){for(const sign of [-1,1]){c.save();c.rotate(wing*sign);const sx=sign<0?0:image.width/2;c.drawImage(image,sx,0,image.width/2,image.height,sign<0?-w/2:0,-h/2,w/2,h);c.restore();}}
  else c.drawImage(image,-w/2,-h/2,w,h);
 }else{const frames=image.dissolveFrames,step=clamp(dissolve)*15,index=Math.floor(step),mix=step-index;
  c.globalAlpha=alpha*(1-mix);c.drawImage(frames?.[index]||image,-w/2,-h/2,w,h);
  if(mix>.001){c.globalAlpha=alpha*mix;c.drawImage(frames?.[Math.min(15,index+1)]||image,-w/2,-h/2,w,h);}
 }c.restore();
}
