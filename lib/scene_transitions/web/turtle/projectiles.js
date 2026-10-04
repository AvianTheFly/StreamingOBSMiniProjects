// Heavy, chipped boulders with independent flight, collision and fracture debris.
import {rng,TAU,clamp,lerp} from '../math.js';
import {polygon,line,glow} from '../fx.js';
import {hits} from '../rigs/turtle/motion.js';
import {contact} from './shield.js';
export const rocks=[{at:hits[0],duration:.92,radius:104,seed:701},{at:hits[1],duration:.67,radius:114,seed:911},{at:hits[2],duration:.58,radius:144,seed:1301}];
export function trajectory(index,t,variant=0){const r=rocks[index],tip=contact(index,variant),side=variant?-1:1,q=clamp((t-r.at+r.duration)/r.duration),fall=q*(.50+.50*q);
 const fromX=index===0?(variant?-140:2060):tip[0]+side*(index===2?840:860),fromY=index===0?280:tip[1]-390;
 return {x:lerp(fromX,tip[0],fall),y:lerp(fromY,tip[1],fall)-Math.sin(q*Math.PI)*75,q,visible:t>=r.at-r.duration&&t<r.at};}
function rock(c,x,y,r,angle,seed,alpha=1){const random=rng(seed),points=Array.from({length:12},(_,i)=>{const a=i*TAU/12,v=r*(.70+random()*.30);return [Math.cos(a)*v,Math.sin(a)*v];});
 c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha*=alpha;
 const shade=c.createLinearGradient(-r,-r,r,r);shade.addColorStop(0,'#abb09b');shade.addColorStop(.25,'#687263');shade.addColorStop(.58,'#343c37');shade.addColorStop(1,'#101c1b');
 polygon(c,points);c.fillStyle=shade;c.fill();
 for(let i=0;i<points.length;i++){polygon(c,[[r*.09,-r*.16],points[i],points[(i+1)%points.length]]);c.fillStyle=['#bec4a12b','#30372e40','#040f1455','#8f958333'][i%4];c.fill();
  line(c,[points[i],points[(i+1)%points.length]],i<5?'#c1c1a1':'#071111',1.5,.6);}
 c.save();polygon(c,points);c.clip();
 for(let i=0;i<150;i++){const x=(random()-.5)*r*2,y=(random()-.5)*r*2;c.fillStyle=i%3?'#080e1166':'#d9d0aa55';c.fillRect(x,y,1+random()*r*.04,1+random()*r*.025);}
 for(let i=0;i<5;i++){const x=(random()-.5)*r,y=(random()-.5)*r;line(c,[[x-r*.32,y-r*.22],[x,y],[x+r*.08,y+r*.17],[x+r*.29,y+r*.30]],'#0b1211',1+r*.013,.8);}
 c.restore();c.restore();}
function wake(c,index,t,variant,p){const spec=rocks[index],random=rng(spec.seed+43),side=variant?-1:1;
 for(let n=0;n<35;n++){const age=.015+random()*.28,old=trajectory(index,t-age,variant);if(!old.visible)continue;
  const x=old.x+side*random()*40,y=old.y+(random()-.5)*spec.radius*.75+age*age*260;
  if(n%6===0)rock(c,x,y,3+random()*spec.radius*.06,t*.6+n,spec.seed+n,.48*(1-age/.30));
  else glow(c,x,y,10+age*70,'#9c9c7b',.035*(1-age/.30));
 }
}
export function draw(c,t,variant=0){for(let i=0;i<rocks.length;i++){
 const spec=rocks[i],p=trajectory(i,t,variant),side=variant?-1:1;
 if(p.visible){wake(c,i,t,variant,p);rock(c,p.x,p.y,spec.radius,side*(t*.78+i),spec.seed);}
 const age=t-spec.at;if(age<0||age>1.25)continue;
 const [x,y]=contact(i,variant),random=rng(spec.seed);
 for(let n=0;n<28+i*9;n++){
  const angle=(random()-.5)*Math.PI*1.10,speed=130+random()*730,rx=x+side*Math.cos(angle)*speed*age,
   ry=y+Math.sin(angle)*speed*age+age*age*520;
  rock(c,rx,ry,5+random()*spec.radius*.23,age*(random()-.5)*10,spec.seed+n+7,clamp((1.25-age)/.50));
 }
 for(let n=0;n<35;n++){const speed=100+random()*390,a=(random()-.5)*Math.PI,xp=x+side*Math.cos(a)*speed*age,yp=y+Math.sin(a)*speed*age+age*age*125;
  glow(c,xp,yp,12+age*(28+random()*48),'#bec09b',clamp(1-age/.85)*.09);}
}}
