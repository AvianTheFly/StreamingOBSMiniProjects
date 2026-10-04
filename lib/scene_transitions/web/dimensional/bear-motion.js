import {track,soften,window} from '../performance.js';
import {lerp} from '../math.js';
export const swipes=[{at:2.18,hand:0,start:-2.18,end:.75,radius:280},{at:2.68,hand:1,start:-.96,end:2.5,radius:280},{at:3.18,hand:0,start:-2.5,end:1.05,radius:290}];
export const twistTrack=[[0,0],[.6,-.18],[1.2,.18],[1.7,-.2],[2.1,-.75],[2.4,.8],[2.61,.65],[2.91,-.85],[3.1,-.7],[3.43,.95],[3.85,.2]];
export function facing(t,twist){return twist*.44+track([[0,.64],[.7,.5],[1.3,.25],[1.85,0],[3.85,0]],t);}
export function shoulderPose(t,twist=0){const yaw=facing(t,twist);return [-1,1].map(side=>[side*.245*Math.cos(yaw),-.65+side*twist*.016]);}
export function acting(t){
 const twist=track(twistTrack,t),roots=shoulderPose(t,twist),stride=window(t,.1,.45,1.45,1.98),angles=[-.3,.3];
 const paws=roots.map(([x,y],i)=>[x+(i?1:-1)*(.08+Math.sin(t*13+i*Math.PI)*stride*.05),y+.35+Math.cos(t*13+i*Math.PI)*stride*.045]);
 for(const sw of swipes){const d=t-sw.at;if(d<-.4||d>.55)continue;
  const q=soften(d/.22),a=lerp(sw.start,sw.end,q),r=sw.radius/820,target=[roots[sw.hand][0]+Math.cos(a)*r,roots[sw.hand][1]+Math.sin(a)*r];
  const blend=d<0?soften((d+.4)/.4):1-soften((d-.26)/.29);paws[sw.hand]=paws[sw.hand].map((v,i)=>lerp(v,target[i],blend));angles[sw.hand]=lerp(angles[sw.hand],Math.PI/2-a,blend);
 }return {paws,twist,roots,handAngles:angles,yaw:facing(t,twist)};
}
export function clawContact(t,hand,offset=0){const act=acting(t),angle=act.handAngles[hand];return [act.paws[hand][0]+Math.cos(angle)*offset,act.paws[hand][1]-Math.sin(angle)*offset];}
