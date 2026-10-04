import {ellipse,glow,TAU} from './shared/world-motion.js';
import {duck,hammer,crystal,moth} from './world-ink.js';
import {sparks} from './forge-atmosphere.js';
import {star} from './reef-ink.js';
export const cues=[
 {id:'hammer',label:'Unsupervised hammer',life:9,weight:1,impact:.65,description:'A hammer gets three tiny practice swings in, then floats away.'},
 {id:'duck',label:'Apprentice duck',life:12,weight:1,impact:.6,description:'A duck in a smithing helmet carries a crystal across the workbench.'},
 {id:'runes',label:'The wall wakes up',life:9,weight:1.2,impact:.35,description:'An amber spiral travels around the forge’s original ram emblem.'},
 {id:'crystals',label:'Crystal chimes',life:10,weight:1.2,impact:.5,description:'Little crystals rise from the workbench and orbit one another.'},
 {id:'moth',label:'Ember moth',life:11,weight:1.1,impact:.4,description:'A glowing moth investigates the hanging fire bowl.'},
 {id:'forged',label:'A very small masterpiece',life:10,weight:.8,impact:.65,description:'Three sparks turn into a tiny golden duck above the tools.'}
];
export const artists={
 hammer(c,a){const strike=Math.max(0,Math.sin(a*2.4));hammer(c,1545,805-Math.sin(a)*13,-.9+strike*1.1,.8);if(strike>.65)sparks(c,1570,826,a*3,14);},
 duck(c,a){const x=1440+a*27,y=842+Math.sin(a*7)*2;duck(c,x,y,.85,a,true);crystal(c,x-18,y-12,12,'#a9f3ef',-.3);},
 runes(c,a){c.save();c.strokeStyle='#e5b46d99';c.lineWidth=1.5;c.beginPath();for(let i=0;i<100;i++){const q=i/99*Math.min(1,a/5),angle=q*TAU*2,r=8+q*83;c.lineTo(957+Math.cos(angle)*r,176+Math.sin(angle)*r);}c.stroke();for(let i=0;i<5;i++)star(c,957+Math.cos(a*.7+i*1.26)*76,176+Math.sin(a*.7+i*1.26)*65,3,'#f3d098',a);c.restore();},
 crystals(c,a){for(let i=0;i<4;i++){const theta=a*.7+i*TAU/4,x=290+Math.cos(theta)*42,y=749-Math.sin(Math.min(1,a/4)*Math.PI)*45+Math.sin(theta)*13;glow(c,x,y,18,'#8ee8ed',.18);crystal(c,x,y,9+i*2,'#92d7e6',Math.sin(a+i)*.3);}},
 moth(c,a){const x=439+Math.sin(a*.85)*88,y=186+Math.cos(a*1.5)*26;glow(c,x,y,30,'#e2bc76',.15);moth(c,x,y,11,a,'#ddbe85');},
 forged(c,a){const q=Math.max(0,Math.min(1,(a-2)/3)),x=1544,y=776-q*54;for(let i=0;i<10;i++){const theta=i*.63+a;star(c,x+Math.cos(theta)*(42-25*q),y+Math.sin(theta)*(18+18*q),2,'#e6c38a',a);}if(a>2){c.save();c.globalAlpha*=q;duck(c,x,y,.55,a);c.restore();}}
};
