// Assembly of the four independently composed paintings; no inherited room mesh.
import {PaintedWorld,edge} from './painted-world.js';
import {habitatDesigns} from './habitat-designs.js';
import {habitatAmbience} from './habitat-atmosphere.js';
const sway=(amount,rate)=>(u,v,t)=>[Math.sin(t*rate+v*2)*amount*v*edge(u,v),Math.cos(t*rate+u*3)*amount*.3*edge(u,v)];
const patches={
 'aurora-camp':[[[880,10,470,335],sway(1.8,.7)],[[1390,785,140,145],sway(2,3)],[[495,85,75,280],sway(1.3,.6)]],
 sanctuary:[[[710,200,240,240],sway(1,.5)],[[510,440,410,190],sway(1,.8)],[[1710,370,150,200],sway(1.5,.6)]],
 forge:[[[1635,140,170,390],sway(2.8,2.3)],[[1020,0,115,255],sway(2,.6)],[[1380,40,100,370],sway(1.5,.7)]],
 'phoenix-observatory':[[[345,0,560,350],sway(2,.65)],[[805,375,190,170],sway(1.5,.8)],[[1430,615,70,190],sway(1,.5)]]
};
export function habitatWorld(id){
 const d=habitatDesigns[id],scene={id,source:d.source,artUrl:`./art/${d.art}.png`,holes:[d.screen,d.camera,d.chat],adaptiveScreen:true,residents:false,patches:patches[id].map(([rect,move])=>({rect,move}))};
 return {scene,cues:[],artists:{},seed:d.seed,createMotion:()=>new PaintedWorld(scene,(c,t)=>habitatAmbience(c,t,id))};
}
