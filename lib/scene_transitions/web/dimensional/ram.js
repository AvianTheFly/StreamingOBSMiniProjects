import {T,group,ellipsoid,material,Skin,curve,solveLimb,vec} from './geometry.js';
import {texture} from './stage.js';
import {coat} from './coat.js';
import {eyes,glance} from './face.js';
import {smooth} from '../math.js';
import {track} from '../performance.js';
export async function create(){
 const root=new T.Group(),body=group(root),map=await texture('ram-fleece',1.5),wool=material('#ffffff',{map,bumpMap:map,bumpScale:.004,roughness:.9}),skin=material('#a8886d',{roughness:.8}),horn=material('#b99351',{metalness:.37,roughness:.4}),groove=material('#755a31',{roughness:.7}),hoof=material('#342e28',{roughness:.4}),gold=material('#efce79',{emissive:'#d8a33e',emissiveIntensity:.35,metalness:.5});
 ellipsoid(body,wool,[0,.43,-.12],[.239,.226,.33]);ellipsoid(body,wool,[0,.46,.13],[.25,.255,.224]);coat(body,wool,[0,.45,-.06],[.239,.216,.335],380,.024);
 const neck=group(body,[0,.5,.13]);ellipsoid(neck,wool,[0,.063,.05],[.16,.193,.165]);
 const head=group(neck,[0,.17,.12]);ellipsoid(head,skin,[0,0,0],[.121,.164,.13]);ellipsoid(head,wool,[0,.077,-.031],[.16,.10,.13]);coat(head,wool,[0,.076,-.03],[.159,.1,.125],85,.017);
 ellipsoid(head,skin,[0,-.093,.102],[.087,.064,.107]);ellipsoid(head,hoof,[0,-.092,.196],[.048,.025,.013]);curve(head,hoof,[[0,-.101,.204],[0,-.137,.18],[-.03,-.14,.17]],.002);
 const eyeSet=eyes(head,[[-.090,.029,.099],[.090,.029,.099]],.035,'#e6b04b');
 const contacts=[];for(const side of [-1,1]){const ear=group(head,[side*.13,.013,-.009]);ellipsoid(ear,skin,[side*.044,-.02,-.005],[.08,.043,.025]);ear.rotation.z=side*-.2;
  const points=[];for(let j=0;j<=64;j++){const q=j/64,a=.35+q*Math.PI*1.85,r=.18*(1-q*.61);points.push([side*(.14+.145*Math.sin(q*Math.PI*.65)),.062+Math.cos(a)*r,-.045+Math.sin(a)*r]);}
  const h=new Skin(head,horn,[.069,.055,.04,.025,.001],64,16);h.update(points);contacts.push(group(head,points.at(-1)));
  // Delicate raised horn ridges follow the actual curved horn frame.
  const path=new T.CatmullRomCurve3(points.map(vec));for(let j=1;j<20;j++){const u=j/22,p=path.getPoint(u),tangent=path.getTangent(u),rad=.069*(1-u)*.86;
   const ridge=new T.Mesh(new T.TorusGeometry(rad,.0024,6,20),groove);ridge.position.copy(p);ridge.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),tangent);head.add(ridge);}
 }
 for(const side of [-1,1])curve(neck,gold,[[side*.10,.1,.16],[side*.075,-.015,.18],[0,-.06,.185]],.008);
 const legs=[];for(const front of [false,true])for(const side of [-1,1]){const mesh=new Skin(root,skin,[.069,.052,.031,.028],28,14),foot=group(root);ellipsoid(foot,hoof,[0,.023,.016],[.047,.043,.066]);curve(foot,groove,[[0,.06,.05],[0,.017,.077],[0,0,.048]],.002);legs.push({mesh,foot,side,front});}
 const tail=group(body,[0,.48,-.43]);ellipsoid(tail,wool,[0,-.027,-.028],[.047,.066,.05]);
 return {root,bounds:[-.8,.8,1.3,-.3],rim:'#ffdfa0',head,legs,contacts,
  update(p){const t=p.t||0,side=p.variant?-1:1,stride=p.stride??1,crouch=p.crouch||0,hop=p.hop||0;
   const yaw=side*track([[0,.95],[1,.58],[1.8,-.17],[2.4,.06],[3.1,0],[3.85,0]],t);body.rotation.y=yaw;body.position.y=-crouch*.048;body.rotation.x=hop*.05;head.rotation.x=crouch*.32+(p.charge||0)*.55;head.rotation.y=-yaw*.3;head.rotation.z=Math.sin(t*6)*stride*.012;tail.rotation.y=Math.sin(t*9-.9)*stride*.16;glance(eyeSet,t,.2);
   for(const leg of legs){const phase=t*16+(leg.side>0?Math.PI:0)+(leg.front?0:1.7),s=Math.sin(phase),frontZ=leg.front?.185:-.275;
    const base=[leg.side*.175,.355-crouch*.04,frontZ],foot=[leg.side*.184,.009+Math.max(0,s)*.09*stride+hop*.11,frontZ+Math.cos(phase)*.15*stride-hop*(leg.front?.1:-.09)];
    const chain=solveLimb(base,foot,.19,.185,[0,0,leg.front?-1:1]);
    const rotate=point=>[point[0]*Math.cos(yaw)+point[2]*Math.sin(yaw),point[1],-point[0]*Math.sin(yaw)+point[2]*Math.cos(yaw)];leg.mesh.update(chain.map(rotate));leg.foot.position.set(...rotate(chain[2]));leg.foot.rotation.y=yaw;leg.foot.rotation.x=-s*.17*stride-hop*.5;
   }
  }};
}
