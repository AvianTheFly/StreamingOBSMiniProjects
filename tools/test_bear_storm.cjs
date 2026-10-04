// Storm artwork regression: accepted approach choreography, intact paint, projection,
// visible claw contacts, perspective pressure and configurable cover integration.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {serve}=require('./spirit_fixture.cjs');
const out=process.env.SPIRIT_OUTPUT||'C:/StreamingMedia/Transitions/udyr-spirits-v15';
(async()=>{const fixture=await serve(),reference=await serve(process.env.SPIRIT_REFERENCE||out+'/before-v15/lib/scene_transitions/web'),browser=await chromium.launch({headless:true,channel:'chrome'});
 try{const page=await browser.newPage();await page.goto(fixture.url);await page.waitForFunction(()=>!!window.spiritPreview);
 // Compare the immutable accepted v10 source in the same Chrome process;
 // premultiplied canvas rounding can differ across graphics-process lifetimes.
 const ref=await browser.newPage();await ref.goto(reference.url);await ref.waitForFunction(()=>!!window.spiritPreview);
 const accepted=await ref.evaluate(async()=>{
  const {arrival}=await import('./bear.js'),m=await import('./rigs/bear/motion.js');
  return {swipes:m.swipes,samples:Array.from({length:397},(_,i)=>{const t=i/60;return {arrival:[arrival(t),arrival(t,1)],gait:m.gait(t),views:m.views(t)};})};
 });
 const proof=await page.evaluate(async accepted=>{
  const {SpiritTransition}=await import('./renderer.js'),{Character}=await import('./characters.js');
  const {arrival,slashPoint}=await import('./bear.js'),m=await import('./rigs/bear/motion.js');
  const {frontAnatomy,frontPoint,frontClawContact}=await import('./rigs/bear/front-motion.js'),{world}=await import('./performance.js');
  const check=(condition,message)=>{if(!condition)throw Error(message);};
  const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);let preservedFrames=0,samples=0,visibleContacts=0,minJacobian=Infinity,maxSupportSlide=0;
  check(JSON.stringify(m.swipes)===JSON.stringify(accepted.swipes),'Accepted strike/audio beats changed');
  for(let i=0;i<accepted.samples.length;i++){const t=i/60;
   const sample={arrival:[arrival(t),arrival(t,1)],gait:m.gait(t),views:m.views(t)};
   check(JSON.stringify(sample)===JSON.stringify(accepted.samples[i]),'Accepted walking/turn choreography changed');preservedFrames++;
  }
  const actor=await new Character().load('bear');check(actor.parts.front.poses.length===3,'Missing complete frontal poses');
  for(const [key,pose] of actor.parts.front.poses.entries())check(Math.abs(pose.w/pose.h-frontAnatomy.widths[key]/frontAnatomy.height)<1e-9,'Frontal art aspect ratio is stretched');
  const support=m.acting(1.94).hindPaws;
  for(let t=1.94;t<3.80;t+=1/240){const a=m.acting(t),b=m.acting(t,1);
   check(a.front.layers.reduce((sum,l)=>sum+l.weight,0)===1,'Frontal layers do not form a complete generation');
   for(let hand=0;hand<2;hand++){
    check(distance(a.paws[hand],frontClawContact(t,a.front,hand))<1e-9,'Projected claw and contact contract diverged');
    check(distance(b.paws[hand],[-a.paws[hand][0],a.paws[hand][1]])<1e-9,'Alternate camera-facing contact not mirrored');
    const slide=distance(world(arrival(t),a.hindPaws[hand]),world(arrival(1.94),support[hand]));maxSupportSlide=Math.max(maxSupportSlide,slide);check(slide<1.5,'Camera projection makes the ground support slide');
    check(distance(m.acting(t-.0001).paws[hand],m.acting(t+.0001).paws[hand])<.006,'Frontal claw trajectory jumps');
   }
   for(const layer of a.front.layers)for(let u=0;u<=1;u+=.10)for(let v=0;v<=1;v+=.10){
    const p=frontPoint(u,v,t,a.front,layer.key),x=frontPoint(u+.0001,v,t,a.front,layer.key),y=frontPoint(u,v+.0001,t,a.front,layer.key);
    check([...p,...x,...y].every(Number.isFinite),'Invalid frontal perspective vertex');
    const determinant=((x[0]-p[0])*(y[1]-p[1])-(x[1]-p[1])*(y[0]-p[0]))/1e-8;
    minJacobian=Math.min(minJacobian,determinant);check(determinant>0,'Camera-facing paint folds or inverts');
   }samples++;
  }
  const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=1100;const c=canvas.getContext('2d');
  for(const variant of [0,1])for(const sw of m.swipes)for(const age of [.02,.04,.07,.10,.14]){const t=sw.at+age,pose={x:700,y:1000,size:850,t,variant};
   c.clearRect(0,0,1400,1100);actor.draw(c,pose);const point=world(pose,m.acting(t,variant).paws[sw.hand]);
   const pixels=c.getImageData(Math.round(point[0])-12,Math.round(point[1])-12,25,25).data;
   check(Array.from({length:625},(_,i)=>pixels[i*4+3]).some(alpha=>alpha>80),'Projected attack contact is missing visible claw paint');visibleContacts++;
   check(distance(slashPoint(sw,age/sw.duration,0,variant),world(arrival(t,variant),m.acting(t,variant).paws[sw.hand]))<.001,'Screen gouge detached from projected attacking claw');
  }
  check(m.acting(2.40).front.layers.find(l=>l.weight===1).key===1,'First swipe loses its follow-through');
  check(m.acting(2.90).front.layers.find(l=>l.weight===1).key===2,'Second swipe loses its follow-through');
  actor.dispose();return {preservedFrames,samples,visibleContacts,minJacobian,maxSupportSlide,completeStormFrontalPoses:true,mirroredClawContacts:true};
 },accepted);
 assert.equal(proof.preservedFrames,397);fs.writeFileSync(out+'/bear-storm-validation.json',JSON.stringify(proof,null,2));console.log('Accepted approach choreography, intact storm artwork, non-folding projection, visible claws, stable support and follow-through passed');
 }finally{await browser.close();fixture.close();reference.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
