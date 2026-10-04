// Side-stage floaters: soft movement, small guests and luminous paper props.
import {ellipse,hash,TAU} from './paint.js';
import {star} from './party-ink.js';
export function balloons(c,a,colors,e){
  for(let i=0;i<8;i++){
    const age=a-i*.18;if(age<0)continue;const side=i%2,x=(side?1570:350)+(hash(e.seed+i)-.5)*370+Math.sin(age*1.3+i)*25,y=1170-age*(90+hash(e.seed+i+15)*30),color=colors[i%4];
    c.strokeStyle=color+'aa';c.lineWidth=1.2;c.beginPath();for(let j=0;j<=20;j++){const q=j/20;c.lineTo(x+Math.sin(q*9-age*2)*10*q,y+35+q*100);}c.stroke();
    const g=c.createRadialGradient(x-12,y-15,2,x,y,37);g.addColorStop(0,'#fff3');g.addColorStop(.4,color+'bb');g.addColorStop(1,color+'55');ellipse(c,x,y,29,37,g);
    c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.ellipse(x,y,29,37,0,0,TAU);c.stroke();ellipse(c,x-10,y-14,6,10,'#ffffffaa');
    c.fillStyle=color;c.beginPath();c.moveTo(x,y+36);c.lineTo(x-5,y+44);c.lineTo(x+5,y+44);c.fill();
  }
}
export function lanterns(c,a,colors,e){
  for(let i=0;i<7;i++){
    const age=a-i*.27;if(age<0)continue;const x=(i%2?1640:280)+(hash(e.seed+i)-.5)*380+Math.sin(age*.7+i)*20,y=1080-age*(76+hash(e.seed+i+40)*23),r=15+hash(e.seed+i+20)*10;
    const glow=c.createRadialGradient(x,y,0,x,y,r*3);glow.addColorStop(0,'#ffcc7355');glow.addColorStop(1,'#ffcc7300');ellipse(c,x,y,r*3,r*3,glow);
    c.fillStyle='#ffdfa966';c.strokeStyle='#ffd795';c.lineWidth=1.5;c.beginPath();c.roundRect(x-r,y-r*1.35,r*2,r*2.7,5);c.fill();c.stroke();
    c.strokeStyle='#ffe5b866';for(let j=-1;j<=1;j++){c.beginPath();c.moveTo(x+j*r*.5,y-r*1.35);c.lineTo(x+j*r*.5,y+r*1.35);c.stroke();}
    ellipse(c,x,y+r*.8,4,8,'#fff3c9');c.strokeStyle=colors[i%4];c.beginPath();c.moveTo(x-r,y-r*1.2);c.lineTo(x+r,y-r*1.2);c.stroke();
    star(c,x,y-4,5,colors[(i+1)%4],age*.3);
  }
}
export function jellyfish(c,a,colors,e){
  for(let i=0;i<4;i++){
    const age=a-i*.38;if(age<0)continue;const x=(i%2?1650:265)+(hash(e.seed+i)-.5)*180+Math.sin(age*1.4+i)*45,y=995-age*67+Math.sin(age*3+i)*12,r=25+hash(e.seed+i+5)*13,color=colors[i%4];
    for(let j=0;j<6;j++){c.strokeStyle=color+'aa';c.lineWidth=2;c.beginPath();for(let k=0;k<=20;k++){const q=k/20;c.lineTo(x+(j-2.5)*r*.28+Math.sin(q*9-age*4+j)*q*18,y+q*(80+Math.sin(age*3)*15));}c.stroke();}
    c.fillStyle=color+'55';c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.ellipse(x,y,r*(1+Math.sin(age*3)*.06),r*.8,0,Math.PI,TAU);c.quadraticCurveTo(x+r*.5,y+10,x,y+2);c.quadraticCurveTo(x-r*.5,y+10,x-r,y);c.closePath();c.fill();c.stroke();
    ellipse(c,x-8,y-8,3,4,'#f1ffed');ellipse(c,x+8,y-8,3,4,'#f1ffed');c.strokeStyle='#ecffff';c.lineWidth=1.5;c.beginPath();c.arc(x,y-4,5,0,Math.PI);c.stroke();
  }
}
