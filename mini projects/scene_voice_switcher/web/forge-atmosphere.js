import {ellipse,glow,hash,TAU} from './shared/world-motion.js';
export function sparks(c,x,y,t,count=16,color='#ffd399'){
 for(let i=0;i<count;i++){const q=(t*(.18+hash(i+4)*.15)+hash(i+9))%1,px=x+(hash(i+2)-.5)*(18+q*72)+Math.sin(t*2+i)*6,py=y-q*95;
  c.save();c.globalAlpha=Math.sin(q*Math.PI)*.6;ellipse(c,px,py,1+hash(i+23),1.5+hash(i+42)*2,color);c.restore();}
}
export function forgeAmbience(c,t){
 for(const [x,y,r] of [[425,109,100],[1877,610,70],[375,565,110],[1570,660,55],[630,430,35],[1374,429,35]]){glow(c,x,y,r,'#ffb566',.045+.024*Math.sin(t*5.1+x)+.015*Math.sin(t*11+y));sparks(c,x,y,t+x,8);}
 // Rune light belongs to the furnace crest and the duck's actual anvil.
 for(const [x,y,r] of [[408,266,35],[1640,784,30]])glow(c,x,y,r,'#88eafa',.07+.04*Math.sin(t*1.7+x));
}
