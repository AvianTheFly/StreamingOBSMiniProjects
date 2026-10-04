// Bear anatomy proof: rendered skin anchors, fixed bone lengths and world-space support.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {serve}=require('./spirit_fixture.cjs');
(async()=>{const fixture=await serve(),browser=await chromium.launch({headless:true,channel:'chrome'});
 try{const page=await browser.newPage();await page.goto(fixture.url);await page.waitForFunction(()=>!!window.spiritPreview);
 const proof=await page.evaluate(async()=>{
 const m=await import('./rigs/bear/motion.js'),{arrival,slashPoint}=await import('./bear.js'),{world}=await import('./performance.js');
 const {anatomy,bodyPoint}=await import('./rigs/bear/calibration.js'),{skinPoint}=await import('./rigs/bear/skin.js'),{Character}=await import('./characters.js');
 const actor=await new Character().load('bear');let samples=0,anchorChecks=0,maxBoneError=0,maxWorldSlide=0;
 const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),check=(condition,message)=>{if(!condition)throw Error(message);};
 check(Math.abs(actor.parts.cells[0].w/actor.parts.cells[0].h-anatomy.width/anatomy.height)<.03,'Body aspect ratio stretches the painted anatomy');
 for(let i=0;i<m.swipes.length;i++)check(Math.abs(m.swipes[i].at+m.swipes[i].duration/2-[2.18,2.68,3.18][i])<1e-9,'Peak strike speed misses existing audio/camera beat');
 for(const variant of [0,1])for(let t=1.7;t<=3.8;t+=1/240){
  const a=m.quarterActing(t,variant),pose=arrival(t,variant),canonical=m.quarterActing(t),side=m.direction(variant);
  check(a.planted.some(Boolean),'Both forepaws lifted');
  for(let i=0;i<2;i++){
   const leg=a.legs[i],source=anatomy.skins[i],part=actor.parts.cells[i+2];
   const d=distance(leg.root,leg.paw),angle=Math.acos((leg.lengths[0]**2+leg.lengths[1]**2-d*d)/(2*leg.lengths[0]*leg.lengths[1]))*180/Math.PI;
   check(angle>65&&angle<175,`Elbow outside authored limits at ${t.toFixed(4)}s, hand ${i}: ${angle.toFixed(2)} degrees`);
   for(const [p,q,length] of [[leg.root,leg.elbow,leg.lengths[0]],[leg.elbow,leg.paw,leg.lengths[1]]]){
    const error=Math.abs(distance(p,q)-length);maxBoneError=Math.max(maxBoneError,error);check(error<1e-9,'Bone length changed while bending');
   }
   const authored=bodyPoint(...anatomy.shoulders[i],t);check(distance(leg.root,[authored[0]*side,authored[1]])<1e-9,'Shoulder detached from painted body');
   for(const [anchor,target] of [[source.root,canonical.legs[i].root],[source.elbow,canonical.legs[i].elbow],[source.paw,canonical.legs[i].paw]]){
    check(distance(skinPoint(part,i,canonical.legs[i],...anchor),target)<1e-9,'Painted anatomical landmark detached from bone');anchorChecks++;
   }
   if(a.planted[i]){
    check(distance(a.paws[i],[anatomy.plants[i][0]*side,anatomy.plants[i][1]])<.002,'Planted forepaw moves locally');
    const slide=distance(world(pose,a.paws[i]),world(arrival(1.7,variant),[anatomy.plants[i][0]*side,anatomy.plants[i][1]]));
    maxWorldSlide=Math.max(maxWorldSlide,slide);check(slide<1.5,'Body translation/scale makes planted paw slide in the picture');
   }
   const prev=m.quarterActing(t-.0001,variant),next=m.quarterActing(t+.0001,variant);
   check(distance(next.paws[i],prev.paws[i])<.004,'Paw motion discontinuity');
   for(let v=0;v<=1;v+=.05)for(const u of [0,.25,.5,.75,1]){
    check(skinPoint(part,i,canonical.legs[i],u,v).every(Number.isFinite),'Invalid painted skin geometry');
   }
  }samples++;
 }
 check(m.views(.5).side===1&&m.views(1.7).quarter===1,'Missing completed side-to-quarter turn');
 check(anatomy.skins[1].depth<anatomy.skins[0].depth,'Far limb perspective missing');
 actor.dispose();return {samples,anchorChecks,maxBoneError,maxWorldSlide,quarterRigCalibration:true,fixedBoneLengths:true,bodyShoulderAttachment:true,retainedQuarterSupport:true};
 });assert(proof.samples>900);
 fs.writeFileSync((process.env.SPIRIT_OUTPUT||'C:/StreamingMedia/Transitions/udyr-spirits-v11')+'/bear-motion-validation.json',JSON.stringify(proof,null,2));
 console.log('Retained quarter-rig painted landmarks, constant bones and support calibration passed');
 }finally{await browser.close();fixture.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
