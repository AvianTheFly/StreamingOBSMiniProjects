// Finite source-paint, articulated mount, flight-view and storm coverage checks.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {serve}=require('./spirit_fixture.cjs');
const out=process.env.SPIRIT_OUTPUT||'C:/StreamingMedia/Transitions/udyr-spirits-v17-phoenix-flight';
(async()=>{const f=await serve(),browser=await chromium.launch({channel:'chrome',headless:true});
 try{const page=await browser.newPage();await page.goto(f.url);await page.waitForFunction(()=>!!window.spiritPreview);
 const proof=await page.evaluate(async()=>{
  const {Character}=await import('./characters.js'),{SpiritTransition}=await import('./renderer.js');
  const {anatomy}=await import('./rigs/phoenix/anatomy.js'),m=await import('./rigs/phoenix/motion.js'),g=await import('./rigs/phoenix/projection.js');
  const {flight,fronts}=await import('./phoenix.js'),{world}=await import('./performance.js');
  const actor=await new Character().load('phoenix'),parts=actor.parts;
  const turned=await import('./rigs/phoenix/turned.js');
  const check=(p,message)=>{if(!p)throw Error(message);},distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  check(parts.body.length===4&&parts.wings.length===2,'Missing new camera or wing surfaces');
  const paintAt=(part,uv)=>{const c=part.image.getContext('2d'),x=Math.round(uv[0]*(part.w-1)),y=Math.round(uv[1]*(part.h-1));return c.getImageData(Math.max(0,x-3),Math.max(0,y-3),7,7).data.some((n,i)=>i%4===3&&n>80);};
  for(const [key,part] of parts.body.entries()){
   check(Math.abs(part.w/part.h-anatomy.widths[key]/anatomy.height)<1e-9,'Body paint stretched');
   for(const uv of [...anatomy.shoulders[key],...anatomy.hips[key],anatomy.rump[key]])check(paintAt(part,uv),'An anatomical mount is outside its authored body paint: '+key+' / '+uv);
  }
  for(const part of parts.wings){check(paintAt(part,anatomy.wingContact),'Wing-origin effect contact is outside primary feather paint');check(paintAt(part,anatomy.castContact),'Central cast contact misses feather paint');}
  const fullPoseChecks=[];const poseCanvas=document.createElement('canvas');poseCanvas.width=1800;poseCanvas.height=1400;
  for(const [view,t] of [[1,1.48],[2,1.72],[3,1.94]]){
   let frontalCalls=0,turnedCalls=0;const frame=turned.paintedFrame[view],paint=parts.flight[view][frame];
   const previous=paint.mesh.draw;paint.mesh.draw=function(...args){turnedCalls++;return previous.apply(this,args);};
   const previousWings=parts.wings.map(p=>p.mesh.draw);parts.wings.forEach(p=>{p.mesh.draw=()=>{frontalCalls++;throw Error('Frontal wings painted over a turned body');};});
   try{actor.draw(poseCanvas.getContext('2d'),{x:900,y:700,size:500,t});check(turnedCalls>0&&frontalCalls===0,'Complete turned anatomy is not used');}
   finally{paint.mesh.draw=previous;parts.wings.forEach((p,i)=>{p.mesh.draw=previousWings[i];});}
   let minimum=Infinity;for(let u=.01;u<.98;u+=.08)for(let v=.01;v<.98;v+=.08){const p=turned.point(parts,view,frame,u,v,t),x=turned.point(parts,view,frame,u+.0001,v,t),y=turned.point(parts,view,frame,u,v+.0001,t),area=((x[0]-p[0])*(y[1]-p[1])-(x[1]-p[1])*(y[0]-p[0]))/1e-8;minimum=Math.min(minimum,area);check(area>.1,'Turned anatomy mesh folds');}
   fullPoseChecks.push({view,frame,turnedCalls,frontalCalls,minimumArea:minimum});
  }
  const maxima=[0,0,0,0];let samples=0,maxBoneError=0,maxRootError=0,minWingArea=Infinity,mirroredChecks=0;
  const toePaths=[[],[]],tailPoints=[];
  for(let t=1.12;t<=3.40;t+=1/120){
   const layers=m.bodyViews(t);check(Math.abs(layers.reduce((s,l)=>s+l.weight,0)-1)<1e-12,'Incomplete view weights');
   layers.forEach(l=>{maxima[l.key]=Math.max(maxima[l.key],l.weight);});
   for(const side of [-1,1]){
    const root=g.wingPoint(t,side,...anatomy.wingRoot),error=distance(root,g.mount('shoulders',t,side));maxRootError=Math.max(maxRootError,error);check(error<1e-9,'Wing detached from shoulder paint');
    const chain=g.legChain(t,side);check(distance(chain.points[0],g.mount('hips',t,side))<1e-9,'Talon leg detached from hip paint');
    for(let i=0;i<3;i++){const boneError=Math.abs(distance(chain.points[i],chain.points[i+1])-anatomy.legLengths[i]);maxBoneError=Math.max(maxBoneError,boneError);check(boneError<1e-9,'Leg changes bone length');}
    toePaths[side<0?0:1].push(chain.points.at(-1));
    for(let u=.02;u<.99;u+=.08)for(let v=.03;v<.99;v+=.08){
     const p=g.wingPoint(t,side,u,v),x=g.wingPoint(t,side,u+.0001,v),y=g.wingPoint(t,side,u,v+.0001);
     const area=((x[0]-p[0])*(y[1]-p[1])-(x[1]-p[1])*(y[0]-p[0]))/1e-8*(-side);
     minWingArea=Math.min(minWingArea,area);check(area>.001,'Wing surface folds or collapses: '+[t,side,u,v,area]);
     check(g.legPoint(t,side,u,v).every(Number.isFinite),'Invalid articulated leg vertex');
    }
    const contact=g.wingTip(t,side),mirror=g.wingTip(t,side,1);check(distance(mirror,[-contact[0],contact[1]])<1e-9,'Alternate contact is not mirrored');mirroredChecks++;
   }
   check(distance(g.tailPoint(t,.5,0),g.mount('rump',t))<1e-9,'Tail detached from rump paint');tailPoints.push(g.tailPoint(t,.5,1));samples++;
  }
  check(maxima.every(x=>x>.98),'An authored camera angle is never actually used');
  const range=path=>Math.max(...path.map(p=>p[0]))-Math.min(...path.map(p=>p[0]))+Math.max(...path.map(p=>p[1]))-Math.min(...path.map(p=>p[1]));
  const toeTravel=toePaths.map(range),tailTravel=range(tailPoints);check(toeTravel.every(x=>x>.10),'Talons do not articulate');check(tailTravel>.10,'Tail has no secondary motion');
  const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=1300;const c=canvas.getContext('2d');let paintedContacts=0;
  for(const t of [1.45,1.80,2.20,2.43,2.80,3.16,3.30])for(const side of [-1,1])for(const part of parts.wings){
   c.clearRect(0,0,1800,1300);c.save();c.translate(900,500);c.scale(700,700);part.mesh.draw(c,(u,v)=>g.wingPoint(t,side,u,v));c.restore();
   const point=g.wingTip(t,side),x=Math.round(900+point[0]*700),y=Math.round(500+point[1]*700),pixels=c.getImageData(x-10,y-10,21,21).data;
   check(pixels.some((n,i)=>i%4===3&&n>80),'Projected storm contact misses visible wing feathers');paintedContacts++;
  }
  const show=await new SpiritTransition(document.createElement('canvas')).load('phoenix');show.draw(2.17);const first=show.canvas.toDataURL('image/png');show.draw(4.10);show.draw(1.60);show.draw(2.17);check(show.canvas.toDataURL('image/png')===first,'Phoenix exported PNG depends on scrub history');
  for(const variant of [0,1]){await show.load(variant?'phoenix-alt':'phoenix');for(const t of [3.16,3.30,3.70]){
   const expected=actor.contacts({...flight(t,variant),t},'cast').sort((a,b)=>a[0]-b[0]),actual=fronts(show,t);check(JSON.stringify(expected)===JSON.stringify(actual),'Storm front is not the painted wing contact');}}
  const central=fronts(show,3.16);check(central.every(p=>p[0]>500&&p[0]<1420&&p[1]>150&&p[1]<700),'Wing release spots are not central');
  const flightChecks=[];for(const variant of [0,1])for(const t of [1.96,2.64]){
   const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;actor.draw(canvas.getContext('2d'),{...flight(t,variant),t});
   const alpha=canvas.getContext('2d').getImageData(0,0,1920,1080).data;let visible=0;for(let i=3;i<alpha.length;i+=4)if(alpha[i]>20)visible++;
   check(visible===0,'Bird does not fully leave the viewport at the direction change');flightChecks.push({variant,t,visible});
  }
  const volume=show.flame;show.dispose();check(volume.volume===null&&volume.ash===null,'Disposed storm retains its generation');actor.dispose();check(actor.parts===null,'Disposed actor retains paint buffers');
  return {samples,maxima,maxBoneError,maxRootError,minWingArea,mirroredChecks,toeTravel,tailTravel,paintedContacts,fullPoseChecks,flightChecks,centralReleaseSpots:central,bodyViews:4,completeTurnedAngles:3,frontalWingSurfaces:2,frontalArticulatedLegs:2,deterministicScrub:true,stormContactAttachment:true,resourceRelease:true};
 });assert(proof.samples>250);fs.writeFileSync(out+'/phoenix-rig-validation.json',JSON.stringify(proof,null,2));console.log('Four used camera views, two wing surfaces, fixed articulated legs, tail/shoulder paint binding, visible storm contacts and deterministic release passed');
 }finally{await browser.close();f.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
