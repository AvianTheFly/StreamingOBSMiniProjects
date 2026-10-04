import {hash,TAU} from './paint.js';
import {star} from './party-ink.js';
export function confetti(c,age,colors,e){
  for(let i=0;i<96;i++){
    const h=e.seed+i,vx=(hash(h)-.5)*340,x=960+(hash(e.seed+9)-.5)*120+vx*age+Math.sin(age*2+i)*12,y=730-(230+hash(h+100)*170)*age+52*age*age;
    c.save();c.translate(x,y);c.rotate(age*(hash(h+200)*4-2)+i);c.fillStyle=colors[i%4];c.fillRect(-3,-6,5+hash(h+300)*3,9);c.restore();
  }
}
export function bubbles(c,age,colors,e){
  for(let i=0;i<32;i++){
    const h=e.seed+i,a=age-hash(h)*1.3;if(a<0)continue;
    const life=5.7+hash(h+20)*1.1,x=(i%2?1550:350)+(hash(h+7)-.5)*390+Math.sin(a*.95+h)*38,y=1040-a*(80+hash(h+3)*48),r=11+hash(h+5)*29;
    if(a>life){if(a<life+.45)for(let j=0;j<5;j++){const q=j*TAU/5;star(c,x+Math.cos(q)*(r+(a-life)*85),y+Math.sin(q)*(r+(a-life)*85),4*(1-(a-life)/.45),colors[(i+j)%4]);}continue;}
    const gradient=c.createRadialGradient(x-r*.3,y-r*.3,0,x,y,r);gradient.addColorStop(0,'#ffffff35');gradient.addColorStop(.75,'#afffff08');gradient.addColorStop(1,colors[i%4]+'88');
    c.fillStyle=gradient;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();c.strokeStyle=colors[i%4];c.lineWidth=1.6;c.stroke();
    c.strokeStyle='#ffffffcc';c.lineWidth=2;c.beginPath();c.arc(x,y,r*.76,3.6,4.65);c.stroke();
  }
}
export function meteors(c,age,colors,e){
  for(let i=0;i<6;i++){
    const a=age-i*.54;if(a<0||a>3.2)continue;const direction=(Math.floor(e.serial)+i)%2?1:-1,x=(direction===1?-140:2060)+direction*a*650,y=45+i*22+a*58;
    if(a<2.7){for(let j=0;j<3;j++){c.beginPath();for(let k=0;k<=24;k++){const q=k/24,px=x-direction*q*205,py=y-q*18+Math.sin(q*8-a*6+j)*7;c.lineTo(px,py);}c.strokeStyle=colors[(i+j)%4];c.lineWidth=4-j;c.stroke();}star(c,x,y,15,colors[i%4],a*3);star(c,x,y,7,'#fff8d7',a*3);}
    else for(let j=0;j<10;j++){const q=j*TAU/10,r=(a-2.7)*180;star(c,x+Math.cos(q)*r,y+Math.sin(q)*r,7*(1-(a-2.7)/.5),colors[j%4],q);}
  }
}
