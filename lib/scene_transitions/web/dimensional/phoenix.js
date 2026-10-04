import {T,group,ellipsoid,material,Skin,curve,feather} from './geometry.js';
import {texture} from './stage.js';
import {eyes,glance} from './face.js';
import {wingPose} from './phoenix-motion.js';
import {smooth} from '../math.js';
export async function create(){
 const root=new T.Group(),body=group(root),map=await texture('phoenix-feather');map.wrapS=map.wrapT=T.ClampToEdgeWrapping;
 const plume=material('#fff3da',{map,emissiveMap:map,emissive:'#ff8c22',emissiveIntensity:.28,side:T.DoubleSide,alphaTest:.13,roughness:.58}),red=material('#a54118',{roughness:.65}),orange=material('#e98929',{roughness:.57}),gold=material('#ffce62',{metalness:.25,roughness:.33}),dark=material('#522818');
 ellipsoid(body,red,[0,0,0],[.118,.19,.105]);ellipsoid(body,orange,[0,.09,.058],[.09,.125,.085]);
 // Layered breast plumage, each feather curved and rooted in the body.
 for(let row=0;row<5;row++)for(let j=0;j<5;j++){const x=(j-2)*(.030-row*.002),y=.12-row*.051,z=.085+Math.sqrt(Math.max(0,1-(x/.13)**2))*.017;const f=feather(body,plume,.072,.15);f.position.set(x,y,z);f.rotation.z=Math.PI+(j-2)*.08;f.rotation.x=-.25;}
 const head=group(body,[0,.205,.01]);ellipsoid(head,orange,[0,0,0],[.102,.123,.092]);ellipsoid(head,red,[0,.040,-.035],[.098,.102,.077]);
 const eyeSet=eyes(head,[[-.054,.027,.08],[.054,.027,.08]],.033,'#efb054');
 for(const side of [-1,1]){const brow=ellipsoid(head,orange,[side*.054,.064,.061],[.044,.014,.032]);brow.rotation.z=side*-.08;}
 const beak=new Skin(head,gold,[.031,.027,.011,.001],24,14);beak.update([[0,-.006,.083],[0,-.014,.138],[0,-.054,.177]]);
 const jaw=group(head,[0,-.031,.090]);const lower=new Skin(jaw,gold,[.020,.016,.001],18,12);lower.update([[0,0,0],[0,-.014,.043],[0,-.023,.068]]);
 const crests=[];for(let i=0;i<7;i++){const g=group(head,[(i-3)*.018,.059,-.008]);const f=feather(g,plume,.062,.202-Math.abs(i-3)*.026);f.rotation.z=(i-3)*-.16;f.rotation.x=-.18;crests.push(g);}
 for(const side of [-1,1])for(let i=0;i<4;i++){const f=feather(head,plume,.056,.145);f.position.set(side*(.058+i*.01),.025-i*.021,.015);f.rotation.z=side*(1.7+i*.15);}
 const wings=[];
 for(const side of [-1,1]){
  const shoulder=group(body,[side*.115,.08,-.01]);shoulder.scale.x=side;
  ellipsoid(shoulder,red,[.13,0,0],[.17,.068,.06]);const elbow=group(shoulder,[.3,0,0]);ellipsoid(elbow,orange,[.125,0,0],[.157,.053,.045]);const wrist=group(elbow,[.28,0,0]);
  const feathers=[];
  for(let i=0;i<10;i++){const g=group(shoulder,[.025+i*.030,-.012,.005+i*.0005]),f=feather(g,plume,.12,.22+i*.011);f.rotation.z=2.85-i*.043;f.rotation.x=-.08;feathers.push({g,primary:false,index:i});}
  for(let i=0;i<9;i++){const g=group(elbow,[.006+i*.033,-.010,.012+i*.001]),f=feather(g,plume,.132,.31+i*.005);f.rotation.z=2.60-i*.043;f.rotation.x=-.05;feathers.push({g,primary:false,index:i+9});}
  for(let i=0;i<12;i++){const g=group(wrist,[i*.006,-i*.008,.027+i*.0015]),f=feather(g,plume,.147,.37+(i<6?i*.014:(11-i)*.009));f.rotation.z=-1.45-i*.103;f.rotation.x=.08;feathers.push({g,primary:true,index:i});}
  // Coverts hide the long bones and preserve a continuous layered wing surface.
  for(let row=0;row<3;row++)for(let i=0;i<16;i++){const p=i<8?shoulder:elbow,j=i%8,f=feather(p,plume,.095,.17-row*.019);f.position.set(-.025+j*.040,.068-row*.026,.052+row*.014);f.rotation.z=2.74-j*.025;f.rotation.x=-.12;}
  for(let row=0;row<3;row++)for(let i=0;i<9;i++){const f=feather(wrist,plume,.135,.21-row*.024);f.position.set(-.025+i*.019,.053-row*.025-i*.004,.056+row*.012);f.rotation.z=-1.75-i*.065;}
  const tip=group(wrist,[.37,0,0]);wings.push({side,shoulder,elbow,wrist,feathers,tip});
 }
 const tail=group(body,[0,-.12,-.037]),tails=[];
 for(let i=0;i<9;i++){const g=group(tail,[(i-4)*.013,0,-Math.abs(i-4)*.003]),f=feather(g,plume,.137,.62-Math.abs(i-4)*.041);f.rotation.z=Math.PI+(i-4)*.096;f.rotation.x=.15;tails.push(g);}
 const feet=[];for(const side of [-1,1]){const g=group(body,[side*.054,-.13,.015]);const leg=new Skin(g,dark,[.018,.015,.012],18,10);leg.update([[0,0,0],[0,-.06,.025],[0,-.09,.035]]);for(let i=0;i<3;i++)curve(g,gold,[[(i-1)*.007,-.08,.033],[(i-1)*.021,-.096,.068],[(i-1)*.024,-.119,.066]],.006,16,.001);feet.push(g);}
 return {root,bounds:[-1.1,1.1,1.15,-1.05],rim:'#ffae4e',head,wings,tail,contacts:wings.map(w=>w.tip),
  update(p){const t=p.t||0,w=wingPose(t);body.rotation.y=Math.sin((t-1.12)*2.2)*.13*(1-w.prepare);body.rotation.x=-.03+Math.sin(w.phase-.4)*.045*(1-w.prepare);body.position.y=Math.sin(w.phase-.25)*.012*(1-w.prepare);head.rotation.y=-body.rotation.y*.7;head.rotation.x=-.03+Math.sin(w.phase-.75)*.025;glance(eyeSet,t,.3);jaw.rotation.x=w.prepare*.15;
   for(const wing of wings){wing.shoulder.rotation.z=w.angle;wing.shoulder.rotation.y=Math.sin(w.phase-.4)*.13*(1-w.prepare);wing.elbow.rotation.z=w.elbow;wing.wrist.rotation.z=w.wrist;wing.wrist.rotation.x=Math.sin(w.phase-1)*.08*(1-w.prepare);
    for(const f of wing.feathers){f.g.rotation.z=Math.sin(w.phase-f.index*.045-.85)*.018*(1-w.prepare);f.g.rotation.x=Math.sin(w.phase-f.index*.06-1.1)*.045*(1-w.prepare)+(f.primary?w.strike*.06:0);}
   }
   tails.forEach((g,i)=>{g.rotation.x=Math.sin(w.phase-i*.12-1.8)*.11*(1-w.prepare);g.rotation.z=Math.sin(t*3-i*.16)*.04;});tail.rotation.y=-body.rotation.y*.5;
   crests.forEach((g,i)=>g.rotation.x=Math.sin(w.phase-i*.1-.9)*.04);feet.forEach(g=>g.rotation.x=-.45-smooth(1.3,1.9,t)*.5);
   plume.emissiveIntensity=.28+w.prepare*.18;
  }};
}
