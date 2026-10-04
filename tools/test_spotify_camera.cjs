// Three-axis orientation is a rigid XYZ transform before perspective, not a
// screen-space skew. Its audible clock and framing preserve musical gesture.
const assert=require('node:assert/strict');
const Depth=require('../mini projects/spotify/web/stage_depth.js');
const Motion=require('../mini projects/spotify/web/music_motion.js');
const Space=require('../mini projects/spotify/web/music_space.js');
const points=[[100,30,0],[-70,40,60],[20,-55,-30],[0,0,140]];
const identity=Depth.camera({space:{yaw:0,tilt:0,roll:0}});
for(const p of points){
 const scale=(280+p[2])/280*identity.lens.focal/(identity.lens.focal+p[2])*identity.lens.framing;
 const expected=[p[0]*scale,p[1]*scale,p[2]];
 identity(p).forEach((v,k)=>assert(Math.abs(v-expected[k])<1e-9,'front view preserves rigid authored positions under the fixed lens'));
}
const yaw=Depth.camera({space:{yaw:.6,tilt:0,roll:0}});
const pitch=Depth.camera({space:{yaw:0,tilt:.4,roll:0}});
const roll=Depth.camera({space:{yaw:0,tilt:0,roll:.15}});
assert(yaw([100,0,0])[2]<-40,'side rotation moves a point through actual depth');
assert(pitch([0,60,0])[2]>20,'overhead rotation changes actual depth');
const unproject=(p,lens)=>{const s=Math.max(48,lens.focal+p[2])/lens.focal/lens.framing;return [p[0]*s,p[1]*s,p[2]];};
assert(unproject(roll([100,0,0]),roll.lens)[1]>14,'the third axis turns the actual viewed plane');
const model=p=>[p[0]*(280+p[2])/280,p[1]*(280+p[2])/280,p[2]];
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
let maximumDistanceError=0,minimumFraming=1;
for(const y of Array.from({length:13},(_,i)=>-.72+i*.12))for(const t of Array.from({length:13},(_,i)=>-.46+i*.92/12))for(const r of [-.18,-.09,0,.09,.18]){
 const view=Depth.camera({space:{yaw:y,tilt:t,roll:r}});minimumFraming=Math.min(minimumFraming,view.lens.framing);
 const moved=points.map(p=>unproject(view(p),view.lens));
 for(let a=0;a<points.length;a++)for(let b=0;b<a;b++){
  const error=Math.abs(distance(moved[a],moved[b])-distance(model(points[a]),model(points[b])));
  maximumDistanceError=Math.max(maximumDistanceError,error);assert(error<1e-8,'viewing angles cannot shear the sculpture');
 }
 for(const x of [-180,180])for(const h of [-94,94])for(const z of [-50,100]){
  const p=view([x,h,z]);assert(p.every(Number.isFinite));
  assert(Math.abs(p[0])<=188.0001&&Math.abs(p[1])<=100.0001,'authored view volume fits the overlay at every extreme');
 }
 assert.equal(view.lens.focal,identity.lens.focal);assert.equal(view.lens.framing,identity.lens.framing,'camera orientation cannot manufacture a zoom');
}
const signal={energy:.4,loudness:.3,bands:Array(48).fill(.25),voice_levels:Array(8).fill(.14),
 width:.65,balance:.15,roughness:.3,noisiness:.2,tonality:.8,beat:0};
function study(dt){
 const motion=new Motion(),space=new Space();const range={yaw:[Infinity,-Infinity],tilt:[Infinity,-Infinity],roll:[Infinity,-Infinity]};
 for(let i=0;i<120/dt;i++){
  motion.step(signal,dt);space.step(motion,signal,dt);
  for(const k of Object.keys(range)){range[k][0]=Math.min(range[k][0],space[k]);range[k][1]=Math.max(range[k][1],space[k]);}
 }
 const held=JSON.stringify(space.snapshot());space.step(motion,{energy:0},dt);
 assert.equal(JSON.stringify(space.snapshot()),held,'silence holds every axis and the orbit clock');
 assert(range.yaw[1]-range.yaw[0]>.8&&range.tilt[1]-range.tilt[0]>.45&&range.roll[1]-range.roll[0]>.1,
  'ordinary sustained music must reveal visibly distinct angles on all three axes');
 return {space,range};
}
const a=study(.01),b=study(.02);
for(const k of ['yaw','tilt','roll','viewPhase'])assert(Math.abs(a.space[k]-b.space[k])<.02,'camera motion cannot depend on paint cadence: '+k);
console.log(JSON.stringify({passed:true,threeRigidAxes:true,maximumDistanceError,minimumFraming,
 audibleAngleRanges:a.range,silenceHolds:true,cadenceIndependent:true}));
