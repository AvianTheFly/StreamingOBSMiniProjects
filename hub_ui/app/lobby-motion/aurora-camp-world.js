import {PaintedWorld,edge} from './painted-world.js';
import {glow} from './shared/world-motion.js';
import {sparks} from './forge-atmosphere.js';
import {steam} from './sanctuary-atmosphere.js';
import {cues,artists} from './aurora-camp-guests.js';
export const scene={id:'aurora-camp',source:'AuroraCampLobby',holes:[[180,290,710,350],[970,330,400,355],[1570,265,237,383]],patches:[
 {rect:[949,0,477,289],move:(u,v,t)=>[Math.sin(t*.3+v*4)*5*edge(u,v),Math.sin(t*.4+u*5)*3*edge(u,v)]},
 {rect:[120,3,586,181],move:(u,v,t)=>[Math.sin(t*.65+u*4)*3*edge(u,v),Math.sin(t*.75+u*3)*4*edge(u,v)]},
 {rect:[1195,690,184,158],move:(u,v,t)=>[Math.sin(t*3.6+v*5)*4*edge(u,v),Math.sin(t*4.5+u*5)*6*edge(u,v)]},
 {rect:[0,770,190,243],move:(u,v,t)=>[Math.sin(t*.9+v*3)*4*edge(u,v),Math.sin(t*.6+u*4)*2*edge(u,v)]}
]};
function atmosphere(c,t){for(const [x,y,r] of [[1246,786,87],[1427,878,36],[134,101,42],[1527,676,31],[1897,617,35],[60,626,38]])glow(c,x,y,r,'#ebc38d',.04+.021*Math.sin(t*2.3+x));sparks(c,1263,772,t,14,'#dfbc89');steam(c,1050,866,t,62);}
export const world={scene,cues,artists,seed:109,createMotion:()=>new PaintedWorld(scene,atmosphere)};
