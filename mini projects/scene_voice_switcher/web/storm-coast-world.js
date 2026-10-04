import {PaintedWorld,edge} from './painted-world.js';
import {glow,hash,TAU} from './shared/world-motion.js';
import {cues,artists} from './storm-coast-guests.js';
export const scene={id:'storm-coast',source:'StormCoastLobby',holes:[[110,275,590,265],[820,430,440,460],[1502,230,282,487]],patches:[
 {rect:[316,116,114,108],move:(u,v,t)=>[Math.sin(t*.9)*5*v*edge(u,v),Math.cos(t*.9)*edge(u,v)]},
 {rect:[42,42,116,154],move:(u,v,t)=>[Math.sin(t*.8+1)*4*v*edge(u,v),Math.cos(t*.8)*edge(u,v)]},
 {rect:[541,578,91,151],move:(u,v,t)=>[Math.sin(t*1.3+v)*7*v*edge(u,v),Math.sin(t*.7)*edge(u,v)]},
 {rect:[748,435,150,73],move:(u,v,t)=>[Math.sin(t*1.8+v*5)*4*edge(u,v),Math.sin(t*2.1+u*8)*5*edge(u,v)]},
 {rect:[78,582,124,116],move:(u,v,t)=>[Math.sin(t*4+v*7)*3*edge(u,v),Math.sin(t*5+u*5)*5*edge(u,v)]}
]};
export function windowClip(c){c.beginPath();c.moveTo(780,0);c.lineTo(1432,0);c.lineTo(1432,419);c.lineTo(1240,700);c.lineTo(762,601);c.closePath();c.clip();}
function atmosphere(c,t){
 c.save();windowClip(c);c.strokeStyle='#b8d9e12b';c.lineWidth=.8;for(let i=0;i<55;i++){const x=780+hash(i+5)*650,y=((t*(130+hash(i)*100)+hash(i+17)*730)%760)-40;c.beginPath();c.moveTo(x,y);c.lineTo(x-4,y+18);c.stroke();}c.restore();
 for(const [x,y,r] of [[85,121,58],[377,169,48],[51,398,46],[1425,462,44],[1861,519,48],[143,651,58],[1430,657,49],[1830,704,58]])glow(c,x,y,r,'#ffc386',.04+.021*Math.sin(t*3.4+x));
}
export const world={scene,cues,artists,seed:79,createMotion:()=>new PaintedWorld(scene,atmosphere)};
