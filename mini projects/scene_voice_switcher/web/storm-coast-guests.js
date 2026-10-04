import {ellipse,glow,TAU} from './shared/world-motion.js';
import {umbrella,bottle,bird} from './travel-ink.js';
import {duck} from './world-ink.js';
import {star} from './reef-ink.js';
export const cues=[
 {id:'umbrella',label:'Very prepared duck',life:12,weight:1,impact:.6,description:'A duck takes an umbrella for a stroll along the counter.'},
 {id:'message',label:'Message in a bottle',life:11,weight:1.1,impact:.45,description:'A little sea-green bottle arrives with a letter inside.'},
 {id:'gulls',label:'Storm gulls',life:11,weight:1.2,impact:.4,description:'Three gulls take the long way around the storm.'},
 {id:'shells',label:'Shell castanets',life:10,weight:1,impact:.4,description:'A pair of shells on the counter try a little dance.'},
 {id:'lightning',label:'Distant sky scribble',life:9,weight:.8,impact:.5,description:'A soft distant lightning trace forms above the mountains.'},
 {id:'lifebuoy',label:'Tiny rescue service',life:11,weight:.9,impact:.55,description:'A little duck arrives carrying a sea-blue lifebuoy.'}
];
export const artists={
 umbrella(c,a){const x=316+a*27,y=841+Math.sin(a*7)*2;duck(c,x,y,.75,a);umbrella(c,x+7,y-34,a);},
 message(c,a){const x=1364+Math.sin(a*.6)*42,y=841-Math.sin(Math.min(1,a/11)*Math.PI)*17;bottle(c,x,y,a);for(let i=0;i<3;i++)star(c,x+Math.sin(a+i*2)*23,y-34-i*7,2,'#d4d1aa',a);},
 gulls(c,a){for(let i=0;i<3;i++)bird(c,812+a*40-i*33,145+Math.sin(a*.7+i)*22,10+i*2,a+i,'#dbded5');},
 shells(c,a){for(const side of [-1,1]){c.save();c.translate(319+side*26,837+Math.sin(a*4+side)*7);c.rotate(side*Math.sin(a*3)*.25);c.fillStyle='#ddd2b8';c.strokeStyle='#9d9b89';c.lineWidth=1;c.beginPath();c.moveTo(0,12);c.arc(0,0,17,Math.PI,TAU);c.closePath();c.fill();c.stroke();for(let i=0;i<5;i++){const angle=Math.PI+i*Math.PI/4;c.beginPath();c.moveTo(0,12);c.lineTo(Math.cos(angle)*16,Math.sin(angle)*16);c.stroke();}c.restore();}},
 lightning(c,a){c.save();c.globalAlpha*=.4;c.strokeStyle='#d0e7ed';c.lineWidth=2;c.beginPath();c.moveTo(1162,145);c.lineTo(1143,179);c.lineTo(1153,186);c.lineTo(1123,224);c.lineTo(1133,227);c.lineTo(1114,265);c.stroke();glow(c,1143,198,44,'#b4d4e7',.045);c.restore();},
 lifebuoy(c,a){const x=1330+a*10,y=840+Math.sin(a*5)*2;duck(c,x,y,.65,a);c.strokeStyle='#8ec1c9';c.lineWidth=5;c.beginPath();c.ellipse(x-15,y+5,19,12,.2,0,TAU);c.stroke();}
};
