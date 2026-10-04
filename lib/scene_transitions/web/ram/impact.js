// Twin painted horn contacts own cover growth; the cut plateau is truly opaque.
import {smooth,out,TAU} from '../math.js';
import {glow,line,polygon} from '../fx.js';
import {fissures} from '../atmosphere.js';
import {approach,beats} from '../rigs/ram/motion.js';
export function impacts(s){if(!s.hornHits)s.hornHits=s.character.contacts(approach(beats.impact,s.variant));return s.hornHits;}
export function coverage(s,t){const p=smooth(beats.impact,3.85,t);if(!p)return false;const c=s.b;c.fillStyle='#302a21';
 for(const [x,y] of impacts(s)){c.beginPath();c.ellipse(x,y,p*2200,p*1500,0,0,TAU);c.fill();}return true;}
export function surface(s,t){const c=s.b;c.drawImage(s.material,0,0);const crack=out((t-beats.impact)/.19),hits=impacts(s);
 for(const cell of s.mesh){polygon(c,cell.points);c.fillStyle=cell.shade>.58?'#e9d7a209':'#03091110';c.fill();c.strokeStyle='#bb9965';c.globalAlpha=.10+cell.shade*.13;c.lineWidth=.7;c.stroke();c.globalAlpha=1;}
 for(let n=0;n<2;n++){const [x,y]=hits[n];fissures(c,s.mesh,[x,y],n?'#e2c292':'#fff0ca',crack,.7);
 const age=Math.max(0,t-beats.impact);glow(c,x,y,100+age*90,'#f3dfac',.19*Math.exp(-age*2.4));
 for(let i=0;i<12;i++){const a=i*TAU/12,r=(90+i%3*40)*crack;
 line(c,[[x+Math.cos(a)*22,y+Math.sin(a)*22],[x+Math.cos(a)*r,y+Math.sin(a)*r]],i%4?'#f4d795':'#bd7e40',1.5,crack*.33);}}
 const imprint=.16*(1-smooth(3.72,4.02,t));if(imprint)s.character.draw(c,{...approach(beats.impact,s.variant),t:beats.impact,alpha:imprint});
}
