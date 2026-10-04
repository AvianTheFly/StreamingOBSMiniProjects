import {PaintedWorld,edge} from './painted-world.js';
import {glow,ellipse,hash,TAU} from './shared/world-motion.js';
import {cues,artists} from './future-guests.js';
export const scene={id:'future',source:'FutureWorldLobby',holes:[[138,344,614,260],[820,350,360,520],[1540,270,274,432]],patches:[
 {rect:[0,594,175,160],move:(u,v,t)=>[Math.sin(t*.7)*2*edge(u,v),Math.sin(t)*3*edge(u,v)]},
 {rect:[1598,27,239,151],move:(u,v,t)=>[Math.sin(t*.8)*2*edge(u,v),Math.sin(t*1.1)*3*edge(u,v)]},
 {rect:[1504,851,129,119],move:(u,v,t)=>[Math.sin(t*.8)*2*edge(u,v),Math.sin(t*1.3+u)*2*edge(u,v)]},
 {rect:[978,282,285,284],move:(u,v,t)=>[Math.sin(t*.3+v*3)*2*edge(u,v),Math.cos(t*.35+u*3)*2*edge(u,v)]}
]};
function atmosphere(c,t){
 c.save();c.beginPath();c.rect(870,239,620,398);c.clip();for(let i=0;i<35;i++){const x=870+hash(i+2)*620,y=240+hash(i+31)*396;glow(c,x,y,4+hash(i+9)*3,'#afe6ff',.05+.07*(1+Math.sin(t*.9+i))/2);}c.restore();
 for(const [x,y,r] of [[940,130,146],[1657,104,60],[63,666,54],[1463,693,48],[396,732,33]])glow(c,x,y,r,'#8dddeb',.03+.018*Math.sin(t*1.4+x));
 c.save();c.strokeStyle='#a3ebef66';c.lineWidth=1;for(let i=0;i<5;i++){const x=520+((t*47+i*178)%845),y=940+Math.sin(i)*12;c.beginPath();c.ellipse(x,y,14,3,0,0,TAU);c.stroke();}c.restore();
}
export const world={scene,cues,artists,seed:101,createMotion:()=>new PaintedWorld(scene,atmosphere)};
