import {T,group,ellipsoid,material,Skin,curve,solveLimb} from './geometry.js';
import {texture} from './stage.js';
import {eyes,glance} from './face.js';
import {smooth} from '../math.js';
import {track} from '../performance.js';
export async function create(){
 const root=new T.Group(),body=group(root),map=await texture('turtle-scales',1.5),skin=material('#d2eed3',{map,bumpMap:map,bumpScale:.003,roughness:.79}),shell=material('#235e50',{roughness:.82,metalness:.03}),edge=material('#b9ad6d',{metalness:.19,roughness:.68}),scute=material('#417c60',{roughness:.75,metalness:.04,map,bumpMap:map,bumpScale:.002}),glow=material('#a4ffd5',{emissive:'#4bfdc8',emissiveIntensity:.4,roughness:.2}),mouth=material('#264b42');
 ellipsoid(body,skin,[0,.35,-.06],[.31,.20,.32]);ellipsoid(body,shell,[0,.43,-.105],[.37,.28,.37]);ellipsoid(body,edge,[0,.34,-.09],[.385,.046,.385]);
 // Separate convex plates follow the curved shell instead of a flat hex bitmap.
 const plates=[];for(let row=0;row<4;row++)for(let j=0;j<12;j++){
  const a=j/12*Math.PI*2+(row%2?Math.PI/12:0),theta=.18+row*.37,r=.37*Math.sin(theta),x=Math.cos(a)*r,z=-.105+Math.sin(a)*r,y=.43+.28*Math.cos(theta);
  const g=group(body,[x,y,z]),normal=new T.Vector3(x/.37**2,(y-.43)/.28**2,(z+.105)/.37**2).normalize();g.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),normal);
  const radius=.049+row*.008,plate=new T.Mesh(new T.CylinderGeometry(radius,radius*1.01,.023,6,1),j%3?scute:shell);g.add(plate);
  const rim=new T.Mesh(new T.TorusGeometry(radius,.0023,5,6),edge);rim.rotation.x=Math.PI/2;rim.position.y=.013;g.add(rim);plates.push({g,baseY:y});
 }
 const crown=ellipsoid(body,glow,[0,.724,-.105],[.056,.017,.056]);
 const neck=new Skin(root,skin,[.099,.09,.082,.083],25,16),head=group(root);
 ellipsoid(head,skin,[0,0,0],[.173,.131,.163]);ellipsoid(head,skin,[0,-.040,.120],[.13,.070,.071]);ellipsoid(head,edge,[0,-.06,.176],[.086,.021,.015]);curve(head,mouth,[[-.092,-.044,.170],[0,-.069,.188],[.092,-.044,.170]],.0035);
 const eyeSet=eyes(head,[[-.100,.030,.145],[.100,.030,.145]],.049,'#98d6a5');for(const side of [-1,1]){const brow=ellipsoid(head,skin,[side*.108,.085,.114],[.068,.022,.045]);brow.rotation.z=side*.11;ellipsoid(head,mouth,[side*.029,-.018,.184],[.006,.004,.003]);}
 const legs=[];for(const front of [false,true])for(const side of [-1,1]){const mesh=new Skin(root,skin,[.072,.063,.050,.043],26,14),foot=group(root);ellipsoid(foot,skin,[0,0,.025],[.080,.043,.081]);for(let i=0;i<3;i++)ellipsoid(foot,edge,[(i-1)*.035,-.003,.089],[.015,.009,.023]);legs.push({mesh,foot,side,front});}
 const tail=new Skin(body,skin,[.045,.025,.002],18,10);tail.update([[0,.32,-.36],[0,.27,-.48],[0,.23,-.53]]);
 const ward=group(root,[-.23,.43,.29]);ellipsoid(ward,glow,[0,0,0],[.022,.022,.022]);
 return {root,bounds:[-.8,.8,1.3,-.3],rim:'#8effd2',head,legs,ward,contacts:[ward],
  update(p){const t=p.t||0,side=p.variant?-1:1,cast=p.cast??smooth(1.5,2.48,t),yaw=side*track([[0,-.3],[1.2,-.18],[1.94,.05],[2.48,0],[3.85,0]],t);
   body.rotation.y=yaw;body.rotation.z=Math.sin(t*2)*.012;const headY=.49+smooth(.4,1.55,t)*.13,headZ=.295+smooth(.45,1.4,t)*.065;
   neck.update([[0,.38,.12],[0,.47,.24],[0,headY,headZ]]);head.position.set(Math.sin(yaw)*.12,headY,headZ);head.rotation.y=-yaw*.35;head.rotation.x=-cast*.12+Math.sin(t*2.5-.5)*.014;glance(eyeSet,t,.8);
   for(const leg of legs){const frontZ=leg.front?.2:-.27,plant=smooth(1.4,1.94,t),rootP=[leg.side*.23,.33,frontZ],lift=leg.front&&leg.side<0?cast*.29:0,foot=[leg.side*(.31+cast*.018),.08+lift,frontZ+.16*leg.front];
    const chain=solveLimb(rootP,foot,.155,.16,[leg.side,0,-.2]);leg.mesh.update(chain);leg.foot.position.set(...chain[2]);leg.foot.rotation.z=leg.side*.2-lift*1.4;leg.foot.rotation.x=-cast*.1;
   }
   for(let i=0;i<plates.length;i++){const pl=plates[i];pl.g.position.y=pl.baseY+cast*.008*Math.sin(t*5-i*.25);}
   glow.emissiveIntensity=.4+cast*(2+Math.sin(t*7)*.25);crown.scale.set(.056+cast*.016,.017,.056+cast*.016);
   ward.position.set(-.24,.43+cast*.05,.29);ward.scale.setScalar(.8+cast*.6);
  }};
}
