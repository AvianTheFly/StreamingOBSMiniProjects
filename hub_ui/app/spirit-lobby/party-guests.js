// Finite miniature cameos. Entrances and exits remain part of each instance.
import {ellipse,hash,TAU,smooth} from './paint.js';
import {star,duck,record} from './party-ink.js';
export function robot(c,a,colors,e){
  const dir=Math.floor(e.seed)%2?1:-1,x=(dir===1?-120:2040)+dir*a*265,y=980+Math.sin(a*12)*3,color=colors[Math.floor(e.seed)%4];
  c.save();c.translate(x,y);c.rotate(Math.sin(a*3)*.045);c.fillStyle='#a0b9cb';c.strokeStyle='#e7ffff';c.lineWidth=2;
  c.beginPath();c.roundRect(-22,-45,44,36,7);c.fill();c.stroke();c.fillStyle='#17283b';c.beginPath();c.roundRect(-18,-41,36,14,4);c.fill();
  ellipse(c,-8,-34,3,3,color);ellipse(c,8,-34,3,3,color);c.strokeStyle=color;c.beginPath();c.moveTo(-5,-19);c.lineTo(5,-19);c.stroke();
  c.strokeStyle='#c5dfe9';c.beginPath();c.moveTo(0,-45);c.lineTo(0,-58);c.stroke();ellipse(c,0,-60,4,4,color);
  c.strokeStyle='#a0b9cb';c.lineWidth=5;c.beginPath();c.moveTo(-20,-29);c.lineTo(-35,-13);c.moveTo(20,-29);c.lineTo(38,-45);c.stroke();
  c.fillStyle=color+'bb';c.beginPath();c.moveTo(31,-60);c.lineTo(44,-60);c.lineTo(41,-45);c.lineTo(34,-45);c.fill();c.strokeStyle='#fff2b8';c.lineWidth=1.3;c.beginPath();c.moveTo(38,-56);c.lineTo(43,-72);c.stroke();
  for(const px of [-15,15]){ellipse(c,px,0,9,9,'#162337');c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.arc(px,0,7,0,TAU);c.stroke();c.save();c.translate(px,0);c.rotate(a*10*dir);c.beginPath();c.moveTo(-6,0);c.lineTo(6,0);c.stroke();c.restore();}c.restore();
  for(let i=0;i<3;i++)star(c,x-dir*(40+i*17),y+4,3+Math.sin(a*6+i),color,a+i);
}
export function moon(c,a,colors,e){
  const side=Math.floor(e.seed)%2,x=side?1550:390,y=260-Math.sin(Math.min(1,a/2)*Math.PI/2)*58,r=39,peek=smooth(0,.9,a)*(1-smooth(7,9,a));
  c.save();c.globalAlpha*=peek;ellipse(c,x,y,r,r,'#fff1b3');
  for(let i=0;i<4;i++)ellipse(c,x+(hash(e.seed+i)-.5)*45,y+(hash(e.seed+i+8)-.5)*40,3+hash(e.seed+i+20)*5,'#dcbf7b77');
  const wink=a>2.2&&a<3.1;c.strokeStyle='#735473';c.lineWidth=3;c.beginPath();if(wink){c.moveTo(x-17,y-5);c.lineTo(x-7,y-5);}else{c.moveTo(x-13,y-9);c.lineTo(x-13,y-2);}c.moveTo(x+12,y-9);c.lineTo(x+12,y-2);c.stroke();c.beginPath();c.arc(x,y+3,11,0,Math.PI);c.stroke();
  ellipse(c,x-22,y+4,6,3,'#e989ad77');ellipse(c,x+22,y+4,6,3,'#e989ad77');
  for(let i=0;i<5;i++){const age=a-3.1-i*.12;if(age>0&&age<3){star(c,x+(side?-1:1)*(45+age*42),y-8-age*23+Math.sin(age*4+i)*10,6*(1-age/3),colors[i%4],age+i);}}c.restore();
}
export function portal(c,a,colors,e){
  const side=Math.floor(e.seed)%2,x=side?1770:150,y=785,open=smooth(0,1,a)*(1-smooth(7,9,a)),rx=47*open,ry=74*open;
  if(open<=0)return;c.fillStyle='#13172e88';c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();
  for(let ring=0;ring<3;ring++){c.strokeStyle=colors[(ring+Math.floor(a))%4];c.lineWidth=3-ring*.6;c.beginPath();c.ellipse(x,y,rx+ring*5,ry+ring*7,Math.sin(a)*.08,0,TAU);c.stroke();}
  for(let i=0;i<12;i++){const q=i*TAU/12+a;star(c,x+Math.cos(q)*(rx+10),y+Math.sin(q)*(ry+10),3+Math.sin(a*4+i)*2,colors[i%4],q);}
  for(let i=0;i<4;i++){const age=a-1.3-i*.7;if(age<0||age>4.5)continue;const dir=side?-1:1,px=x+dir*age*88,py=y-age*100+age*age*27;c.save();c.globalAlpha*=Math.min(1,(4.5-age)*2);if(i===0)duck(c,px,py,.6,colors[2],age*7,!!side);else if(i===1)record(c,px,py,17,colors[1],age*5);else if(i===2){ellipse(c,px,py,18,18,'#ffd58c');c.strokeStyle=colors[0];c.lineWidth=3;c.beginPath();c.ellipse(px,py,29,7,-.4,0,TAU);c.stroke();}else star(c,px,py,23,colors[3],age*3);c.restore();}
}
