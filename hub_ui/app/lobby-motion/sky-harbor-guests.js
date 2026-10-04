import {ellipse,glow,TAU} from './shared/world-motion.js';
import {blimp,plane,lantern,bird} from './travel-ink.js';
import {duck} from './world-ink.js';
import {cup,star} from './reef-ink.js';
export const cues=[
 {id:'airship',label:'Little cargo airship',life:12,weight:1,impact:.6,description:'A small brass airship passes the floating city.'},
 {id:'paper',label:'Paper-plane post',life:11,weight:1.1,impact:.45,description:'A paper plane takes the scenic route between the clouds.'},
 {id:'pilot',label:'Compass inspector',life:12,weight:.9,impact:.6,description:'A little pilot duck checks the map on your counter.'},
 {id:'teaballoon',label:'Tea by air',life:11,weight:.9,impact:.55,description:'A teacup sails beneath a tiny lantern balloon.'},
 {id:'swallows',label:'Cloud swallows',life:11,weight:1.2,impact:.4,description:'Three birds glide above the harbor.'},
 {id:'compass',label:'A wandering bearing',life:10,weight:1.1,impact:.35,description:'A gold bearing wanders around the original compass map.'}
];
export const artists={
 airship(c,a){blimp(c,869+a*33,246+Math.sin(a*.7)*12,.64,a);},
 paper(c,a){const x=882+a*42,y=339+Math.sin(a*.8)*27;plane(c,x,y,.78,Math.cos(a*.8)*.17);},
 pilot(c,a){const x=535+a*48,y=989+Math.sin(a*7)*2;duck(c,x,y,.75,a,true);c.strokeStyle='#d8b579';c.lineWidth=1;c.beginPath();c.arc(x+19,y-19,8,0,TAU);c.stroke();},
 teaballoon(c,a){const x=1275+Math.sin(a*.4)*65,y=277+Math.cos(a*.7)*13;lantern(c,x,y-38,.9);c.strokeStyle='#aa9871';c.lineWidth=1;c.beginPath();c.moveTo(x-7,y-24);c.lineTo(x-8,y-4);c.moveTo(x+7,y-24);c.lineTo(x+8,y-4);c.stroke();cup(c,x,y,.55);},
 swallows(c,a){for(let i=0;i<3;i++)bird(c,878+a*35-i*31,316+Math.sin(a*.6+i)*18,9+i*2,a+i);},
 compass(c,a){c.save();c.strokeStyle='#e1c49299';c.lineWidth=1.5;c.setLineDash([3,5]);c.beginPath();c.ellipse(974,977,119,38,0,0,Math.min(1,a/5)*TAU);c.stroke();c.setLineDash([]);const x=974+Math.cos(a*.7)*119,y=977+Math.sin(a*.7)*38;glow(c,x,y,17,'#e8c17f',.14);star(c,x,y,6,'#e9d098',a);c.restore();}
};
