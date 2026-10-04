// Bounded sculpting primitives. No rendering, loading or global resources at import.
import * as T from '../vendor/three.module.js';
export {T};
export const vec=p=>new T.Vector3(...p);
export function material(color,extra={}) {return new T.MeshStandardMaterial({color,roughness:.62,metalness:.03,...extra});}
export function group(parent,position=[0,0,0]) {const g=new T.Group();g.position.set(...position);parent.add(g);return g;}
export function ellipsoid(parent,mat,position,scale,segments=40) {
 const m=new T.Mesh(new T.SphereGeometry(1,segments,24),mat);m.position.set(...position);m.scale.set(...scale);parent.add(m);return m;
}
// A continuous skin surface with smoothly changing cross-sections around a curve.
// The same vertex buffers are updated; joints never become disconnected cutouts.
export class Skin {
 constructor(parent,mat,radii,segments=28,sides=14) {
  this.radii=radii;this.segments=segments;this.sides=sides;
  const count=(segments+1)*(sides+1),positions=new Float32Array(count*3),uv=new Float32Array(count*2),indices=[];
  for(let i=0;i<=segments;i++)for(let j=0;j<=sides;j++){const n=i*(sides+1)+j;uv[n*2]=j/sides;uv[n*2+1]=i/segments;
   if(i<segments&&j<sides){const a=n,b=n+sides+1;indices.push(a,a+1,b,a+1,b+1,b);}}
  this.geometry=new T.BufferGeometry();this.geometry.setAttribute('position',new T.BufferAttribute(positions,3));this.geometry.setAttribute('uv',new T.BufferAttribute(uv,2));this.geometry.setIndex(indices);
  this.mesh=new T.Mesh(this.geometry,mat);this.mesh.frustumCulled=false;parent.add(this.mesh);
 }
 update(points) {
  const curve=new T.CatmullRomCurve3(points.map(vec),false,'catmullrom',.25),a=this.geometry.attributes.position;
  // Anchor the skin's material frame to a fixed front direction, then parallel
  // transport along the limb. Choosing the smallest tangent axis every frame
  // would abruptly spin the fur/scale UVs when a joint changes direction.
  const first=curve.getTangent(0),hint=new T.Vector3(0,0,1);let normal=hint.addScaledVector(first,-hint.dot(first)).normalize();
  if(normal.lengthSq()<.001)normal=new T.Vector3(0,1,0).addScaledVector(first,-first.y).normalize();
  for(let i=0;i<=this.segments;i++){
   const u=i/this.segments,p=curve.getPoint(u),tangent=curve.getTangent(u),f=u*(this.radii.length-1),j=Math.min(this.radii.length-2,Math.floor(f)),v=f-j,r=this.radii[j]*(1-v)+this.radii[j+1]*v;
   normal.addScaledVector(tangent,-normal.dot(tangent)).normalize();const binormal=new T.Vector3().crossVectors(tangent,normal).normalize();
   for(let k=0;k<=this.sides;k++){const angle=k/this.sides*Math.PI*2,q=p.clone().addScaledVector(normal,Math.cos(angle)*r).addScaledVector(binormal,Math.sin(angle)*r);a.setXYZ(i*(this.sides+1)+k,q.x,q.y,q.z);}
  }a.needsUpdate=true;this.geometry.computeVertexNormals();
 }
}
export function curve(parent,mat,points,radius=.01,segments=48,radiusEnd=null) {
 if(radiusEnd!==null){const s=new Skin(parent,mat,[radius,radius*.85,radiusEnd],segments,12);s.update(points);return s.mesh;}
 const m=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(vec)),segments,radius,10,false),mat);parent.add(m);return m;
}
export function joint(parent,position) {return group(parent,position);}
export function solveLimb(root,target,upper,lower,pole) {
 const a=vec(root),b=vec(target),direction=b.clone().sub(a),d=Math.max(.0001,Math.min(upper+lower-.0001,direction.length()));direction.normalize();
 const along=(upper*upper-lower*lower+d*d)/(2*d),height=Math.sqrt(Math.max(0,upper*upper-along*along));
 const bend=vec(pole).addScaledVector(direction,-vec(pole).dot(direction)).normalize();
 const elbow=a.clone().addScaledVector(direction,along).addScaledVector(bend,height),end=a.clone().addScaledVector(direction,d);
 return [root,elbow.toArray(),end.toArray()];
}
// A gently cambered feather: volumetric curvature + painted alpha barbs.
export function feather(parent,mat,width,length) {
 const rows=18,cols=6,p=[],uv=[],idx=[];
 for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){const u=j/cols,v=i/rows;p.push((u-.5)*width,v*length,-Math.sin(v*Math.PI)*length*.035+(u-.5)**2*width*.25);uv.push(.16+u*.68,.15+v*.82);
  if(i<rows&&j<cols){const a=i*(cols+1)+j,b=a+cols+1;idx.push(a,a+1,b,a+1,b+1,b);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();const m=new T.Mesh(g,mat);parent.add(m);return m;
}
export function disposeTree(root) {
 const geometries=new Set(),materials=new Set(),textures=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
 for(const m of materials){for(const k of ['map','bumpMap','emissiveMap','alphaMap'])if(m[k])textures.add(m[k]);m.dispose();}for(const g of geometries)g.dispose();for(const t of textures)t.dispose();
}
