import {PaintedWorld,edge} from './painted-world.js';
import {sanctuaryAmbience} from './sanctuary-atmosphere.js';
import {cues,artists} from './sanctuary-guests.js';
const lantern=phase=>(u,v,t)=>[Math.sin(t*.85+phase)*5*v*edge(u,v),Math.sin(t*.85+phase)*edge(u,v)];
export const scene={id:'sanctuary',source:'SanctuaryLobby',holes:[[215,242,577,282],[865,340,475,470],[1510,220,215,431]],patches:[
 {rect:[251,42,72,125],move:lantern(0)},
 {rect:[754,127,66,99],move:lantern(1)},
 {rect:[1610,40,80,135],move:lantern(2)},
 {rect:[235,17,204,75],move:(u,v,t)=>[Math.sin(t*.8+u*3)*5*edge(u,v),Math.sin(t*1.1+u*4)*3*edge(u,v)]},
 {rect:[189,789,111,103],move:(u,v,t)=>[Math.sin(t*.55)*2*edge(u,v),Math.sin(t*.9)*3*edge(u,v)]},
 {rect:[1490,865,152,115],move:(u,v,t)=>[Math.sin(t*.55+2)*2*edge(u,v),Math.sin(t*.9+1)*3*edge(u,v)]}
]};
export const world={scene,cues,artists,createMotion:()=>new PaintedWorld(scene,sanctuaryAmbience)};
