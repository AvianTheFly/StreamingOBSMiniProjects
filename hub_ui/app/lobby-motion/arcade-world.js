import {PaintedWorld,edge} from './painted-world.js';
import {glow,hash} from './shared/world-motion.js';
import {steam} from './sanctuary-atmosphere.js';
import {cues,artists} from './arcade-guests.js';
export const scene={id:'arcade',source:'SpiritArcadeLobby',holes:[[270,164,607,307],[995,340,400,490],[1498,166,303,433]],patches:[
 {rect:[1637,748,152,103],move:(u,v,t)=>[Math.sin(t*.7)*2*edge(u,v),Math.sin(t)*2*edge(u,v)]},
 {rect:[1746,689,172,220],move:(u,v,t)=>[Math.sin(t*.9+v*3)*4*edge(u,v),Math.sin(t*.8+u*3)*2*edge(u,v)]},
 {rect:[0,701,124,167],move:(u,v,t)=>[Math.sin(t*.8+v*3)*4*edge(u,v),Math.sin(t+u*2)*2*edge(u,v)]}
]};
function atmosphere(c,t){
 c.save();c.beginPath();c.rect(989,0,471,542);c.clip();c.strokeStyle='#b3bedc35';c.lineWidth=.7;for(let i=0;i<44;i++){const x=990+hash(i+13)*470,y=((t*(72+hash(i)*70)+hash(i+3)*570)%590)-30;c.beginPath();c.moveTo(x,y);c.lineTo(x-2,y+13);c.stroke();}c.restore();
 for(const [x,y,r] of [[85,408,45],[164,453,40],[237,440,32],[1156,178,58]])glow(c,x,y,r,'#bc9ee1',.035+.021*Math.sin(t*1.2+x));
 for(const [x,y,r] of [[120,46,36],[935,196,40],[1446,106,39],[1083,449,23],[281,782,34],[1843,793,31]])glow(c,x,y,r,'#e9bf7c',.04+.018*Math.sin(t*1.5+x));
 steam(c,401,805,t,52);
}
export const world={scene,cues,artists,seed:107,createMotion:()=>new PaintedWorld(scene,atmosphere)};
