import {clamp,TAU} from './math.js';
// Shared by preview/export; native compositor mirrors these exact impact cues.
export const impacts={bear:[[2.18,14],[2.68,17],[3.18,22]],turtle:[[1.94,5],[3.62,8]],ram:[[3.65,34]],phoenix:[[1.12,6],[3.16,17]]};
export function recoil(t,at,power=1){const d=t-at;return d<0?0:Math.sin(d*TAU*5)*Math.exp(-d*12)*power;}
export function camera(id,t){let a=0;for(const [at,power] of impacts[id]){const d=t-at;if(d>=0&&d<.45)a+=power*Math.exp(-d*12);}return {x:Math.sin(t*91)*a,y:Math.cos(t*113)*a*.6,zoom:1+a*.002};}
export function transform(c,id,t){const p=camera(id,t);c.translate(960+p.x,540+p.y);c.scale(p.zoom,p.zoom);c.translate(-960,-540);}
export function puppet(character,c,frame,x,y,size,t,{lean=0,stretch=1,alpha=1,angle=0,breath=.012}={}){
 const b=Math.sin(t*3.2)*breath;c.save();c.translate(x,y+size*.34);c.transform(1/(stretch+b),0,lean,stretch+b,0,0);
 character.pose(c,frame,0,-size*.34,size,angle,alpha);c.restore();
}
export function impulse(c,t,at,x,y,color,power=1){
 const d=t-at;if(d<0||d>.42)return;const a=Math.exp(-d*15)*power;c.save();c.globalCompositeOperation='screen';
 const g=c.createRadialGradient(x,y,0,x,y,65+d*460);g.addColorStop(0,'#fff7e8');g.addColorStop(.18,color+'55');g.addColorStop(1,color+'00');
 c.globalAlpha=a*.55;c.fillStyle=g;c.fillRect(0,0,1920,1080);c.restore();
}
