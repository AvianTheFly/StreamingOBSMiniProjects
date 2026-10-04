import {glow,ellipse,hash,TAU} from './shared/world-motion.js';
export function steam(c,x,y,t,height=75){c.save();c.lineWidth=1.4;for(let i=0;i<3;i++){c.strokeStyle=i===1?'#f0eadb32':'#e2e9e323';c.beginPath();for(let j=0;j<=24;j++){const q=j/24;c.lineTo(x+i*9+Math.sin(q*7-t*1.2+i)*q*9,y-q*height);}c.stroke();}c.restore();}
export function water(c,x,y,w,h,t){c.save();c.beginPath();c.rect(x,y,w,h);c.clip();for(let i=0;i<10;i++){const q=(t*.16+i/10)%1;c.strokeStyle='#b4edf329';c.lineWidth=.8;c.beginPath();c.moveTo(x+(i%3)*w*.22,y+q*h);c.lineTo(x+w*.8,y+q*h+8);c.stroke();}c.restore();}
export function sanctuaryAmbience(c,t){
 for(const [x,y,r] of [[286,106,35],[785,174,34],[1649,113,34],[1430,187,30],[1515,182,27],[45,250,27],[1865,421,27],[976,880,38],[197,850,58],[1582,938,58]])glow(c,x,y,r,'#9bd6b1',.05+.027*Math.sin(t*1.3+x));
 steam(c,494,653,t,79);steam(c,625,721,t+1,44);
 water(c,1171,432,28,85,t);water(c,1182,538,45,30,t+.3);water(c,1775,844,60,77,t);
 for(let i=0;i<20;i++){const x=830+hash(i+10)*615+Math.sin(t*.4+i)*12,y=290+hash(i+40)*410+Math.cos(t*.3+i)*11,r=1.3+hash(i)*1.2;glow(c,x,y,7,'#bce8b0',.05+.08*(1+Math.sin(t*2+i))/2);ellipse(c,x,y,r,r,'#afddb866');}
}
