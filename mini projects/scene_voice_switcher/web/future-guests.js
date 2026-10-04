import {ellipse,glow,TAU} from './shared/world-motion.js';
import {duck} from './world-ink.js';
import {cup,star,bubble} from './reef-ink.js';
export const cues=[
 {id:'coffee',label:'Coffee from orbit',life:11,weight:1,impact:.55,description:'A small flying saucer arrives with a warm cup.'},
 {id:'bot',label:'Maintenance bot on patrol',life:12,weight:1.1,impact:.5,description:'A little round service robot checks the bar lights.'},
 {id:'toast',label:'Satellite toast',life:11,weight:1,impact:.45,description:'A piece of toast with solar panels coasts past the window.'},
 {id:'astronaut',label:'Duck in zero gravity',life:11,weight:.9,impact:.6,description:'A duck with a bubble helmet enjoys the view.'},
 {id:'marbles',label:'Gravity took a break',life:10,weight:1.2,impact:.4,description:'Three luminous marbles orbit above the counter.'},
 {id:'comet',label:'A little space postcard',life:10,weight:1.1,impact:.35,description:'A small comet takes a slow path behind the glass.'}
];
export const artists={
 coffee(c,a){const x=1328+Math.sin(a*.5)*43,y=796+Math.sin(a*.7)*11;cup(c,x,y-10,.55);ellipse(c,x,y+7,34,8,'#799fa5');ellipse(c,x,y+4,24,5,'#b5c8bd');for(let i=0;i<5;i++){const theta=i*Math.PI/4;ellipse(c,x+Math.cos(theta)*26,y+7+Math.sin(theta)*3,2,1.5,'#b4e8d7');}},
 bot(c,a){const x=519+a*28,y=1000+Math.sin(a*7)*2;ellipse(c,x,y,17,16,'#7faaa9');ellipse(c,x,y-5,13,6,'#274c5a');ellipse(c,x-5,y-5,2,2,'#b7e8dd');ellipse(c,x+5,y-5,2,2,'#b7e8dd');c.strokeStyle='#b3c5bc';c.lineWidth=2;c.beginPath();c.moveTo(x,y-16);c.lineTo(x,y-25);c.stroke();ellipse(c,x,y-27,2,2,'#deb980');for(const dx of [-12,12])ellipse(c,x+dx,y+13,5,5,'#516f77');},
 toast(c,a){const x=976+a*28,y=264+Math.sin(a*.6)*19;c.save();c.translate(x,y);c.rotate(Math.sin(a*.4)*.15);c.fillStyle='#9a784f';c.beginPath();c.roundRect(-13,-15,26,32,7);c.fill();c.fillStyle='#d5bb87';c.beginPath();c.roundRect(-10,-12,20,26,5);c.fill();c.fillStyle='#568c9e';for(const side of [-1,1]){c.fillRect(side>0?16:-37,-9,21,18);c.strokeStyle='#a2c6c8';c.lineWidth=1;c.strokeRect(side>0?16:-37,-9,21,18);}ellipse(c,-4,0,1.5,1.5,'#5c654f');ellipse(c,4,0,1.5,1.5,'#5c654f');c.restore();},
 astronaut(c,a){const x=1309+Math.sin(a*.5)*65,y=744+Math.sin(a*.6)*15;duck(c,x,y,.6,a);bubble(c,x+5,y-7,27,.6);c.strokeStyle='#d2d7c1';c.lineWidth=1;c.beginPath();c.moveTo(x-16,y+11);c.quadraticCurveTo(x-43,y+33,x-59,y+14);c.stroke();},
 marbles(c,a){for(let i=0;i<3;i++){const q=a*.8+i*TAU/3,x=706+Math.cos(q)*54,y=954+Math.sin(q)*15,color=['#a4dadd','#d5b787','#b3acd3'][i];glow(c,x,y,15,color,.15);ellipse(c,x,y,8,8,color);ellipse(c,x-2,y-3,2,2,'#ecf0d9');}},
 comet(c,a){const x=945+a*37,y=302+Math.sin(a*.4)*12;star(c,x,y,5,'#c3dfdc',a);for(let i=1;i<9;i++){c.save();c.globalAlpha*=1-i/10;ellipse(c,x-i*8,y+i*.5,1.5,1.5,'#b2d6dc');c.restore();}}
};
