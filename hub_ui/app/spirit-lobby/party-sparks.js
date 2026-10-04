// Crisp little flights and light games, confined mostly to ceiling and floor.
import {ellipse,hash,TAU,smooth} from './paint.js';
import {star} from './party-ink.js';
export function planes(c,a,colors,e){
  for(let i=0;i<4;i++){
    const age=a-i*.42;if(age<0||age>7)continue;const dir=Math.floor(e.seed+i)%2?1:-1,x=(dir===1?-100:2020)+dir*age*290,y=230+i*35+Math.sin(age*1.3+i)*105,angle=Math.atan2(Math.cos(age*1.3+i)*136,dir*290);
    c.strokeStyle=colors[i%4]+'66';c.lineWidth=1.4;c.setLineDash([4,7]);c.beginPath();for(let j=0;j<20;j++){const q=age-j*.025;c.lineTo((dir===1?-100:2020)+dir*q*290,230+i*35+Math.sin(q*1.3+i)*105);}c.stroke();c.setLineDash([]);
    c.save();c.translate(x,y);c.rotate(angle);c.fillStyle=colors[i%4];c.beginPath();c.moveTo(25,0);c.lineTo(-22,-15);c.lineTo(-12,0);c.lineTo(-22,15);c.closePath();c.fill();c.strokeStyle='#fff5df';c.lineWidth=1.2;c.beginPath();c.moveTo(25,0);c.lineTo(-12,0);c.lineTo(-18,9);c.stroke();c.restore();
  }
}
export function fireflies(c,a,colors,e){
  const dir=Math.floor(e.seed)%2?1:-1,center=dir===1?470:1440;
  for(let i=0;i<28;i++){const q=i*TAU/28+a*.65,x=center+Math.cos(q)*(90+Math.sin(a+i*.1)*35)+Math.sin(a*1.8+i)*10,y=230+Math.sin(q)*110+Math.sin(a+i)*15,r=2.2+Math.sin(a*5+i)*1.5;
    const g=c.createRadialGradient(x,y,0,x,y,12);g.addColorStop(0,colors[i%4]+'aa');g.addColorStop(1,colors[i%4]+'00');ellipse(c,x,y,12,12,g);ellipse(c,x,y,Math.max(1,r),Math.max(1,r),'#faffc5');
    if(i%4===0&&a>2&&a<6){const nq=q+TAU/28*4;c.strokeStyle=colors[i%4]+'44';c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(center+Math.cos(nq)*100,230+Math.sin(nq)*110);c.stroke();}
  }
}
export function pinball(c,a,colors,e){
  const elapsed=a*420,triangle=(value,max)=>max-Math.abs((value%(max*2))-max),x=180+triangle(elapsed+(e.seed%100),1560),y=960+Math.sin(a*5)*44,color=colors[Math.floor(e.seed)%4];
  c.strokeStyle=color+'88';c.lineWidth=3;c.beginPath();for(let i=0;i<18;i++){const q=a-i*.025;c.lineTo(180+triangle(q*420+(e.seed%100),1560),960+Math.sin(q*5)*44);}c.stroke();
  const g=c.createRadialGradient(x,y,0,x,y,28);g.addColorStop(0,color+'aa');g.addColorStop(1,color+'00');ellipse(c,x,y,28,28,g);ellipse(c,x,y,10,10,'#fff4d0');c.strokeStyle=color;c.lineWidth=3;c.beginPath();c.arc(x,y,12,0,TAU);c.stroke();
  for(const bx of [180,1740]){const near=Math.max(0,1-Math.abs(x-bx)/90);c.strokeStyle=colors[bx===180?1:2];c.lineWidth=2;c.beginPath();c.ellipse(bx,960,15+near*13,48+near*8,0,0,TAU);c.stroke();if(near>.15)for(let j=0;j<6;j++){const q=j*TAU/6;star(c,bx+Math.cos(q)*near*48,960+Math.sin(q)*near*65,4*near,color,q);}}
}
export function fireworks(c,a,colors,e){
  for(let i=0;i<3;i++){const age=a-i*1.1;if(age<0||age>3.1)continue;const x=300+hash(e.seed+i)*1320,y=85+hash(e.seed+i+20)*90,color=colors[i%4];
    if(age<.8){c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.moveTo(x,350-age*250);c.lineTo(x,330-age*250);c.stroke();continue;}
    const burst=age-.8,fade=1-smooth(1.3,2.3,burst);c.save();c.globalAlpha*=fade;
    for(let j=0;j<22;j++){const q=j*TAU/22,r=burst*(50+hash(e.seed+j)*28),px=x+Math.cos(q)*r,py=y+Math.sin(q)*r+burst*burst*13;c.strokeStyle=colors[(i+j)%4];c.lineWidth=2;c.beginPath();c.moveTo(x+Math.cos(q)*Math.max(0,r-12),y+Math.sin(q)*Math.max(0,r-12)+burst*burst*13);c.lineTo(px,py);c.stroke();star(c,px,py,3.5,color,q);}c.restore();
  }
}
