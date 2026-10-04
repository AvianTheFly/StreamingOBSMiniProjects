import {TAU,hash,smooth} from './paint.js';
import {star} from './party-ink.js';
export function bloom(c,a,colors,e){
  const growth=smooth(0,1,a/3);for(let side=0;side<2;side++)for(let branch=0;branch<4;branch++){
    const x=side?1860:60,dir=side?-1:1,height=400+branch*140,reach=100+branch*72,points=[];
    c.beginPath();for(let j=0;j<=50;j++){const q=j/50*growth,px=x+dir*(q*reach+Math.sin(q*9+branch)*35*q),py=1040-q*height;points.push([px,py]);c.lineTo(px,py);}c.strokeStyle=colors[(branch+side)%4];c.lineWidth=3;c.stroke();
    for(let n=1;n<=5;n++){const q=n/6;if(q>growth)continue;const [px,py]=points[Math.min(50,Math.round(q/growth*50))];const radius=9+hash(e.seed+branch*7+n)*10;c.save();c.translate(px,py);c.rotate(a*.3+n);for(let petal=0;petal<6;petal++){const angle=petal*TAU/6;c.fillStyle=colors[(branch+n)%4];c.beginPath();c.ellipse(Math.cos(angle)*radius*.65,Math.sin(angle)*radius*.65,radius*.62,radius*.27,angle,0,TAU);c.fill();}star(c,0,0,5,'#fff7d5');c.restore();}
  }
}
export function wave(c,a,colors,e){
  if(a>1.8)return;for(const x of [302,1618])for(let i=0;i<9;i++){const q=i*TAU/9+e.seed,spread=25+a*45;star(c,x+Math.cos(q)*spread,680+Math.sin(q)*spread-a*60,(5+hash(e.seed+i)*5)*Math.max(0,1-a/1.8),colors[i%4],a+i);}
}
