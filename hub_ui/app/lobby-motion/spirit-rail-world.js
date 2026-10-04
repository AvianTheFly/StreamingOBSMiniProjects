import {PaintedWorld,edge} from './painted-world.js';
import {glow,hash} from './shared/world-motion.js';
import {steam} from './sanctuary-atmosphere.js';
import {leaf} from './world-ink.js';
import {cues,artists} from './spirit-rail-guests.js';
export const scene={id:'spirit-rail',source:'SpiritRailLobby',holes:[[828,196,630,252],[150,320,355,510],[1544,183,309,463]],patches:[
 {rect:[354,0,100,392],move:(u,v,t)=>[Math.sin(t*.85+v)*7*v*edge(u,v),Math.sin(t*.7)*edge(u,v)]},
 {rect:[575,211,93,204],move:(u,v,t)=>[Math.sin(t*1.2+v*4)*6*edge(u,v),Math.sin(t*1.6+u*3)*2*edge(u,v)]},
 {rect:[964,599,271,67],move:(u,v,t)=>[Math.sin(t*.65)*2*edge(u,v),Math.sin(t*3+u*4)*2*edge(u,v)]},
 {rect:[529,733,60,65],move:(u,v,t)=>[Math.sin(t*.8)*.8*edge(u,v),Math.sin(t*1.2)*1.1*edge(u,v)]}
]};
function atmosphere(c,t){
 for(const [x,y,r] of [[27,773,55],[517,714,29],[788,335,30],[1498,310,30],[1877,309,29],[996,754,23],[1168,751,24],[1560,952,39]])glow(c,x,y,r,'#ffd497',.045+.018*Math.sin(t*1.8+x));
 steam(c,1210,627,t,79);
 for(let i=0;i<11;i++){const q=(t*.043+hash(i+10))%1,x=899+hash(i+2)*585+q*98,y=589+q*425;leaf(c,x,y,3+hash(i+40)*3,['#b77d56','#c68c5d','#947250'][i%3],t*.6+i);}
}
export const world={scene,cues,artists,seed:89,createMotion:()=>new PaintedWorld(scene,atmosphere)};
