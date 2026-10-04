// Intact turtle anatomy, rock-first blocking, painted geometry and cut safety.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {serve}=require('./spirit_fixture.cjs');
const output=process.env.SPIRIT_OUTPUT||'C:/StreamingMedia/Transitions/udyr-spirits-v18-turtle-articulation';
const footfalls=JSON.parse(require('node:child_process').execFileSync('py',['-3.11','-B','-c','import json; from lib.scene_transitions.turtle_sound import FOOTFALLS; print(json.dumps(FOOTFALLS))'],{encoding:'utf8'}));
(async()=>{const f=await serve(),browser=await chromium.launch({headless:true,channel:'chrome'});
 try{const page=await browser.newPage();page.on('pageerror',e=>console.error(e));await page.goto(f.url);
 const report=await page.evaluate(async footfalls=>{
  const {Character}=await import('./characters.js'),{arrival,acting,hits,walk,support}=await import('./rigs/turtle/motion.js');
  const {anatomy,sourcePoint}=await import('./rigs/turtle/calibration.js'),{skinPoint}=await import('./rigs/turtle/skin.js');
  const {rocks,trajectory}=await import('./turtle/projectiles.js'),{contact,defense,shield}=await import('./turtle/shield.js');
  const {SpiritTransition}=await import('./renderer.js'),{world}=await import('./performance.js');
  const character=await new Character().load('turtle');
  if(character.parts.cells.length!==5||!character.parts.intactSource)throw Error('Missing intact source registration');
  const parts=character.parts.cells.map(p=>({...p,pixels:p.image.getContext('2d').getImageData(0,0,p.w,p.h).data}));
  let samples=0,maxContactError=0,maxWorldSlide=0,minPaintedArea=Infinity,maxVisibleDisplacement=0,maxRootError=0,worstSlide=null,maxRigidFootError=0;
  const articulation=anatomy.legs.map(()=>({kneeMotion:0,upperMotion:0,minBend:Infinity,maxBend:-Infinity}));
  for(const [n,at] of footfalls.entries()){
   const pair=n%2?[1,2]:[0,3];
   for(const index of pair)if(support(at-.0001,index).planted||!support(at+.0001,index).planted)throw Error('Footfall audio is detached from leg touchdown');
  }
  // Mid-recovery must lift a whole foot clear of the planted plane by a visible
  // amount; tiny toe motion alone cannot pass this regression.
  const clearance=anatomy.legs.map((leg,i)=>{const at=walk.start+walk.offsets[i]+walk.swing/2;
   return (sourcePoint(...leg.sole)[1]-support(at,i).paw[1])*arrival(at).size;});
  const area=(a,b,d)=>(b[0]-a[0])*(d[1]-a[1])-(b[1]-a[1])*(d[0]-a[0]);
  for(let t=0;t<=3.86;t+=1/120){const a=acting(t);
   for(let i=0;i<4;i++){
    const p=skinPoint(...anatomy.legs[i].sole,a,i);
    const root=skinPoint(...anatomy.legs[i].root,a,i),body=skinPoint(...anatomy.legs[i].root,a);maxRootError=Math.max(maxRootError,Math.hypot(root[0]-body[0],root[1]-body[1]));maxContactError=Math.max(maxContactError,Math.hypot(p[0]-a.paws[i][0],p[1]-a.paws[i][1]));
    const leg=anatomy.legs[i],knee=skinPoint(...leg.joint,a,i),rest=sourcePoint(...leg.joint);
    const mid=leg.root.map((v,j)=>(v+leg.joint[j])/2),upper=skinPoint(...mid,a,i),restUpper=sourcePoint(...mid);
    if(t>=1.2&&t<walk.braceStart){const track=articulation[i];
     track.kneeMotion=Math.max(track.kneeMotion,Math.hypot(knee[0]-rest[0],knee[1]-rest[1]));
     track.upperMotion=Math.max(track.upperMotion,Math.hypot(upper[0]-restUpper[0],upper[1]-restUpper[1]));
     const ux=knee[0]-root[0],uy=knee[1]-root[1],lx=p[0]-knee[0],ly=p[1]-knee[1];
     const bend=Math.acos(Math.max(-1,Math.min(1,(ux*lx+uy*ly)/(Math.hypot(ux,uy)*Math.hypot(lx,ly)))));
     track.minBend=Math.min(track.minBend,bend);track.maxBend=Math.max(track.maxBend,bend);
    }
    const padA=[leg.sole[0]-.025,leg.ankle+.008],padB=[leg.sole[0]+.025,leg.sole[1]];
    const pa=skinPoint(...padA,a,i),pb=skinPoint(...padB,a,i),ra=sourcePoint(...padA),rb=sourcePoint(...padB);
    maxRigidFootError=Math.max(maxRigidFootError,Math.hypot((pb[0]-pa[0])-(rb[0]-ra[0]),(pb[1]-pa[1])-(rb[1]-ra[1])));
    if(t>=walk.start&&(t<walk.braceStart||t>walk.braceEnd)){
     const b=acting(t+.001);if(a.planted[i]&&b.planted[i]){const pa=world(arrival(t),a.paws[i]),pb=world(arrival(t+.001),b.paws[i]);const distance=Math.hypot(pa[0]-pb[0],pa[1]-pb[1]);if(distance>maxWorldSlide){maxWorldSlide=distance;worstSlide={t,i,pa,pb};}}}
    if(t>=1.2&&t<=walk.braceStart)maxVisibleDisplacement=Math.max(maxVisibleDisplacement,Math.hypot(...a.paws[i].map((v,j)=>v-sourcePoint(...anatomy.legs[i].sole)[j])));
   }
   // Reject actual painted triangle inversions, rather than checking only abstract bones.
   for(let layer=0;layer<parts.length;layer++){const part=parts[layer],mesh=part.mesh,pixels=part.pixels,d=part.domain;
   for(let y=0;y<mesh.rows;y++)for(let x=0;x<mesh.cols;x++){
    const uv=[[(x+.33)/mesh.cols,(y+.33)/mesh.rows],[(x+.67)/mesh.cols,(y+.67)/mesh.rows]];
    const corners=[[x/mesh.cols,y/mesh.rows],[(x+1)/mesh.cols,y/mesh.rows],[x/mesh.cols,(y+1)/mesh.rows],[(x+1)/mesh.cols,(y+1)/mesh.rows]].map(p=>skinPoint(d.x+p[0]*d.w,d.y+p[1]*d.h,a,layer-1));
    for(let n=0;n<2;n++){const [u,v]=uv[n],index=(Math.floor(v*(part.h-1))*part.w+Math.floor(u*(part.w-1)))*4+3;
     if(pixels[index]<60)continue;
     const ar=n?area(corners[3],corners[2],corners[1]):area(corners[0],corners[1],corners[2]);minPaintedArea=Math.min(minPaintedArea,ar);samples++;
     if(!Number.isFinite(ar)||ar<=0)throw Error('Registered painted mesh folds at '+t+' layer '+layer+' '+x+','+y);
    }
   }}
  }
  const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;const c=canvas.getContext('2d');
  const painted=()=>{const d=c.getImageData(0,0,1920,1080).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>30)n++;return n;};
  const offscreen={};
  for(const variant of [0,1]){
   c.clearRect(0,0,1920,1080);character.draw(c,{...arrival(hits[0],variant),x:960});const full=painted();
   c.clearRect(0,0,1920,1080);character.draw(c,arrival(hits[0],variant));offscreen[variant]=painted()/full;
   if(offscreen[variant]>.20)throw Error('Turtle is not mostly off screen on first impact');
   c.clearRect(0,0,1920,1080);character.draw(c,arrival(.4,variant));if(painted()>0)throw Error('Opening does not lead with the rock');
   const rock=trajectory(0,.4,variant);if(!rock.visible||rock.x<200||rock.x>1720)throw Error('Opening rock does not cross the stage');
   for(let i=0;i<3;i++){const hit=contact(i,variant),tip=trajectory(i,hits[i],variant),sh=defense(hits[i]-.025,variant,i);
    if(Math.hypot(tip.x-hit[0],tip.y-hit[1])>.00001||sh.alpha<.95)throw Error('Rock/shield timing is detached');
    if(trajectory(i,hits[i]+.001,variant).visible)throw Error('Rock passes through the ward');
   }
   const s=await new SpiritTransition(canvas).load('turtle'+(variant?'-alt':''));
   for(let frame=231;frame<=255;frame++){s.draw(frame/60);const d=c.getImageData(0,0,1920,1080).data;for(let i=3;i<d.length;i+=4)if(d[i]!==255)throw Error('Turtle cut coverage hole');}
   s.dispose();
  }
  for(const t of [1.3,1.7,1.94,2.4,2.84,3.07,3.62]){
   c.clearRect(0,0,1920,1080);const pose={...arrival(t),x:960};character.draw(c,pose);
   for(const point of character.contacts(pose)){const data=c.getImageData(Math.round(point[0])-14,Math.round(point[1])-14,29,29).data;
    let found=false;for(let n=3;n<data.length;n+=4)if(data[n]>30)found=true;if(!found)throw Error('A foot contact has no intact painted limb');}
  }
  if(hits[1]>=walk.stop||shield(3.55).r<=shield(3.2).r)throw Error('Approach/charge sequence regressed');
  character.dispose();
  return {intactCreature:true,fourPaintedFeet:true,articulation,clearance,footfallAudioSynchronized:true,maxRigidFootError,paintedTriangles:samples,minPaintedArea,maxRootError,worstSlide,maxContactError,maxWorldSlide,maxVisibleDisplacement,
   firstImpact:hits[0],firstImpactVisibleActorFraction:offscreen,openingRockBeforeCreature:true,rocks:rocks.length,
   thirdShieldGrowsBeforeHit:true,allCutFramesOpaque:true};
 },footfalls);
 console.log(report);assert(report.maxRootError<1e-9);assert(report.maxContactError<.003);assert(report.maxWorldSlide<.1);assert(report.maxVisibleDisplacement<.18);assert.equal(report.rocks,3);
 assert(report.maxRigidFootError<1e-9);for(const leg of report.articulation){assert(leg.kneeMotion>.025,'Knee must move with the step');assert(leg.upperMotion>.012,'Upper leg must move');assert(leg.maxBend-leg.minBend>.20,'Knee must flex through the stride');}
 for(const clearance of report.clearance)assert(clearance>25,'Whole foot must lift visibly');
 fs.writeFileSync(output+'/turtle-motion-validation.json',JSON.stringify(report,null,2));console.log(report);
 }finally{await browser.close();f.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
