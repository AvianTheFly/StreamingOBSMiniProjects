import {ellipse,glow,hash,TAU} from './shared/world-motion.js';
export function sparks(c,x,y,t,count=16,color='#ffd399'){
 for(let i=0;i<count;i++){const q=(t*(.18+hash(i+4)*.15)+hash(i+9))%1,px=x+(hash(i+2)-.5)*(18+q*72)+Math.sin(t*2+i)*6,py=y-q*95;
  c.save();c.globalAlpha=Math.sin(q*Math.PI)*.6;ellipse(c,px,py,1+hash(i+23),1.5+hash(i+42)*2,color);c.restore();}
}
export function forgeAmbience(c,t){
 for(const [x,y,r] of [[425,109,135],[1877,610,120],[540,684,35],[1375,736,42],[266,820,44],[1819,828,48]]){glow(c,x,y,r,'#ffb566',.045+.024*Math.sin(t*5.1+x)+.015*Math.sin(t*11+y));sparks(c,x,y,t+x,10);}
 for(const [x,y,r] of [[128,720,75],[1631,775,58]]){glow(c,x,y,r,'#88eafa',.07+.04*Math.sin(t*1.7+x));c.save();c.globalAlpha=.13;c.strokeStyle='#b7f8f7';c.lineWidth=1.3;for(let i=0;i<3;i++){c.beginPath();c.ellipse(x,y,15+i*7,7+i*4,t*.6+i,0,TAU);c.stroke();}c.restore();}
}
