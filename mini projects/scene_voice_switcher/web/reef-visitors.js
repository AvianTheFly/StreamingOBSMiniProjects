import {ellipse,glow,hash,TAU} from './shared/world-motion.js';
import {bubble,fish,turtle,star} from './reef-ink.js';
export function teapot(c,a,e){
 const direction=Math.floor(e.seed)%2?1:-1,x=(direction===1?230:1590)+direction*a*108,y=165+Math.sin(a*.6)*23;
 c.save();c.translate(x,y);c.scale(direction,1);ellipse(c,0,0,39,23,'#aa824b');c.strokeStyle='#e8bd75';c.lineWidth=3;c.beginPath();c.ellipse(0,0,39,23,0,0,TAU);c.stroke();ellipse(c,0,-22,20,5,'#d5aa67');ellipse(c,0,-28,6,6,'#af945e');
 c.strokeStyle='#d4b278';c.lineWidth=7;c.beginPath();c.arc(-38,-2,20,Math.PI*.4,Math.PI*1.6);c.stroke();c.fillStyle='#c39b60';c.beginPath();c.moveTo(26,-9);c.lineTo(54,-23);c.lineTo(63,-34);c.lineTo(70,-29);c.lineTo(62,-8);c.lineTo(33,10);c.fill();
 for(const px of [-17,4]){ellipse(c,px,0,8,8,'#8cffff99');c.strokeStyle='#f2d495';c.lineWidth=2;c.beginPath();c.arc(px,0,9,0,TAU);c.stroke();}
 c.strokeStyle='#b6a372';c.lineWidth=5;c.beginPath();c.moveTo(0,-22);c.lineTo(0,-43);c.lineTo(15,-43);c.stroke();c.save();c.translate(-62,2);c.rotate(a*16);c.fillStyle='#d9cda3';c.fillRect(-2,-15,4,30);c.restore();c.restore();
 for(let i=0;i<7;i++){const age=(a+i*.34)%2.8;bubble(c,x-direction*(55+age*28),y+8-age*23,2+age*1.7,.6*(1-age/2.8));}
}
export function diver(c,a,e){
 const dir=Math.floor(e.seed)%2?1:-1,x=(dir===1?300:1510)+dir*a*100,y=167+Math.sin(a*.9)*30;
 c.save();c.translate(x,y);c.scale(dir,1);ellipse(c,-2,7,22,14,'#e9c663');ellipse(c,11,-10,12,12,'#f6db85');c.fillStyle='#c99442';c.beginPath();c.moveTo(19,-13);c.lineTo(33,-7);c.lineTo(21,-3);c.fill();ellipse(c,15,-13,2,2,'#18313b');ellipse(c,-5,4,12,6,'#c69a47');
 c.fillStyle='#a2f5eb12';c.beginPath();c.arc(10,-10,21,0,TAU);c.fill();bubble(c,10,-10,21);c.strokeStyle='#9fd3c8';c.lineWidth=3;c.beginPath();c.moveTo(-7,13);c.lineTo(10,24);c.lineTo(21,24);c.stroke();c.restore();
 for(let i=0;i<4;i++){const q=(a+i*.6)%2;bubble(c,x-dir*(15+q*14),y-30-q*19,2+q,.5*(1-q/2));}
}
export function manta(c,a,e){
 const dir=Math.floor(e.seed)%2?1:-1,x=(dir===1?240:1560)+dir*a*105,y=158+Math.sin(a*.5)*33,flap=Math.sin(a*1.65)*12;
 c.save();c.translate(x,y);c.scale(dir,1);c.fillStyle='#71caca55';c.strokeStyle='#b5f4e2aa';c.lineWidth=1.5;c.beginPath();c.moveTo(34,0);c.bezierCurveTo(16,-16,-20,-25,-62,-48+flap);c.quadraticCurveTo(-32,-4,-9,0);c.quadraticCurveTo(-32,4,-62,48-flap);c.bezierCurveTo(-20,25,16,16,34,0);c.fill();c.stroke();c.beginPath();c.moveTo(-10,0);c.bezierCurveTo(-35,0,-49,6,-93,Math.sin(a*2)*9);c.stroke();ellipse(c,20,-5,2,2,'#edfff1');ellipse(c,20,5,2,2,'#edfff1');c.restore();
}
export function jelly(c,a,e){
 for(let i=0;i<3;i++){const x=390+i*255+(hash(e.seed)-.5)*130+Math.sin(a*.8+i)*17,y=630-a*49+i*16,r=16+i*3,color=['#83e5d7','#caacee','#f5d398'][i];
  for(let j=0;j<5;j++){c.strokeStyle=color+'99';c.lineWidth=1.4;c.beginPath();for(let k=0;k<18;k++){const q=k/17;c.lineTo(x+(j-2)*r*.3+Math.sin(q*9-a*3+j)*q*10,y+q*58);}c.stroke();}
  c.fillStyle=color+'44';c.strokeStyle=color+'bb';c.beginPath();c.ellipse(x,y,r,r*.72,0,Math.PI,TAU);c.quadraticCurveTo(x,y+9,x-r,y);c.fill();c.stroke();ellipse(c,x-5,y-4,1.5,1.5,'#eefff0');ellipse(c,x+5,y-4,1.5,1.5,'#eefff0');
 }
}
export function courier(c,a,e){
 const dir=Math.floor(e.seed)%2?1:-1,x=(dir===1?250:1570)+dir*a*112,y=168+Math.sin(a*.9)*27;
 c.save();c.translate(x,y);c.scale(dir,1);c.strokeStyle='#e7c697';c.lineWidth=9;c.lineCap='round';c.beginPath();c.moveTo(14,-25);c.bezierCurveTo(-7,-40,-24,-16,-11,3);c.bezierCurveTo(15,30,-21,41,-20,21);c.bezierCurveTo(-22,8,-7,15,-12,23);c.stroke();c.fillStyle='#deb784';c.beginPath();c.moveTo(9,-28);c.lineTo(29,-19);c.lineTo(28,-14);c.lineTo(7,-18);c.fill();ellipse(c,9,-24,2,2,'#15303a');
 c.save();c.translate(15,11);c.rotate(.16);c.fillStyle='#f0dfb5';c.fillRect(-13,-9,26,18);c.strokeStyle='#b29063';c.lineWidth=1;c.beginPath();c.moveTo(-13,-9);c.lineTo(0,1);c.lineTo(13,-9);c.stroke();star(c,0,4,3,'#bd9666');c.restore();c.restore();
}
export function school(c,a,e){
 const build=Math.sin(Math.min(1,a/10)*Math.PI),x=470+a*37,y=160;
 for(let i=0;i<26;i++){const q=i*TAU/26,shapeX=Math.cos(q)*77,shapeY=Math.sin(q)*44,scatterX=(hash(e.seed+i)-.5)*340,scatterY=(hash(e.seed+i+60)-.5)*100;const px=x+scatterX*(1-build)+shapeX*build,py=y+scatterY*(1-build)+shapeY*build+Math.sin(a*3+i)*3;fish(c,px,py,5+hash(i)*3,['#a2e6d3','#d1cd9e','#96bfdc'][i%3],Math.sin(a+i)*.1);}
 if(build>.85){c.save();c.globalAlpha*=Math.min(1,(build-.85)*5);turtle(c,x,y,28,'#b7e8bd88',a*2);c.restore();}
}
export const seaArtists={teapot,diver,manta,jelly,courier,school};
