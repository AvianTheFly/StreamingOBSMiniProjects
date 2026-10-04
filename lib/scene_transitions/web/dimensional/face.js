// Expressive sculpted eyes and brows shared by the four fantasy animals.
import {ellipsoid,group,material,curve} from './geometry.js';
export function eyes(parent,positions,radius,irisColor){
 const white=material('#eee8d4',{roughness:.3}),rim=material('#263239'),iris=material(irisColor,{roughness:.23,emissive:irisColor,emissiveIntensity:.22}),black=material('#10171c',{roughness:.2}),shine=material('#ffffff',{emissive:'#ffffff',emissiveIntensity:1});
 return positions.map(([x,y,z],i)=>{
  const g=group(parent,[x,y,z]);ellipsoid(g,rim,[0,0,-.008],[radius*1.1,radius*.94,radius*.5]);ellipsoid(g,white,[0,0,0],[radius,radius*.84,radius*.57]);
  const look=group(g,[0,0,radius*.5]);ellipsoid(look,iris,[0,0,0],[radius*.55,radius*.58,radius*.17]);ellipsoid(look,black,[0,0,radius*.13],[radius*.29,radius*.39,radius*.08]);ellipsoid(look,shine,[-radius*.17,radius*.24,radius*.2],[radius*.13,radius*.13,radius*.06]);
  const lid=ellipsoid(g,rim,[0,radius*.83,radius*.15],[radius*.93,radius*.075,radius*.38]);return {g,look,lid,lidScale:radius*.075,side:i?1:-1};
 });
}
export function glance(eyeSet,t,intensity=.5){
 // Sparse analytic blinks; scrub order cannot change the pose.
 const blink=Math.max(0,1-Math.abs(t-1.72)/.065)+Math.max(0,1-Math.abs(t-2.83)/.07);
 for(const e of eyeSet){e.look.position.x=Math.sin(t*1.8)*.006*intensity;e.look.position.y=.002+Math.sin(t*1.1)*.002;e.lid.scale.y=e.lidScale*(1+blink*12);}
}
