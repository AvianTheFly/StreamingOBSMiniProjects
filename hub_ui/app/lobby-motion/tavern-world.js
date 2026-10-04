import {PaintedWorld,edge} from './painted-world.js';
import {glow} from './shared/world-motion.js';
import {steam} from './sanctuary-atmosphere.js';
import {cues,artists} from './tavern-guests.js';
export const scene={id:'tavern',source:'TavernWorldLobby',holes:[[154,282,699,311],[860,350,435,570],[1515,180,311,451]],patches:[
 {rect:[145,713,213,208],move:(u,v,t)=>[Math.sin(t*.8)*2*edge(u,v),Math.sin(t*1.1+u)*3*edge(u,v)]},
 {rect:[105,13,142,237],move:(u,v,t)=>[Math.sin(t*.7+v)*5*v*edge(u,v),Math.cos(t*.7)*edge(u,v)]},
 {rect:[992,0,346,172],move:(u,v,t)=>[Math.sin(t*.55)*2*v*edge(u,v),Math.sin(t*3.5+u*4)*2*edge(u,v)]},
 {rect:[482,730,78,128],move:(u,v,t)=>[Math.sin(t*.9+v)*5*(1-v)*edge(u,v),Math.sin(t*.6)*edge(u,v)]},
 {rect:[1558,745,166,178],move:(u,v,t)=>[Math.sin(t*.7)*2*edge(u,v),Math.sin(t)*2*edge(u,v)]}
]};
function atmosphere(c,t){for(const [x,y,r] of [[1128,92,116],[399,846,45],[312,689,33],[746,695,31],[1846,858,38],[88,289,35]])glow(c,x,y,r,'#ffc385',.04+.02*Math.sin(t*2.7+x));steam(c,636,849,t,59);steam(c,1308,869,t+1,53);}
export const world={scene,cues,artists,seed:97,createMotion:()=>new PaintedWorld(scene,atmosphere)};
