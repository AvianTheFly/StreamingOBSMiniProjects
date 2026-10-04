// Authored ephemeral mountain footholds, leap trails and landing debris.
import {polygon,glow,line} from '../fx.js';
import {shadow} from '../rig.js';
import {dust} from '../atmosphere.js';
import {impulse} from '../motion.js';
import {window,soften} from '../performance.js';
import {approach,acting,beats,jumps} from '../rigs/ram/motion.js';
function foothold(c,x,y,width,alpha){if(alpha<=0)return;c.save();c.globalAlpha=alpha;
 const top=[[x-width*.58,y+8],[x-width*.49,y-9],[x-width*.26,y-19],[x-width*.08,y-13],[x+width*.17,y-21],[x+width*.45,y-10],[x+width*.56,y+7]];
 polygon(c,[...top,[x+width*.41,y+44],[x+width*.12,y+54],[x-width*.33,y+38]]);c.fillStyle='#252625';c.fill();c.strokeStyle='#9c8453';c.lineWidth=1.5;c.stroke();
 polygon(c,top);c.fillStyle='#796648';c.fill();line(c,[[x-width*.4,y-7],[x-width*.07,y-2],[x+width*.3,y-10]],'#e5c677',1.5,.8);
 line(c,[[x-width*.1,y+13],[x+width*.08,y+28],[x+width*.1,y+45]],'#d9ac63',1,.65);c.restore();}
export function entrance(s,t){if(t>3.85)return;const c=s.c,a=approach(t,s.variant),state=acting(t),side=(s.variant?-1:1)*state.facing;
 for(let i=0;i<jumps.length;i++){const j=jumps[i],at=beats.landings[i],alpha=window(t,at-.25,at-.07,i===2?3.29:jumps[i+1].start+.04,i===2?3.63:jumps[i+1].start+.34);
 foothold(c,s.variant?1920-j.to[0]:j.to[0],j.to[1],i===2?265:185,alpha*.9);}
 shadow(c,a.x,state.jump.groundY,a.size*.25,16,.25*(1-state.lift*.65)*a.alpha);
 s.character.draw(c,a);
 for(const at of beats.landings){const pose=approach(at,s.variant);dust(c,s.field,t-at,pose.x,pose.y,'#c9b184',.9);}
 if(state.jump.airborne){for(let i=0;i<12;i++){const age=i*.016,old=approach(Math.max(.01,t-age),s.variant);glow(c,old.x-side*old.size*.33,old.y-old.size*.32,3.5,'#d3b778',(1-i/12)*.14*state.lift);}}
 const pride=window(t,beats.rearStart,beats.rearPeak,3.20,3.45);glow(c,a.x,a.y-a.size*.67,240,'#e4cf98',pride*.11);
 const hits=s.character.contacts(approach(beats.impact,s.variant)),cx=(hits[0][0]+hits[1][0])/2,cy=(hits[0][1]+hits[1][1])/2;
 dust(c,s.field,t-beats.impact,cx,cy,'#e0bb76',2.3);impulse(c,t,beats.impact,cx,cy,'#eace98',.75);
 const rush=soften((t-3.35)/.3)*(1-soften((t-3.67)/.12));
 for(let i=0;i<12;i++){const angle=i*Math.PI/6;line(c,[[960+Math.cos(angle)*650,540+Math.sin(angle)*430],[960+Math.cos(angle)*1100,540+Math.sin(angle)*720]],'#e9d8af',1,rush*.23);}
}
