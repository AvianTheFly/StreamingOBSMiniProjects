// Coordinates follow the existing forge painting, normalized to HD.
import {PaintedWorld,edge} from './painted-world.js';
import {forgeAmbience} from './forge-atmosphere.js';
import {cues,artists} from './forge-guests.js';
const sway=(amount,rate,phase=0)=>(u,v,t)=>[Math.sin(t*rate+v*1.3+phase)*amount*v*edge(u,v),Math.cos(t*rate+phase)*edge(u,v)];
export const scene={id:'forge',source:'ForgeLobby',holes:[[125,304,575,280],[830,450,460,460],[1463,203,317,470]],patches:[
 {rect:[630,20,131,222],move:sway(9,.85)},
 {rect:[1306,14,137,272],move:sway(8,.75,2)},
 {rect:[292,5,291,178],move:(u,v,t)=>[Math.sin(t*.65)*3*v*edge(u,v),Math.sin(t*3.7+u*5)*5*edge(u,v)]},
 {rect:[1810,492,110,190],move:(u,v,t)=>[Math.sin(t*5+v*9)*4*edge(u,v),Math.sin(t*4+u*5)*7*edge(u,v)]}
]};
export const world={scene,cues,artists,createMotion:()=>new PaintedWorld(scene,forgeAmbience)};
