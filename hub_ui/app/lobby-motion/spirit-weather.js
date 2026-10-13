// Ambient motion in the three redesigned paintings; no timers or retained particles.
import {glow,ellipse,hash} from './shared/world-motion.js';
export function spiritWeather(c,t,theme){
 c.save();
 if(theme==='ionia'){
  // Petals follow the open upper beams and far-right water garden.
  for(let i=0;i<20;i++){const q=(t*.028+hash(i+11))%1,x=1030+hash(i+81)*380+Math.sin(t*.5+i)*16,y=20+q*230;c.save();c.translate(x,y);c.rotate(t*.65+i);ellipse(c,0,0,3,1.5,'#efb3c775');c.restore();}
  for(let i=0;i<4;i++){const x=1780+Math.sin(t*.45+i*2)*27,y=850+i*42+Math.cos(t*.6+i)*8;ellipse(c,x,y,6,2,'#ffd8b377');}
 }else if(theme==='forest'){
  // Fireflies rise from the moss and follow the tree line, leaving the sky quiet.
  for(let i=0;i<25;i++){const q=(t*.025+hash(i+19))%1,x=130+hash(i+31)*1510+Math.sin(t*.4+i)*14,y=770-q*380;glow(c,x,y,7,'#8de7ba',.09);ellipse(c,x,y,1.1,1.1,'#c8f8bd88');}
  for(const [x,y] of [[823,389],[1384,400],[1570,697]])glow(c,x,y,29,'#78dfff',.06+.04*Math.sin(t*.7+x));
 }else{
  // Snow lives around the scenery, with complete live apertures cleared later.
  for(let i=0;i<48;i++){const q=(t*(.017+hash(i)*.01)+hash(i+100))%1,x=20+hash(i+9)*1880+Math.sin(t*.3+i)*11,y=q*1050;ellipse(c,x,y,.8+hash(i+22),.8+hash(i+22),'#d8efff55');}
  c.save();c.beginPath();c.rect(977,0,470,290);c.clip();
  for(let i=0;i<5;i++){c.strokeStyle=i%2?'#7becc923':'#87dfff28';c.lineWidth=6;c.beginPath();for(let x=980;x<=1450;x+=10)c.lineTo(x,75+i*32+Math.sin(x*.008+t*.27+i)*27);c.stroke();}c.restore();
  if(theme==='ice')for(const [x,y,r] of [[1080,405,82],[1140,150,70],[980,965,32]])glow(c,x,y,r,'#82d9ff',.065+.035*Math.sin(t*1.7+x));
 }
 c.restore();
}
