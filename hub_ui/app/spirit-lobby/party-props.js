import {hash,TAU,ellipse,smooth} from './paint.js';
import {duck,record,star} from './party-ink.js';
const ease=v=>smooth(0,1,v);
export function visitor(c,a,colors,e){
  const target=650+hash(e.seed)*600,arrive=ease(a/1.5),leave=ease((a-6.8)/2.2),x=-180+(target+180)*arrive+(2200-target)*leave,y=148+Math.sin(a*2)*8;
  if(a>1.5&&a<6.8){const beam=Math.min(1,(a-1.5)*2,(6.8-a)*2);c.save();c.globalAlpha*=beam;c.fillStyle='#bcffe325';c.beginPath();c.moveTo(x-30,y+25);c.lineTo(x-110,635);c.lineTo(x+110,635);c.lineTo(x+30,y+25);c.fill();c.strokeStyle='#9cffe155';c.lineWidth=1.5;for(let j=0;j<3;j++){const yy=y+60+((a*100+j*120)%380);c.beginPath();c.ellipse(x,yy,25+(yy-y)*.16,6,0,0,TAU);c.stroke();}const lift=Math.sin(Math.min(1,Math.max(0,(a-2)/4))*Math.PI);duck(c,x,620-lift*320,1.05,colors[2],a*7);c.restore();}
  ellipse(c,x,y-12,47,33,'#a6ffe655');c.strokeStyle='#b5fff2';c.lineWidth=2;c.beginPath();c.ellipse(x,y-12,47,33,0,Math.PI,TAU);c.stroke();ellipse(c,x,y-13,15,18,'#9adb90');ellipse(c,x-6,y-16,4,7,'#182133');ellipse(c,x+6,y-16,4,7,'#182133');
  ellipse(c,x,y+9,82,19,'#313749');ellipse(c,x,y+4,81,12,'#a0b6cc');for(let j=0;j<8;j++)ellipse(c,x-63+j*18,y+12,4,3,colors[(j+Math.floor(a*5))%4]);star(c,x+105,y-22,7,colors[1],a);
}
export function vinyl(c,a,colors,e){
  const spread=ease(a/1.6)*(1-ease((a-6)/2));
  for(let i=0;i<7;i++){const angle=i*TAU/7+a*.78+e.seed,x=960+Math.cos(angle)*550*spread,y=730+(Math.sin(angle)*220-160)*spread,r=22+hash(e.seed+i)*13;
    c.strokeStyle=colors[i%4]+'66';c.lineWidth=2;c.beginPath();for(let j=0;j<9;j++){const q=angle-j*.055;c.lineTo(960+Math.cos(q)*550*spread,730+(Math.sin(q)*220-160)*spread);}c.stroke();record(c,x,y,r,colors[i%4],a*4+i);}
}
export function ducks(c,a,colors,e){
  const dir=e.serial%2?1:-1;for(let i=0;i<9;i++){const age=a-i*.2;if(age<0)continue;const x=(dir===1?-100:2020)+dir*age*285,y=994-Math.abs(Math.sin(age*7+i))*30;duck(c,x,y,.75+hash(e.seed+i)*.2,colors[i%4],age*8,dir===-1);if(age% .8<.24)star(c,x-dir*35,y+4,5,colors[(i+1)%4],age);}
}
