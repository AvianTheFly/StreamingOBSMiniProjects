import {ellipse,glow,TAU} from './shared/world-motion.js';
import {duck} from './world-ink.js';
import {star} from './reef-ink.js';
export const cues=[
 {id:'coin',label:'Coin on an adventure',life:12,weight:1,impact:.4,description:'A copper coin grows little feet and walks along the counter.'},
 {id:'pixels',label:'Pixel visitors',life:11,weight:1.1,impact:.6,description:'Three small game creatures cross the rainy neon window.'},
 {id:'gamer',label:'Duck chasing a high score',life:11,weight:1,impact:.55,description:'A little duck in a game cap patrols the counter.'},
 {id:'joystick',label:'Joystick warm-up',life:10,weight:1.1,impact:.4,description:'A spare joystick tries a few practice moves.'},
 {id:'marbles',label:'Bonus round',life:10,weight:1.1,impact:.45,description:'A few neon marbles orbit the counter lantern.'},
 {id:'prize',label:'The claw found a star',life:11,weight:.9,impact:.5,description:'A tiny prize claw drops a glowing star onto the counter.'}
];
export const artists={
 coin(c,a){const x=449+a*24,y=806+Math.sin(a*8)*2;ellipse(c,x,y-8,10,12,'#c9a477');c.strokeStyle='#ead2a0';c.lineWidth=1;c.beginPath();c.ellipse(x,y-8,6,8,0,0,TAU);c.stroke();for(const side of [-1,1]){c.beginPath();c.moveTo(x+side*4,y+3);c.lineTo(x+side*8+Math.sin(a*8+side)*3,y+10);c.stroke();}},
 pixels(c,a){const shape=['00100100','01111110','11011011','11111111','10100101','00100100'];for(let i=0;i<3;i++){const x=1041+a*24-i*41,y=269+Math.sin(a*3+i)*5;c.fillStyle=['#8fbcbd','#c8a3ce','#d3be83'][i];for(let row=0;row<shape.length;row++)for(let col=0;col<shape[row].length;col++)if(shape[row][col]==='1')c.fillRect(x+col*3,y+row*3,2.5,2.5);}},
 gamer(c,a){const x=697+a*12,y=796+Math.sin(a*7)*2;duck(c,x,y,.7,a);c.fillStyle='#826a94';c.fillRect(x-3,y-16,20,5);ellipse(c,x+7,y-18,9,5,'#a29bb4');},
 joystick(c,a){const x=934,y=811;c.save();c.translate(x,y);c.fillStyle='#526f79';c.beginPath();c.roundRect(-23,-3,46,13,5);c.fill();c.strokeStyle='#bed0bd';c.lineWidth=3;c.beginPath();c.moveTo(0,-3);c.lineTo(Math.sin(a*3)*11,-26);c.stroke();ellipse(c,Math.sin(a*3)*11,-28,7,7,'#bb8faf');ellipse(c,13,1,3,2,'#dec69d');c.restore();},
 marbles(c,a){for(let i=0;i<4;i++){const q=a*.8+i*TAU/4,x=282+Math.cos(q)*48,y=780+Math.sin(q)*19,col=['#a6c7c4','#d0b18a','#ba9ccc','#9ea9ce'][i];glow(c,x,y,15,col,.12);ellipse(c,x,y,5,5,col);}},
 prize(c,a){const x=821+Math.sin(a*.45)*18,y=654+Math.min(a,7)*20;c.strokeStyle='#a3bfc0';c.lineWidth=1.5;c.beginPath();c.moveTo(x,595);c.lineTo(x,y-20);for(const side of [-1,1]){c.moveTo(x,y-20);c.lineTo(x+side*12,y-9);c.lineTo(x+side*7,y+2);}c.stroke();star(c,x,y+10,8,'#d9c792',a*.3);}
};
