import {PaintedWorld,edge} from './painted-world.js';
import {glow,ellipse,hash,TAU} from './shared/world-motion.js';
import {cues,artists} from './sky-harbor-guests.js';
export const scene={id:'sky-harbor',source:'SkyHarborLobby',holes:[[58,287,573,298],[835,425,450,475],[1465,186,323,466]],patches:[
 {rect:[850,72,242,164],move:(u,v,t)=>[Math.sin(t*.6)*3*edge(u,v),Math.sin(t*.85)*4*edge(u,v)]},
 {rect:[699,8,155,378],move:(u,v,t)=>[Math.sin(t*.85+v)*8*v*edge(u,v),Math.cos(t*.7)*edge(u,v)]},
 {rect:[630,26,88,194],move:(u,v,t)=>[Math.sin(t*.75)*4*v*edge(u,v),Math.cos(t*.75)*edge(u,v)]},
 {rect:[0,540,186,200],move:(u,v,t)=>[Math.sin(t*.8+v*3)*5*edge(u,v),Math.sin(t+u*3)*2*edge(u,v)]}
]};
function atmosphere(c,t){
 for(const [x,y,r] of [[33,132,65],[671,144,49],[674,665,35],[1346,637,32],[1844,432,35],[1577,867,37]])glow(c,x,y,r,'#ffd197',.045+.021*Math.sin(t*1.5+x));
 c.save();c.strokeStyle='#c6f8fc44';c.lineWidth=1;for(let i=0;i<4;i++){c.beginPath();c.ellipse(1688,795,46+i*6,23+i*4,t*.17+i*.3,0,TAU);c.stroke();}c.restore();
 for(let i=0;i<13;i++){const x=858+hash(i+2)*480,y=295+Math.sin(t*.28+i)*18+hash(i+50)*98;glow(c,x,y,28,'#fff0cb',.008+.006*Math.sin(t*.7+i));}
}
export const world={scene,cues,artists,seed:73,createMotion:()=>new PaintedWorld(scene,atmosphere)};
