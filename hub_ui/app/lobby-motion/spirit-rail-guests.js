import {ellipse,glow,TAU} from './shared/world-motion.js';
import {suitcase,ticket,train} from './travel-ink.js';
import {duck,leaf} from './world-ink.js';
import {star} from './reef-ink.js';
export const cues=[
 {id:'train',label:'Pocket express',life:12,weight:1,impact:.7,description:'A small spirit train rolls along the near track.'},
 {id:'luggage',label:'Luggage with plans',life:12,weight:1.1,impact:.5,description:'A little suitcase walks along the station counter.'},
 {id:'conductor',label:'Duck conductor',life:11,weight:1,impact:.55,description:'A conductor duck checks a tiny ticket by the brass bell.'},
 {id:'ticket',label:'Runaway ticket',life:10,weight:1.1,impact:.4,description:'A paper ticket catches the evening breeze.'},
 {id:'bell',label:'A silent little ding',life:9,weight:1,impact:.3,description:'Gold rings spread from the original brass station bell.'},
 {id:'leaves',label:'Autumn makes a turtle',life:10,weight:.9,impact:.45,description:'A handful of leaves circles together before drifting away.'}
];
export const artists={
 train(c,a){const x=1003+a*37,y=837+a*10;glow(c,x+20,y-15,38,'#c5dcc2',.07);train(c,x,y,.6+a*.015,a);for(let i=0;i<4;i++){c.save();c.globalAlpha*=.16;ellipse(c,x+18-i*7,y-35-i*13,7+i*3,5+i*3,'#cbd8ca');c.restore();}},
 luggage(c,a){suitcase(c,650+a*12,819+Math.sin(a*8)*2,a);},
 conductor(c,a){duck(c,650+Math.sin(a*.5)*19,806,.75,a,true);ticket(c,671,794,Math.sin(a)*.12);},
 ticket(c,a){const x=685+Math.sin(a*.45)*80,y=495+Math.sin(a*.8)*40;ticket(c,x,y,Math.sin(a)*.2);c.strokeStyle='#cbb88966';c.lineWidth=.8;c.beginPath();c.moveTo(x-20,y+6);c.quadraticCurveTo(x-31,y+23,x-52,y+20);c.stroke();},
 bell(c,a){for(let i=0;i<3;i++){const q=(a*.23+i*.33)%1;c.save();c.globalAlpha*=1-q;c.strokeStyle='#e3c48c';c.lineWidth=1;c.beginPath();c.ellipse(551,774,14+q*39,6+q*17,0,Math.PI,TAU);c.stroke();c.restore();}star(c,551,741,4,'#ecd19a',a);},
 leaves(c,a){const q=Math.sin(Math.min(1,a/10)*Math.PI);for(let i=0;i<12;i++){const theta=i*TAU/12+a*.3,x=1106+Math.cos(theta)*(83-49*q),y=823+Math.sin(theta)*(44-23*q);leaf(c,x,y,6,'#c49a69',theta);}if(a>2&&a<8){c.save();c.globalAlpha*=Math.sin((a-2)/6*Math.PI);leaf(c,1155,823,10,'#c49a69',0);for(const side of [-1,1])for(const vx of [-1,1])leaf(c,1106+vx*24,823+side*27,8,'#c49a69',side*vx*.7);c.restore();}}
};
