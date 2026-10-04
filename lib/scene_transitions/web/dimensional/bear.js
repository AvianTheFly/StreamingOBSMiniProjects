import {T,group,ellipsoid,material,Skin,solveLimb,curve} from './geometry.js';
import {texture} from './stage.js';
import {eyes,glance} from './face.js';
import {coat} from './coat.js';
import {acting} from './bear-motion.js';
import {smooth} from '../math.js';
export async function create(){
 const root=new T.Group(),torso=group(root),map=await texture('bear-fur',1.5),fur=material('#c1cbdf',{map,bumpMap:map,bumpScale:.004,roughness:.87}),muzzle=material('#8c9eb3',{roughness:.8}),dark=material('#142339'),claw=material('#e4e4df',{roughness:.27}),blue=material('#49c9ff',{emissive:'#40c7ff',emissiveIntensity:1.6,roughness:.28});
 ellipsoid(torso,fur,[0,.49,-.035],[.265,.34,.18]);ellipsoid(torso,fur,[0,.64,0],[.325,.19,.18]);coat(torso,fur,[0,.58,-.012],[.294,.23,.172],230,.048);
 const head=group(torso,[0,.80,.028]);ellipsoid(head,fur,[0,0,0],[.207,.195,.174]);coat(head,fur,[0,-.025,-.012],[.203,.159,.162],140,.033);
 for(const side of [-1,1]){const ear=group(head,[side*.17,.142,-.007]);ellipsoid(ear,fur,[0,0,0],[.078,.077,.044]);ellipsoid(ear,muzzle,[0,0,.035],[.047,.052,.017]);}
 ellipsoid(head,muzzle,[0,-.055,.145],[.141,.081,.077]);ellipsoid(head,dark,[0,-.014,.206],[.071,.042,.032]);
 const jaw=group(head,[0,-.104,.155]);ellipsoid(jaw,muzzle,[0,-.007,0],[.116,.030,.060]);curve(head,dark,[[-.09,-.09,.191],[0,-.105,.215],[.09,-.09,.191]],.003);
 const eyeSet=eyes(head,[[-.091,.039,.169],[.091,.039,.169]],.048,'#5cdaff');
 for(const side of [-1,1]){const brow=ellipsoid(head,fur,[side*.090,.103,.14],[.069,.018,.030]);brow.rotation.z=side*-.11;}
 // Inset storm crest and small lightning inlays, carried by the torso.
 for(const side of [-1,1])curve(torso,blue,[[side*.12,.65,.16],[side*.067,.59,.18],[side*.085,.55,.181],[0,.49,.183]],.005);
 ellipsoid(torso,blue,[0,.48,.184],[.017,.024,.007]);
 const arms=[-1,1].map(side=>{
  const skin=new Skin(root,fur,[.105,.098,.077,.070,.056],34,16),hand=group(root);
  ellipsoid(hand,fur,[0,-.02,.018],[.081,.071,.068]);
  for(let i=0;i<3;i++){const x=(i-1)*.035;ellipsoid(hand,fur,[x,-.063,.043],[.025,.039,.034]);curve(hand,claw,[[x,-.074,.055],[x,-.106,.079],[x,-.13,.068]],.010,18,.0005);}
  const tip=group(hand,[0,-.13,.068]);return {skin,hand,side,tip};
 });
 const legs=[-1,1].map(side=>{const skin=new Skin(root,fur,[.115,.105,.075,.07],28,16),foot=group(root);ellipsoid(foot,fur,[0,.035,.035],[.11,.068,.145]);
  for(let i=0;i<4;i++)ellipsoid(foot,claw,[(i-1.5)*.037,.024,.161],[.014,.012,.030]);return {skin,foot,side};});
 return {root,bounds:[-.8,.8,1.3,-.3],rim:'#59caff',arms,legs,head,contacts:arms.map(a=>a.tip),
  update(p){const t=p.t||0,act=p.paws?p:acting(t),yaw=act.yaw??act.twist*.44,stride=p.stride??0;
   torso.rotation.y=yaw;torso.rotation.z=Math.sin(t*6)*stride*.035;torso.scale.y=1+Math.sin(t*3)*.008;head.rotation.y=-yaw*.45;head.rotation.x=Math.sin(t*13-.4)*stride*.04;head.rotation.z=Math.sin(t*3-.4)*.022;glance(eyeSet,t,.6);
   jaw.rotation.x=smooth(1.9,2.15,t)*.22*(1-smooth(3.3,3.65,t));
   for(let i=0;i<2;i++){const {skin,hand,side}=arms[i],angle=act.handAngles?.[i]||0,paw=act.paws[i],reach=[paw[0]-Math.sin(angle)*.13,-paw[1]+Math.cos(angle)*.13,.2];
    const shoulder=[act.roots[i][0],-act.roots[i][1],-side*.245*Math.sin(yaw)];
    const chain=solveLimb(shoulder,reach,.285,.26,[side*.6,-.1,-.6]);skin.update([chain[0],chain[1],chain[2]]);hand.position.set(...chain[2]);hand.rotation.z=angle;
   }
   for(const leg of legs){const phase=t*13+(leg.side===1?Math.PI:0),s=Math.sin(phase)*stride,lift=Math.max(0,Math.sin(phase))*.105*stride,foot=[leg.side*.17,.005+lift,Math.cos(phase)*.14*stride];
    const hip=[leg.side*.145,.35,-.03],knee=[leg.side*.17,.19+lift*.3,.075-s*.1];leg.skin.update([hip,knee,foot]);leg.foot.position.set(...foot);leg.foot.rotation.x=-s*.17;
   }
  }};
}
