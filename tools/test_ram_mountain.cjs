// Finite actual-painted anatomy, pose, landing, horn and cover checks; no OBS I/O.
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const {serve}=require('./spirit_fixture.cjs');
const output=process.env.SPIRIT_OUTPUT||'C:/StreamingMedia/Transitions/udyr-spirits-v19-ram-motion';
(async()=>{const fixture=await serve(),browser=await chromium.launch({headless:true,channel:'chrome'});
 try{const page=await browser.newPage();page.on('pageerror',e=>console.error(e));await page.goto(fixture.url);
 const report=await page.evaluate(async()=>{
 const {Character}=await import('./characters.js'),{approach,acting,jumps,beats}=await import('./rigs/ram/motion.js');
 const {skinPoint,bones}=await import('./rigs/ram/skin.js'),{sourcePoint}=await import('./rigs/ram/calibration.js');
 const {SpiritTransition}=await import('./renderer.js');
 const {registration,registeredPoint,headOffsets}=await import('./rigs/ram/registration.js');
 const {viewIds}=await import('./rigs/ram/views.js');
 const character=await new Character().load('ram');if(!viewIds.every(id=>character.parts.views.some(v=>v.id===id)))throw Error('Missing multi-angle or articulated jump artwork');
 const views=character.parts.views.map(view=>({...view,cells:view.cells.map(p=>({...p,pixels:p.image.getContext('2d').getImageData(0,0,p.w,p.h).data}))}));
 const area=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 let paintedTriangles=0,minPaintedArea=Infinity,maxRootError=0,maxFootError=0,maxRigidHoofError=0,maxHeadRegistrationError=0,minBufferMargin=Infinity;
 const jointMotion=[0,0,0,0];
 for(let frame=0;frame<=462;frame++){const t=frame/120,state=acting(t);if(Math.abs(Object.values(state.weights).reduce((a,b)=>a+b,0)-1)>1e-9)throw Error('Incomplete view blend');
 const matrices=registration(character.parts,state);state.headOffsets=headOffsets(character.parts,state,matrices);
 const heads=views.map((view,i)=>{
  const a=sourcePoint(view,...view.cal.horns[0]),b=sourcePoint(view,...view.cal.horns[1]);return registeredPoint([(a[0]+b[0])/2,(a[1]+b[1])/2],matrices[i]);});
 if(t>=2.86)for(const h of heads)maxHeadRegistrationError=Math.max(maxHeadRegistrationError,Math.hypot(h[0]-heads[0][0],h[1]-heads[0][1]));
 for(const [vi,view] of views.entries()){if(view.cal.legs){const bs=bones(view,state);
 for(let i=0;i<4;i++){const leg=view.cal.legs[i],r=skinPoint(view,...leg.root,state,i),b=skinPoint(view,...leg.root,state),f=skinPoint(view,...leg.sole,state,i),k=skinPoint(view,...leg.joint,state,i),rest=sourcePoint(view,...leg.joint);
 maxRootError=Math.max(maxRootError,Math.hypot(r[0]-b[0],r[1]-b[1]));maxFootError=Math.max(maxFootError,Math.hypot(f[0]-bs[i].paw[0],f[1]-bs[i].paw[1]));
 jointMotion[i]=Math.max(jointMotion[i],Math.hypot(k[0]-rest[0],k[1]-rest[1]));
 const uvA=[leg.sole[0]-.02,leg.ankle+.01],uvB=[leg.sole[0]+.02,leg.sole[1]],a=skinPoint(view,...uvA,state,i),z=skinPoint(view,...uvB,state,i),ra=sourcePoint(view,...uvA),rz=sourcePoint(view,...uvB);
 maxRigidHoofError=Math.max(maxRigidHoofError,Math.hypot((z[0]-a[0])-(rz[0]-ra[0]),(z[1]-a[1])-(rz[1]-ra[1])));
 }}
 for(let layer=0;layer<view.cells.length;layer++){const p=view.cells[layer],d=p.domain,m=p.mesh;
 for(let y=0;y<m.rows;y++)for(let x=0;x<m.cols;x++){
 const corners=[[x/m.cols,y/m.rows],[(x+1)/m.cols,y/m.rows],[x/m.cols,(y+1)/m.rows],[(x+1)/m.cols,(y+1)/m.rows]].map(([u,v])=>skinPoint(view,d.x+u*d.w,d.y+v*d.h,state,layer-1));
 for(let n=0;n<2;n++){const u=(x+(n?.67:.33))/m.cols,v=(y+(n?.67:.33))/m.rows,alpha=p.pixels[(Math.floor(v*(p.h-1))*p.w+Math.floor(u*(p.w-1)))*4+3];if(alpha<60)continue;
 const determinant=n?area(corners[3],corners[2],corners[1]):area(corners[0],corners[1],corners[2]);
 if(!Number.isFinite(determinant)||determinant<=0)throw Error('Painted ram folds: '+view.id+' t='+t+' layer='+layer+' cell='+x+','+y);
 if(state.weights[view.id]>.001)for(const point of corners){const q=registeredPoint(point,matrices[vi]),px=character.parts.origin[0]+character.parts.units*q[0],py=character.parts.origin[1]+character.parts.units*q[1];
  const margin=Math.min(px,py,character.parts.mix.width-px,character.parts.mix.height-py);minBufferMargin=Math.min(minBufferMargin,margin);
  if(margin<1)throw Error('Painted anatomy clipped by view buffer: '+view.id+' at '+t);}
 minPaintedArea=Math.min(minPaintedArea,determinant);paintedTriangles++;
 }}}}}
 const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;const c=canvas.getContext('2d');
 const paintedNear=point=>{const data=c.getImageData(Math.round(point[0])-14,Math.round(point[1])-14,29,29).data;for(let i=3;i<data.length;i+=4)if(data[i]>60)return true;return false;};
 for(const variant of [0,1]){const pose=approach(beats.impact,variant);c.clearRect(0,0,1920,1080);character.draw(c,pose);
 for(const p of character.contacts(pose))if(!paintedNear(p))throw Error('Horn contact has no painted horn');
 const s=await new SpiritTransition(canvas).load('ram'+(variant?'-alt':''));
 for(let f=231;f<=255;f++){s.draw(f/60);const data=c.getImageData(0,0,1920,1080).data;for(let i=3;i<data.length;i+=4)if(data[i]!==255)throw Error('Encoded cut interval uncovered at '+f);}
 s.dispose();}
 const leapEvidence=jumps.map(j=>{const start=approach(j.start),apex=approach((j.start+j.end)/2),end=approach(j.end);
 if(apex.y>=Math.min(start.y,end.y)-100)throw Error('A mountain jump lacks height');return {start,apex,end};});
 if(acting(beats.rearPeak).weights.rear<.999||acting(3.62).weights.fall<.999)throw Error('Missing triumphant rear or descending attack');
 for(const [at,id] of [[1.73,'backQuarter'],[1.80,'back'],[1.86,'backLeft']]){
  const state=acting(at);if(!state.turning||state.jump.airborne||state.weights[id]<.999)throw Error('A genuine planted back-angle turn is missing');}
 for(const j of jumps)for(const variant of [0,1])for(let n=1;n<20;n++){
  const at=j.start+(j.end-j.start)*n/20,a=approach(at,variant),b=approach(at+.001,variant),state=acting(at),facing=state.facing*(variant?-1:1);
  if((b.x-a.x)*facing<=0)throw Error('Ram travels opposite to its painted facing');
  for(const [id,w] of Object.entries(state.weights))if(w>.001&&(state.mirrors[id]||1)!==state.facing)throw Error('Airborne painting faces away from travel');
 }
 const jumpPhases=jumps.map(j=>({pre:acting(Math.max(0,j.start-.015)).weights.crouch,apex:acting((j.start+j.end)/2).weights.tuck,reach:acting(j.end-.02).weights.reach,landing:acting(j.end+.075).weights.crouch}));
 if(jumpPhases.some(p=>p.pre<.98||p.apex<.99||p.reach<.99||p.landing<.99))throw Error('Full-body crouch/tuck/extension/landing phase is missing');
 for(const at of [.85,1.19,1.44,1.78,2.04,2.35,2.58,2.695]){const pose={...approach(at),x:960,y:850,size:550};c.clearRect(0,0,1920,1080);character.draw(c,pose);
  for(const point of character.contacts(pose,'feet'))if(!paintedNear(point))throw Error('A complete jump foot has no painted hoof at '+at+' '+point);}
 for(const at of [.08,.68,.90,1.48,1.67,1.92,2.08,2.62,2.70,2.78,2.86,3.10,3.25,3.42]){const a=acting(at-.00001),b=acting(at+.00001);
  for(const id of viewIds)if(Math.abs(a.weights[id]-b.weights[id])>.001)throw Error('Painted pose pops at choreography handoff '+at);}
 const normal=approach(1.4),alt=approach(1.4,1);if(Math.abs(normal.x+alt.x-1920)>.001)throw Error('Mirrored route invalid');
 character.dispose();return {skin:'golden-mountain-motion-v19',jumpPhases,travelMatchesFacing:true,truePaintedBackTurn:true,views:views.map(v=>({id:v.id,width:v.image.width,height:v.image.height,nativeAspect:v.w/v.h})),paintedTriangles,minPaintedArea,maxRootError,maxFootError,maxRigidHoofError,maxHeadRegistrationError,minBufferMargin,jointMotion,
 threeJumps:leapEvidence,fullRearingPose:true,descendingHornAttack:true,paintedHornContacts:true,cutFramesFullyOpaque:true};
 });console.log(report);assert(report.maxRootError<1e-9);assert(report.maxFootError<1e-9);assert(report.maxRigidHoofError<1e-9);assert(report.maxHeadRegistrationError<1e-9);assert(report.jointMotion.every(v=>v>.025));fs.writeFileSync(output+'/ram-motion-validation.json',JSON.stringify(report,null,2));
 }finally{await browser.close();fixture.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
