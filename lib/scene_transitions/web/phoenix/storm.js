// Phoenix-owned finite storm optics, continuous material flow and ash depth.
import {SpriteMesh} from '../mesh.js';
import {clamp,TAU,rng,smooth} from '../math.js';
import {glow,line,ribbon} from '../fx.js';
import {palette as p} from './palette.js';
export class StormVolume{
 async load(){this.volume=await new SpriteMesh().load('phoenix-storm-v16');this.volume.cols=18;this.volume.rows=14;
  const random=rng(199);this.ash=Array.from({length:96},()=>({a:random()*TAU,r:random(),z:random(),v:random(),size:.7+random()*3}));return this;}
 dispose(){this.volume=null;this.ash=null;}
 draw(c,t){c.fillStyle=p.deep;c.fillRect(0,0,1920,1080);
  this.volume.draw(c,(u,v)=>{const x=u-.5,y=v-.5,phase=t-3.12,angle=Math.sin(phase*.75)*.075;
   return [960+(x*Math.cos(angle)-y*Math.sin(angle))*2230+Math.sin(v*12+u*6-t*3.2)*32,
    540+(x*Math.sin(angle)+y*Math.cos(angle))*1390+Math.sin(u*15-t*2.9)*28-phase*25];});
  c.save();c.globalCompositeOperation='screen';c.globalAlpha=.065;
  this.volume.draw(c,(u,v)=>[960+(u-.5)*2400+Math.sin(v*18+t*4)*46,540+(v-.5)*1500+Math.sin(u*11-t*3)*33]);c.restore();
  // Depth-oriented debris spirals with the flow, rather than a screen-wide starfield.
  for(const a of this.ash){const radius=80+a.r*1050,angle=a.a+t*(.14+a.v*.24),x=960+Math.cos(angle)*radius,y=540+Math.sin(angle)*radius*.60-t*a.z*12;
   const alpha=.13+a.z*.19,colour=a.z>.62?p.ember:p.white,dx=-Math.sin(angle)*(5+a.z*16),dy=Math.cos(angle)*(3+a.z*10);
   line(c,[[x,y],[x+dx,y+dy]],colour,a.size,alpha);
  }
  for(let j=0;j<5;j++){const phase=t*.43+j*1.256,points=Array.from({length:44},(_,i)=>{const a=phase+i*.043,r=190+i*17;return [960+Math.cos(a)*r,540+Math.sin(a)*r*.55];});
   ribbon(c,points,j%2?p.ember:p.cold,2.5,.15);}
 }
}
export function wake(c,t,pose,oldPose){const alpha=(1-smooth(3.10,3.42,t))*smooth(1.20,1.65,t);if(alpha<=0)return;
 for(let j=0;j<3;j++){const points=Array.from({length:18},(_,i)=>{const lag=i*.011,old=oldPose(t-lag),r=old.size*(.22+i*.014);
   return [old.x+Math.sin(t*5.5-i*.23+j*2.094)*r*.16,old.y+r];});
  ribbon(c,points,j===1?p.ember:p.cold,3.5,alpha*.25);}
}
export function breath(c,t,fronts){const charge=smooth(2.94,3.16,t)*(1-smooth(3.40,3.85,t));
 if(!charge)return;for(const [x,y] of fronts){glow(c,x,y,60+charge*230,p.cold,charge*.25);glow(c,x,y,35+charge*120,p.hot,charge*.15);}}
