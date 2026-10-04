// Tests actual coverage geometry independently of character/particle decoration.
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {serve}=require('./spirit_fixture.cjs');
const allClips=['bear','bear-alt','turtle','turtle-alt','ram','ram-alt','phoenix','phoenix-alt'];
const clips=process.argv.slice(2).length?process.argv.slice(2):allClips;
assert(clips.every(id=>allClips.includes(id)),'Unknown performance');
(async()=>{
 const fixture=await serve();
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage();
  page.on('pageerror',error=>console.error(error));
  await page.goto(fixture.url);
  await page.waitForFunction(()=>!!window.spiritPreview);
  const results=await page.evaluate(async(clips)=>{
   const {SpiritTransition}=await import('./renderer.js');
   const {SpriteMesh}=await import('./mesh.js'),triangle=SpriteMesh.prototype.triangle;
   SpriteMesh.prototype.triangle=function(c,...vertices){for(const v of vertices)for(const n of [...v.s,...v.d])if(!Number.isFinite(n))throw Error('Non-finite painted mesh vertex');return triangle.call(this,c,...vertices);};
   const {timing}=await import('./catalog.js');
   const {approach}=await import('./ram.js');
   const {jumps}=await import('./rigs/ram/motion.js');
   const {arrival:bearArrival,acting,swipes,slashPoint}=await import('./bear.js');
   const {arrival:turtleArrival}=await import('./turtle.js');
   const {wingPose}=await import('./rigs/phoenix-motion.js');
   const {flight}=await import('./phoenix.js');
   const {world,track}=await import('./performance.js');
   const hash=c=>{const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let h=2166136261;for(let i=0;i<data.length;i++)h=Math.imul(h^data[i],16777619);return h>>>0;};
   const result={};
   for(const clip of clips){
    const id=clip.split('-')[0];
    const s=await new SpiritTransition(document.createElement('canvas')).load(clip);
    const area=t=>{s.b.clearRect(0,0,1920,1080);s.effect.coverage(s,t);const d=s.b.getImageData(0,0,1920,1080).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>0)n++;return n;};
    const times=id==='bear'?[2.3,2.9,3.5,3.85]:id==='turtle'?[3.62,3.65,3.69,3.85]:id==='ram'?[3.655,3.68,3.72,3.85]:[3.16,3.3,3.45,3.85];
    const growth=times.map(area),reveal=(id==='bear'?[4.3,4.45,4.6,6.1]:[4.3,4.8,5.5,6.1]).map(t=>{s.draw(t);const d=s.b.getImageData(0,0,1920,1080).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>16)n++;return n;});
    let opaqueFrames=0;
    for(let f=Math.ceil(s.timing.coveredFrom*timing.fps);f<=Math.floor(s.timing.coveredUntil*timing.fps);f++){
     s.draw(f/timing.fps);const d=s.c.getImageData(0,0,1920,1080).data;
     for(let i=3;i<d.length;i+=4)if(d[i]!==255)throw Error(`${id}: uncovered pixel at frame ${f}`);
     opaqueFrames++;
    }
    result[clip]={times,growth,reveal,opaqueFrames};
    s.draw(1.6);result[clip].entranceHash=hash(s.canvas);
    // Pixel-hash QA reads every frame. Select the CPU canvas up front rather
    // than letting Chrome migrate from GPU to CPU midway through the comparison.
    const rig=document.createElement('canvas');rig.width=640;rig.height=640;const rc=rig.getContext('2d',{willReadFrequently:true}),poses=[];
    for(let f=0;f<30;f++){rc.clearRect(0,0,640,640);s.character.draw(rc,{x:320,y:id==='phoenix'?280:570,size:440,t:1+f/60});poses.push(hash(rig));}
    result[clip].uniqueRigFrames=new Set(poses).size;
    if(id==='turtle')result[clip].allHexagons=s.hexes.every(cell=>cell.points.length===6);
    if(id==='phoenix'){result[clip].featherDecoded=s.character.featherArt.width>0;result[clip].eggDecoded=s.character.eggArt.art.image.width>0;}
    // Painted mesh vertices, contacts and asset ownership are checked independently
    // from the coverage layer. Out-of-order scrubbing must reproduce the same pose.
    const pose=id==='bear'?{...bearArrival(2.23),...acting(2.23),t:2.23}:id==='turtle'?{...turtleArrival(2.23),t:2.23,cast:.6}:id==='ram'?{...approach(2.23),t:2.23}:{...flight(2.23),t:2.23};
    const first=s.character.contacts(pose);s.character.contacts({...pose,t:3.4});const again=s.character.contacts(pose);
    if(JSON.stringify(first)!==JSON.stringify(again))throw Error('Pose depends on scrub order');
    for(const point of first)for(const n of point)if(!Number.isFinite(n))throw Error('Invalid painted contact geometry');
    for(const part of s.character.parts.cells)if(!(part.w>0&&part.h>0&&part.mesh.cols>=8))throw Error('Missing continuous painted surface');
    rc.clearRect(0,0,640,640);s.character.draw(rc,{...pose,x:320,y:320,size:440});const poseHash=hash(rig);s.character.draw(rc,{...pose,t:3.4});rc.clearRect(0,0,640,640);s.character.draw(rc,{...pose,x:320,y:320,size:440});if(hash(rig)!==poseHash)throw Error('Painted surface depends on scrub order');
    if(id==='bear')for(const sw of swipes)for(const age of [.01,.04,.08,.11,.14]){
     const t=sw.at+age,p={...bearArrival(t),...acting(t),t},tip=s.character.contacts(p)[sw.hand],trail=slashPoint(sw,age/sw.duration);
     if(Math.hypot(tip[0]-trail[0],tip[1]-trail[1])>1)throw Error('Painted trail is detached from painted limb contact');
    }
    if(id==='ram')for(const point of s.character.contacts({...approach(3.65,s.variant),t:3.65,variant:s.variant})){
     if(point[0]<100||point[0]>1820||point[1]<150||point[1]>900)throw Error('Horn impact must remain visible inside the viewport');
    }
    result[clip].paintedSurfaces=true;
    s.timing={...s.timing,coveredUntil:4.6};s.draw(4.5);
    const held=s.c.getImageData(0,0,1920,1080).data;for(let i=3;i<held.length;i+=4)if(held[i]!==255)throw Error(`${clip}: author timing did not hold the cover`);
    s.draw(4.9);const revealed=s.c.getImageData(0,0,1920,1080).data;
    result[clip].configuredReveal=Array.from({length:1920*1080},(_,i)=>revealed[i*4+3]).some(a=>a<255);s.dispose();
   }
   if(result.ram)result.ram.leaps=jumps.map(j=>({start:approach(j.start),apex:approach((j.start+j.end)/2),end:approach(j.end)}));
   for(const [id,motion] of [['bear',bearArrival],['turtle',turtleArrival],['ram',approach],['phoenix',flight]]){if(!clips.some(clip=>clip.split('-')[0]===id))continue;
    for(let t=motion===flight?1.4:.4;t<3.3;t+=1/120){
     const pose=motion(t);if(pose.alpha<.99)throw Error('Continuous approach unexpectedly disappears');
     const a=motion(t-.0001),b=motion(t+.0001);
     for(const key of ['x','y','size','angle'])if(Math.abs(b[key]-a[key])>(key==='angle'?.02:3))throw Error('Discontinuous body trajectory');
    }
   }
   if(clips.some(id=>id.startsWith('bear')))for(const sw of swipes)for(const age of [.01,.04,.08,.11,.14])for(const variant of [0,1]){
    const tip=slashPoint(sw,age/sw.duration,0,variant),paw=world(bearArrival(sw.at+age,variant),acting(sw.at+age,variant).paws[sw.hand]);
    if(Math.hypot(tip[0]-paw[0],tip[1]-paw[1])>.01)throw Error('Claw trail detached from moving attacking paw');
   }
   const keys=[[0,0],[1,10],[2,4],[3,20]];
   for(const at of [1,2]){const h=.00001,left=(track(keys,at)-track(keys,at-h))/h,right=(track(keys,at+h)-track(keys,at))/h;if(Math.abs(left-right)>.002)throw Error('Authored motion loses velocity continuity');}
   for(let t=1.12;t<3.4;t+=1/120)if(Math.abs(wingPose(t+.0001).angle-wingPose(t-.0001).angle)>.01)throw Error('Wingbeat jumps');
   if(wingPose(1.5).wrist===wingPose(1.5).elbow)throw Error('Outer feathers must trail the wing root');
   return result;
  },clips);
  for(const id of Object.keys(results)){
   const r=results[id];assert(r.growth.every((n,i,a)=>i===0||n>a[i-1]),`${id} coverage must grow`);
   assert.equal(r.growth.at(-1),1920*1080);assert(r.reveal.at(-1)<1000,`${id} must reveal the next scene`);
   assert(r.reveal[0]>r.reveal[1]&&r.reveal[1]>r.reveal[2],`${id} reveal must progress`);
   assert(r.uniqueRigFrames>=28,`${id}: rig froze or reused discrete poses`);
   assert(r.configuredReveal,`${id}: author timing did not release the cover`);
  }
  if(results.turtle)assert(results.turtle.allHexagons);if(results.phoenix){assert(results.phoenix.featherDecoded);assert(results.phoenix.eggDecoded);}
  for(const id of ['bear','turtle','ram','phoenix'])if(results[id]&&results[id+'-alt'])assert.notEqual(results[id].entranceHash,results[id+'-alt'].entranceHash,`${id}: alternate entrance must visibly differ`);
  if(results.ram){assert.equal(results.ram.leaps.length,3);for(const hop of results.ram.leaps){assert(hop.apex.size>hop.start.size&&hop.end.size>hop.apex.size);assert(hop.apex.y<Math.min(hop.start.y,hop.end.y)-100);}}
  fs.writeFileSync((process.env.SPIRIT_OUTPUT||'C:/StreamingMedia/Transitions/udyr-spirits-v11')+'/choreography-validation.json',JSON.stringify(results,null,2));
  console.log(clips.join(', ')+': deterministic scrubbing, valid painted surfaces and contacts, growing covers, every cut frame and configurable reveal passed.');
 }finally{await browser.close();fixture.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

