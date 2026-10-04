import {ellipse,glow,TAU} from './shared/world-motion.js';
import {duck,moth} from './world-ink.js';
import {lantern} from './travel-ink.js';
import {star} from './reef-ink.js';
export const cues=[
 {id:'marshmallows',label:'Marshmallow hikers',life:12,weight:1,impact:.55,description:'Three marshmallows wander across the stone table.'},
 {id:'kettle',label:'Starlight from the kettle',life:10,weight:1.1,impact:.4,description:'A few little stars rise from your original camp kettle.'},
 {id:'moths',label:'Firelight moths',life:11,weight:1.2,impact:.4,description:'Two warm-colored moths make a slow lap around the fire.'},
 {id:'camper',label:'Duck under the stars',life:11,weight:1,impact:.5,description:'A small duck takes a look at the northern lights.'},
 {id:'constellation',label:'A tiny northern constellation',life:10,weight:1.1,impact:.35,description:'A few stars sketch a quiet little mountain in the sky.'},
 {id:'lantern',label:'Lantern on a night walk',life:12,weight:.9,impact:.45,description:'A brass lantern takes a very short walk along the camp table.'}
];
export const artists={
 marshmallows(c,a){for(let i=0;i<3;i++){const x=827+a*17-i*29,y=927+Math.sin(a*8+i)*2;c.fillStyle='#ded9c2';c.strokeStyle='#a7a58c';c.lineWidth=1;c.beginPath();c.roundRect(x-7,y-18,14,17,4);c.fill();c.stroke();ellipse(c,x-2,y-11,1,1,'#607777');ellipse(c,x+3,y-11,1,1,'#607777');for(const side of [-1,1]){c.beginPath();c.moveTo(x+side*3,y);c.lineTo(x+side*5+Math.sin(a*8+i+side)*2,y+6);c.stroke();}}},
 kettle(c,a){for(let i=0;i<8;i++){const q=(a*.14+i*.1)%1,x=1091+Math.sin(a+i)*q*25,y=824-q*76;c.save();c.globalAlpha*=Math.sin(q*Math.PI);star(c,x,y,3,'#d6d2a8',a+i);c.restore();}},
 moths(c,a){for(let i=0;i<2;i++){const x=1258+Math.sin(a*.7+i*2)*65,y=735+Math.cos(a*.9+i)*33;glow(c,x,y,14,'#d8bc8e',.09);moth(c,x,y,7+i,a+i,'#c8b793');}},
 camper(c,a){const x=577+a*15,y=897+Math.sin(a*7)*2;duck(c,x,y,.7,a);c.strokeStyle='#9caaa0';c.lineWidth=4;c.beginPath();c.moveTo(x-2,y-4);c.lineTo(x+17,y-4);c.stroke();c.lineWidth=2;c.beginPath();c.moveTo(x+13,y-4);c.lineTo(x+10,y+11);c.stroke();},
 constellation(c,a){const points=[[1190,130],[1240,78],[1270,119],[1304,93],[1341,142]],progress=Math.min(1,a/5);c.strokeStyle='#c7e0c577';c.lineWidth=1;c.beginPath();for(let i=0;i<points.length;i++){if(i/(points.length-1)>progress)break;c.lineTo(...points[i]);star(c,...points[i],3,'#d7dec0',a);}c.stroke();},
 lantern(c,a){const x=1380+Math.sin(a*.4)*45,y=916+Math.sin(a*8)*2;glow(c,x,y,25,'#d9bd88',.11);lantern(c,x,y,.8,'#dfc899');c.strokeStyle='#a49471';c.lineWidth=1;for(const side of [-1,1]){c.beginPath();c.moveTo(x+side*5,y+23);c.lineTo(x+side*9+Math.sin(a*8+side)*3,y+29);c.stroke();}}
};
