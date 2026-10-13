// Analytic spirit currents in the distant scenery. No particle history or flashes.
import {ellipse,hash,TAU} from './shared/world-motion.js';
const colors={'aurora-camp':['#83eaff','#b9a4ff'],sanctuary:['#96ffdb','#ffc8e1'],forge:['#ffbf75','#ff7857'],'phoenix-observatory':['#bdeaff','#d6adff']};
export function festivalWeather(c,t,id){
 const palette=colors[id];if(!palette)return;
 c.save();
 // Each ribbon has a moving bright head and fading tail, rather than blinking.
 for(let i=0;i<4;i++){
  const q=(t*.035+i*.24)%1,start=id==='forge'?230:180,span=id==='forge'?470:1160;
  for(let tail=0;tail<12;tail++){
   const p=q-tail*.005;if(p<0)continue;const x=start+p*span;
   const y=id==='forge'?550-p*290+Math.sin(p*9+i)*22:90+i*37+Math.sin(p*7+t*.16+i)*37;
   c.globalAlpha=(1-tail/12)*.35*Math.sin(q*Math.PI);
   ellipse(c,x,y,tail?2:3,tail?1:2,palette[i%2]);
  }
 }
 if(id==='sanctuary')for(let i=0;i<12;i++){
  const q=(t*.025+hash(i+33))%1,x=210+hash(i+9)*1100,y=580-q*360;
  c.globalAlpha=Math.sin(q*Math.PI)*.3;c.fillStyle=i%2?palette[0]:'#ffdb9a';c.fillRect(x,y,3,5);
 }
 if(id==='phoenix-observatory')for(let i=0;i<8;i++){
  const a=t*.07+i*TAU/8,x=1110+Math.cos(a)*235,y=190+Math.sin(a)*78;
  c.globalAlpha=.25;c.save();c.translate(x,y);c.rotate(a+.6);ellipse(c,0,0,6,1.2,palette[i%2]);c.restore();
 }
 c.restore();
}
