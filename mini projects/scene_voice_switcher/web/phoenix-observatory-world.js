import {PaintedWorld,edge} from './painted-world.js';
import {glow,TAU} from './shared/world-motion.js';
import {sparks} from './forge-atmosphere.js';
import {cues,artists} from './phoenix-observatory-guests.js';
export const scene={id:'phoenix-observatory',source:'PhoenixObservatoryLobby',holes:[[94,323,541,245],[825,445,430,460],[1465,203,313,480]],patches:[
 {rect:[425,20,108,216],move:(u,v,t)=>[Math.sin(t*.75+v)*6*v*edge(u,v),Math.cos(t*.8)*edge(u,v)]},
 {rect:[389,53,47,110],move:(u,v,t)=>[Math.sin(t*.8)*4*v*edge(u,v),Math.cos(t*.8)*edge(u,v)]},
 {rect:[858,290,198,213],move:(u,v,t)=>[Math.sin(t*2.9+v*4)*4*edge(u,v),Math.sin(t*3.5+u*4)*5*edge(u,v)]},
 {rect:[750,402,110,112],move:(u,v,t)=>[Math.sin(t*4+v*6)*3*edge(u,v),Math.sin(t*5+u*4)*5*edge(u,v)]},
 {rect:[1320,433,93,106],move:(u,v,t)=>[Math.sin(t*4+v*6)*3*edge(u,v),Math.sin(t*5+u*4)*5*edge(u,v)]}
]};
function atmosphere(c,t){
 for(const [x,y,r] of [[985,368,102],[801,472,59],[1368,480,58],[1266,746,34],[1570,802,32]]){glow(c,x,y,r,'#ffc587',.035+.018*Math.sin(t*4.3+x));sparks(c,x,y,t+x,6);}
 const points=[[947,44],[992,64],[1011,126],[1068,91],[1087,144],[1162,68],[1211,119],[1208,178],[1126,194],[1142,245]];for(let i=0;i<points.length;i++){const [x,y]=points[i];glow(c,x,y,9,'#e6c997',.1+.1*(1+Math.sin(t*.8+i))/2);}
 c.save();c.strokeStyle='#efc18944';c.lineWidth=1.2;c.beginPath();c.ellipse(985,368,57,24,t*.24,0,TAU);c.stroke();c.restore();
}
export const world={scene,cues,artists,seed:83,createMotion:()=>new PaintedWorld(scene,atmosphere)};
