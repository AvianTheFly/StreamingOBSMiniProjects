import {ellipse,glow,TAU} from './shared/world-motion.js';
import {star} from './reef-ink.js';
import {leaf} from './world-ink.js';
export const cues=[
 {id:'sneeze',label:'A very small dragon sneeze',life:9,weight:1,impact:.5,description:'The original blue dragon gets a little cloud of gold sparks.'},
 {id:'mug',label:'A mug with somewhere to be',life:12,weight:1,impact:.6,description:'A tiny wooden mug takes a stroll along the table.'},
 {id:'hat',label:'The wizard left something',life:10,weight:1.1,impact:.4,description:'A few stars escape from the original wizard hat.'},
 {id:'quill',label:'Quill on a break',life:11,weight:1,impact:.45,description:'A little feather floats over the parchment.'},
 {id:'dice',label:'Lucky dice',life:10,weight:1.1,impact:.5,description:'Two ivory dice bounce together on the counter.'},
 {id:'coins',label:'Coins rehearsing a spell',life:10,weight:1,impact:.4,description:'A handful of copper coins briefly orbits a small star.'}
];
export const artists={
 sneeze(c,a){for(let i=0;i<12;i++){const q=(a*.24+i*.06)%1,x=349+q*80,y=812-Math.sin(q*Math.PI)*28-i*1.2;c.save();c.globalAlpha*=Math.sin(q*Math.PI)*.6;star(c,x,y,2+i%3,'#eac58c',a+i);c.restore();}},
 mug(c,a){const x=1373+a*12,y=949+Math.sin(a*8)*3;c.save();c.translate(x,y);c.fillStyle='#9f754c';c.strokeStyle='#dbc194';c.lineWidth=1.4;c.beginPath();c.roundRect(-12,-21,24,28,4);c.fill();c.stroke();for(const dx of [-6,3]){c.beginPath();c.moveTo(dx,-18);c.lineTo(dx,5);c.stroke();}ellipse(c,0,-20,12,4,'#ecdec0');c.beginPath();c.arc(15,-7,7,-Math.PI/2,Math.PI/2);c.stroke();for(const side of [-1,1]){c.beginPath();c.moveTo(side*7,7);c.lineTo(side*10+Math.sin(a*8+side)*4,14);c.stroke();}c.restore();},
 hat(c,a){for(let i=0;i<7;i++){const q=(a*.16+i*.13)%1,x=1667+Math.sin(a+i)*q*35,y=791-q*82;glow(c,x,y,9,'#b4d9e4',.1);star(c,x,y,3,'#dbc799',a+i);}},
 quill(c,a){const x=622+Math.sin(a*.4)*80,y=858+Math.sin(a*.7)*19;c.save();c.translate(x,y);c.rotate(-.5+Math.sin(a)*.2);leaf(c,0,0,25,'#d1c6a5',0);c.strokeStyle='#ebdebd';c.lineWidth=1.4;c.beginPath();c.moveTo(-31,0);c.lineTo(23,0);c.stroke();c.restore();},
 dice(c,a){for(let i=0;i<2;i++){const x=749+i*34,y=979-Math.abs(Math.sin(a*2+i))*23;c.save();c.translate(x,y);c.rotate(Math.sin(a*2+i)*.2);c.fillStyle='#d9cfb1';c.strokeStyle='#a18b68';c.lineWidth=1;c.beginPath();c.roundRect(-11,-11,22,22,3);c.fill();c.stroke();for(const [dx,dy] of i?[[-5,-5],[5,5],[0,0]]:[[-5,-5],[5,5]])ellipse(c,dx,dy,1.8,1.8,'#685d50');c.restore();}},
 coins(c,a){for(let i=0;i<5;i++){const theta=a*.9+i*TAU/5,x=486+Math.cos(theta)*40,y=941+Math.sin(theta)*14;ellipse(c,x,y,7,4+Math.abs(Math.sin(a+i))*3,'#c5a06b');c.strokeStyle='#eed099';c.lineWidth=.8;c.beginPath();c.ellipse(x,y,4,2,0,0,TAU);c.stroke();}star(c,486,941,4,'#dfc69a',a);}
};
