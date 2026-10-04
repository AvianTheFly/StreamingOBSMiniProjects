// Instanced sculpted fur tips. Authored deterministic placement, fixed draw budget.
import {T,vec} from './geometry.js';
export function coat(parent,mat,center,radii,count=180,length=.035) {
 const geo=new T.ConeGeometry(.018,1,7,2),mesh=new T.InstancedMesh(geo,mat,count),dummy=new T.Object3D(),up=new T.Vector3(0,1,0);
 for(let i=0;i<count;i++){
  const y=1-2*(i+.5)/count,phi=i*2.39996323,r=Math.sqrt(1-y*y),normal=vec([Math.cos(phi)*r,y,Math.sin(phi)*r]);
  dummy.position.set(center[0]+normal.x*radii[0],center[1]+normal.y*radii[1],center[2]+normal.z*radii[2]);
  const direction=normal.clone().multiplyScalar(.45).add(new T.Vector3(0,-.8,0)).normalize();dummy.quaternion.setFromUnitVectors(up,direction);
  dummy.scale.set(1+.25*Math.sin(i*7),length*(.75+.25*Math.sin(i*13)),1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
 }parent.add(mesh);return mesh;
}
