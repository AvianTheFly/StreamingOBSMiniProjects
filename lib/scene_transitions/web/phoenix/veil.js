// Solid wing-origin coverage and storm erosion; independent of decorative paint.
import {clamp,TAU} from '../math.js';
import {glow,line} from '../fx.js';
import {flight} from './flight.js';
import {palette as p} from './palette.js';
import {radius,front,opening,openingRadius,paint} from './strokes.js';
export function fronts(s,t){return s.character.contacts({...flight(t,s.variant),t},'cast').sort((a,b)=>a[0]-b[0]);}
export const frontRadius=radius;
export function coverage(s,t){if(t<=3.12)return false;const c=s.b;c.fillStyle=p.deep;
 fronts(s,t).forEach(([cx,cy],i)=>front(c,cx,cy,t,i?-1:1));return true;}
export function surface(s,t){s.flame.draw(s.b,t);paint(s.b,fronts(s,3.16),t);glow(s.b,760,450,900,p.cold,.08);glow(s.b,1170,650,780,p.ember,.08);}
export function reveal(s,t){const c=s.b,progress=clamp((t-s.timing.coveredUntil)/1.70),origins=fronts(s,3.16);
 c.save();c.globalCompositeOperation='destination-out';opening(c,origins,progress);c.restore();
 // Feathery brush edges curl away from both original wing strokes.
 origins.forEach(([cx,cy],index)=>{const side=index?-1:1;
  for(let j=0;j<68;j++){const a=j*TAU/68,r=openingRadius(a,progress,side),theta=a+side*Math.sin(a)*.16,x=cx+Math.cos(theta)*r,y=cy+Math.sin(theta)*r*.86;
   if(x<-50||x>1970||y<-50||y>1130)continue;
   glow(s.c,x,y,17,j%3?p.cold:p.ember,(1-progress)*.23);
   line(s.c,[[x,y],[x+Math.cos(theta)*(16+progress*24),y+Math.sin(theta)*(16+progress*24)]],j%3?p.white:p.hot,1.1,(1-progress)*.36);
  }
 });
}
