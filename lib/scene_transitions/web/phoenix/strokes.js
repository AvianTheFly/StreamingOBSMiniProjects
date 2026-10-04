// Twin wing-cast paint strokes. Mask geometry is separate from storm optics.
import {smooth,clamp,TAU} from '../math.js';
import {ribbon} from '../fx.js';
import {palette as p} from './palette.js';
// Monotone feather-shaped fronts grow around two central painted wing contacts.
// Small ridges trail each arc like the separated bristles of a loaded brush.
export function radius(a,t){const q=smooth(3.12,3.85,t)**1.4,brush=Math.sin(a*11+.4)*.045+Math.sin(a*23)*.022;
 return Math.max(0,q*2350*(1+brush*(1-q)));
}
export function front(c,x,y,t,side=1){c.beginPath();
 for(let i=0;i<=180;i++){const a=i*TAU/180,r=radius(a,t),sweep=side*Math.sin(a)*smooth(3.12,3.60,t)*.20;
  const px=x+Math.cos(a+sweep)*r,py=y+Math.sin(a+sweep)*r*.86;i?c.lineTo(px,py):c.moveTo(px,py);}
 c.closePath();c.fill();
}
// Reveal blooms out from the same two release spots. It has no vertical wipe.
export function openingRadius(a,progress,side=1){const q=smooth(0,1,progress),bristles=Math.sin(a*13+side)*.035+Math.sin(a*29-side)*.020;
 return q*2350*(1+bristles*(1-q));
}
export function opening(c,origins,progress){for(const [index,[x,y]] of origins.entries()){
 const side=index?-1:1;c.beginPath();for(let i=0;i<=180;i++){const a=i*TAU/180,r=openingRadius(a,clamp(progress),side);
  const px=x+Math.cos(a+side*Math.sin(a)*.16)*r,py=y+Math.sin(a+side*Math.sin(a)*.16)*r*.86;i?c.lineTo(px,py):c.moveTo(px,py);}
 c.closePath();c.fill();
}}
export function paint(c,origins,t){const q=smooth(3.12,3.85,t),fade=1-smooth(4.02,4.25,t);
 if(q<=0||fade<=0)return;
 origins.forEach(([cx,cy],index)=>{const side=index?1:-1;
  for(let k=0;k<9;k++){const points=Array.from({length:40},(_,i)=>{const v=i/39,r=v*q*1900,curve=(v-.25)*1.24+(k-4)*.13;
   return [cx+side*Math.cos(curve)*r,cy+Math.sin(curve)*r*.72];});
   ribbon(c,points,k%3?p.cold:p.ember,(k%3?7:12)*(1-q*.55),fade*.20);
  }
 });
}
