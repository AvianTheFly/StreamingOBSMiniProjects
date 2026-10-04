// Whole-character camera poses: wings, feet and tail share the authored view.
// Each angle has two complete wing-stroke paints; their native ratios are kept.
import {smooth} from '../../math.js';
// Torso centers register the two flap states; the rest of each full silhouette
// follows its own painted anatomy rather than borrowing frontal wings/feet.
export const registration={
 1:[{pivot:[.76,.65],width:1.45},{pivot:[.65,.51],width:1.45}],
 2:[{pivot:[.77,.68],width:1.55},{pivot:[.70,.48],width:1.55}],
 3:[{pivot:[.5,.48],width:1.55},{pivot:[.5,.42],width:1.55}]
};
// A flight pass uses one coherent silhouette; dissolve between opposite wing
// extrema would create two transparent birds. Additional extrema remain saved.
export const paintedFrame={1:1,2:0,3:1};
export function frames(t,view=1){return [{key:paintedFrame[view],weight:1}];}
export function point(parts,view,frame,u,v,t){const part=parts.flight[view][frame],r=registration[view][frame],height=r.width*part.h/part.w;
 const x=(u-r.pivot[0])*r.width,y=(v-r.pivot[1])*height;
 // Bounded secondary feather flex never separates the whole painted silhouette.
 const outside=Math.min(1,Math.abs(u-r.pivot[0])*2),trail=Math.max(0,v-r.pivot[1]);
 const feather=smooth(.12,.42,Math.abs(u-r.pivot[0]))*(1-smooth(.72,.95,v));
 return [x+Math.sin(t*7.1-v*4)*.035*trail,
  y+Math.sin((t-1.12)*10.4-u*.9)*.09*feather+Math.sin(t*7.1)*.006+Math.sin(t*8-v*3)*.018*trail];
}
export function draw(parts,c,view,t,blend){blend(parts,c,frames(t,view),(ctx,l)=>parts.flight[view][l.key].mesh.draw(ctx,(u,v)=>point(parts,view,l.key,u,v,t)));}
