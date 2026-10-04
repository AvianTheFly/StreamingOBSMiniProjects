import {ellipse,glow,TAU} from './shared/world-motion.js';
import {duck,leaf,moth,mushroom} from './world-ink.js';
import {cup,star,turtle} from './reef-ink.js';
export const cues=[
 {id:'boat',label:'Paper-boat delivery',life:12,weight:1,impact:.5,description:'A tiny paper boat carries a duck through the moonlit stream.'},
 {id:'mushroom',label:'Mushroom on an errand',life:12,weight:1,impact:.6,description:'A mushroom walks along the counter under a leaf umbrella.'},
 {id:'moths',label:'Moon moth visitors',life:11,weight:1.2,impact:.4,description:'Three pale moths investigate the moon and the hanging lanterns.'},
 {id:'tea',label:'Tea with wings',life:11,weight:.9,impact:.6,description:'A warm teacup drifts past, carried by two small leaves.'},
 {id:'frog',label:'One polite croak',life:9,weight:1,impact:.45,description:'A pond frog leaves a few quiet rings in the foreground water.'},
 {id:'stars',label:'Lantern constellation',life:10,weight:1.1,impact:.4,description:'Fireflies assemble into a glowing turtle, then wander away.'}
];
export const artists={
 boat(c,a){const x=1765+Math.sin(a*.38)*65,y=971+Math.sin(a*1.8)*2;duck(c,x,y-9,.33,a);c.fillStyle='#d9d9be';c.strokeStyle='#78988e';c.lineWidth=1;c.beginPath();c.moveTo(x-23,y);c.lineTo(x+23,y);c.lineTo(x+14,y+11);c.lineTo(x-14,y+11);c.closePath();c.fill();c.stroke();c.beginPath();c.moveTo(x-13,y);c.lineTo(x,y-13);c.lineTo(x+13,y);c.stroke();},
 mushroom(c,a){const x=320+a*82,y=971+Math.sin(a*8)*2;mushroom(c,x,y,a);c.strokeStyle='#637f6a';c.lineWidth=2;c.beginPath();c.moveTo(x+12,y+3);c.lineTo(x+17,y-31);c.stroke();leaf(c,x+12,y-33,28,'#7d9f78',-.2);},
 moths(c,a){for(let i=0;i<3;i++){const x=1198+Math.sin(a*.7+i*2)*110,y=132+Math.cos(a*.9+i)*44;glow(c,x,y,18,'#d7e6c5',.08);moth(c,x,y,7+i,a+i,'#d6dfc4');}},
 tea(c,a){const x=750+Math.sin(a*.3)*600,y=889+Math.sin(a*1.4)*13;cup(c,x,y,.75);for(const side of [-1,1])leaf(c,x+side*20,y-4,13,'#a3b69b',side*(.2+Math.sin(a*5)*.6));},
 frog(c,a){const x=1755,y=1003;for(let i=0;i<4;i++){const q=(a*.25+i*.25)%1;c.strokeStyle='#accfd3'+Math.round((1-q)*66).toString(16).padStart(2,'0');c.lineWidth=1;c.beginPath();c.ellipse(x,y,12+q*54,4+q*12,0,0,TAU);c.stroke();}c.save();c.translate(x,y-12);ellipse(c,0,0,15,9,'#789982');ellipse(c,-10,-5,7,5,'#aac0a0');ellipse(c,10,-5,7,5,'#aac0a0');ellipse(c,-10,-7,1.6,1.6,'#223b35');ellipse(c,10,-7,1.6,1.6,'#223b35');ellipse(c,0,5,7,4+Math.sin(a*4)*2,'#c6d0a7');c.restore();},
 stars(c,a){const formed=Math.sin(Math.min(1,a/10)*Math.PI),x=1372,y=756;for(let i=0;i<15;i++){const angle=i*TAU/15,rx=(80-46*formed),ry=(44-24*formed);glow(c,x+Math.cos(angle+a*.25)*rx,y+Math.sin(angle+a*.25)*ry,10,'#b2dcad',.2);star(c,x+Math.cos(angle+a*.25)*rx,y+Math.sin(angle+a*.25)*ry,2,'#d9e7b7',a);}if(a>2&&a<8){c.save();c.globalAlpha*=Math.sin((a-2)/6*Math.PI)*.5;turtle(c,x,y,24,'#bddbb2',a);c.restore();}}
};
