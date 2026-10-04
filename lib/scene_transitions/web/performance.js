// Authored motion tracks. Cubic Hermite tangents carry momentum through keys;
// endpoints rest, interior keys do not restart an easing function.
import {clamp} from './math.js';
export function track(keys,t){
 if(t<=keys[0][0])return keys[0][1];
 if(t>=keys.at(-1)[0])return keys.at(-1)[1];
 let i=0;while(keys[i+1][0]<t)i++;
 const [a,x]=keys[i],[b,y]=keys[i+1],d=b-a,p=(t-a)/d;
 const slope=j=>j===0||j===keys.length-1?0:(keys[j+1][1]-keys[j-1][1])/(keys[j+1][0]-keys[j-1][0]);
 return (2*p**3-3*p*p+1)*x+(p**3-2*p*p+p)*d*slope(i)+(-2*p**3+3*p*p)*y+(p**3-p*p)*d*slope(i+1);
}
export const soften=p=>{p=clamp(p);return p*p*p*(p*(p*6-15)+10);};
export const window=(t,a,b,c,d)=>soften((t-a)/(b-a))*(1-soften((t-c)/(d-c)));
export function world(pose,point){
 const a=pose.angle||0,x=point[0]*pose.size,y=point[1]*pose.size;
 return [pose.x+x*Math.cos(a)-y*Math.sin(a),pose.y+x*Math.sin(a)+y*Math.cos(a)];
}
