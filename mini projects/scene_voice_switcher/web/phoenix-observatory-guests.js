import {ellipse,glow,TAU} from './shared/world-motion.js';
import {duck} from './world-ink.js';
import {bird} from './travel-ink.js';
import {cup,star} from './reef-ink.js';
export const cues=[
 {id:'comet',label:'Comet with tea',life:11,weight:1,impact:.5,description:'A tiny teacup leaves a warm comet trail across the sky.'},
 {id:'astronomer',label:'Duck astronomer',life:12,weight:1,impact:.6,description:'A duck in a starry hat goes stargazing along the counter.'},
 {id:'phoenix',label:'Pocket phoenix',life:11,weight:1.1,impact:.45,description:'A small amber phoenix takes a slow lap above the armillary.'},
 {id:'planets',label:'Planets on parade',life:10,weight:1.2,impact:.4,description:'Little planets orbit the brass instrument on the left.'},
 {id:'wish',label:'A passing wish',life:10,weight:1,impact:.35,description:'A gold star travels beneath the painted phoenix constellation.'},
 {id:'moon',label:'A curious little moon',life:11,weight:.9,impact:.5,description:'A smiling moon peeks around the telescope.'}
];
export const artists={
 comet(c,a){const x=737+a*48,y=189+Math.sin(a*.4)*28;for(let i=0;i<9;i++){c.save();c.globalAlpha*=1-i/10;star(c,x-i*12,y+Math.sin(i*.4+a)*4,2.8,'#e4c78e',a);c.restore();}cup(c,x,y,.45);},
 astronomer(c,a){const x=335+a*47,y=980+Math.sin(a*7)*2;duck(c,x,y,.75,a);c.fillStyle='#456c82';c.beginPath();c.moveTo(x-4,y-13);c.lineTo(x+8,y-47);c.lineTo(x+24,y-13);c.fill();star(c,x+10,y-29,3,'#dcc58c',a*.1);},
 phoenix(c,a){const x=998+Math.sin(a*.5)*144,y=269+Math.cos(a*.65)*38;glow(c,x,y,28,'#e3ad6f',.1);bird(c,x,y,18,a,'#daa56a');for(let i=0;i<3;i++){c.strokeStyle='#d5ad7388';c.lineWidth=1.2;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x-9,y+14,x-15+i*7,y+29);c.stroke();}},
 planets(c,a){for(let i=0;i<4;i++){const angle=a*.7+i*1.6,x=142+Math.cos(angle)*67,y=743+Math.sin(angle)*28;ellipse(c,x,y,6+i,6+i,['#bdc8bb','#ccaf78','#99c0c5','#b1a3bd'][i]);if(i===2){c.strokeStyle='#cbd3b1';c.lineWidth=1;c.beginPath();c.ellipse(x,y,14,4,-.4,0,TAU);c.stroke();}}},
 wish(c,a){const x=852+a*38,y=268-Math.sin(a*.4)*52;glow(c,x,y,24,'#e8d49e',.1);star(c,x,y,8,'#e8d49e',a*.4);for(let i=0;i<5;i++)star(c,x-i*9,y+i*2,1.5,'#d5b882',a);},
 moon(c,a){const x=1821+Math.sin(a*.5)*24,y=769+Math.cos(a*.6)*13;glow(c,x,y,32,'#d9d3b1',.09);ellipse(c,x,y,17,17,'#d8d4b8');ellipse(c,x-7,y-8,3,3,'#c1c1a8');ellipse(c,x+7,y+6,4,4,'#c6c6ac');ellipse(c,x-5,y-2,1.5,1.5,'#4e686a');ellipse(c,x+5,y-2,1.5,1.5,'#4e686a');c.strokeStyle='#647c78';c.lineWidth=1;c.beginPath();c.arc(x,y+2,5,.2,Math.PI-.2);c.stroke();}
};
