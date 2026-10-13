// Deterministic art review and real browser timing/resource regression checks.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const {draftFixture,root}=require('./champ_select_fixture.cjs');
const output=path.join(root,'output/champ-select-vfx');
(async()=>{
 fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],results=[];
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});await draftFixture(page,{});page.on('pageerror',e=>errors.push(e.message));
  for(const theme of ['bear','turtle','ram','phoenix']){
   await page.goto(`http://draft.test/champ-select?demo=1&theme=${theme}`);await page.locator('#stage.art-ready').waitFor();await page.evaluate(()=>document.fonts.ready);
   await page.locator('.demo-controls').evaluate(e=>e.style.opacity='0');
   // Stop the normal clock, then sample the production renderer at exact cue times.
   await page.emulateMedia({reducedMotion:'reduce'});
   const review=await page.evaluate(async theme=>{
    const {WorldAssets}=await import('/champ-select/world-assets.js'),{paintWorld}=await import('/champ-select/world-art.js'),{paintEvents}=await import('/champ-select/world-events.js'),{paintResponses,cueResponse}=await import('/champ-select/vfx-timing.js'),{layouts}=await import('/champ-select/layout.js');
    const assets=new WorldAssets();await assets.load(theme);const canvas=document.querySelector('canvas'),c=canvas.getContext('2d'),stage=document.querySelector('#stage');
    window.review={assets,paintWorld,paintEvents,paintResponses,layouts,c,stage};
    const image=assets.effect,probe=document.createElement('canvas');probe.width=probe.height=4;const pc=probe.getContext('2d');pc.drawImage(image,0,0,4,4,0,0,4,4);const alpha=pc.getImageData(0,0,1,1).data[3];
    const cue={kind:'lock',key:'allies',index:2,enemy:false,at:0};
    const response=[.69,.72,.82,4.2].map(t=>cueResponse(cue,t));
    const start=performance.now();for(let i=0;i<35;i++){c.clearRect(0,0,1920,1080);paintWorld(c,.75+i/60,theme,[]);paintEvents(c,.75+i/60,theme,Array.from({length:10},(_,j)=>({...cue,key:j<5?'allies':'enemies',enemy:j>=5,index:j%5})),assets);}
    return {texture:image.naturalWidth,transparentCorner:alpha,peak:response,stressMeanMs:(performance.now()-start)/35};
   },theme);
   assert.ok(review.texture>500);assert.equal(review.transparentCorner,0);assert.equal(review.peak[0].hit,0);assert.equal(review.peak[1].hit,1);assert.ok(review.peak[2].hit<1);assert.equal(review.peak[3].hit,0);
   for(const [label,age] of [['charge',.30],['flight',.60],['impact',.76],['release',1.17],['aftermath',2.15]]){
    await page.evaluate(({theme,age})=>{const {c,stage,assets,paintWorld,paintEvents,paintResponses,layouts}=window.review;const e={kind:'lock',key:'allies',index:2,enemy:false,at:0};c.clearRect(0,0,1920,1080);paintWorld(c,age,theme,[e]);paintEvents(c,age,theme,[e],assets);document.querySelector('#allies > :nth-child(3)').classList.add('react-lock');paintResponses(stage,[e],age);for(const key of ['allies','enemies'])for(const p of layouts[theme][key]){c.clearRect(p.x+5,p.y+4,p.w-10,37);c.clearRect(p.x+6,p.y+327,p.w-12,73);}}, {theme,age});
    await page.screenshot({path:path.join(output,`${theme}-${label}.png`)});
   }
   const expired=await page.evaluate(theme=>{const {c,assets,paintEvents}=window.review;c.clearRect(0,0,1920,1080);const before=c.canvas.toDataURL();paintEvents(c,4.3,theme,[{kind:'lock',key:'allies',index:2,at:0}],assets);const equal=before===c.canvas.toDataURL(),atlas=[...assets.effect.dissolveFrames];assets.dispose();return {equal,released:assets.effect===null&&assets.images.length===0&&atlas.length===16&&atlas.every(f=>f.width===1&&f.height===1)};},theme);
   assert.deepEqual(expired,{equal:true,released:true});
   // Cancellation while the texture decodes must not publish an old effect or allocate more images.
   const cancellation=await page.evaluate(async()=>{const {WorldAssets}=await import('/champ-select/world-assets.js');const a=new WorldAssets();await Promise.all([a.load('bear'),a.load('phoenix')]);const ok=a.theme==='phoenix'&&a.effect?.src.endsWith('phoenix.png')&&a.images.length===5;a.dispose();return ok;});assert.equal(cancellation,true);
   results.push({theme,...review,expired,cancellation});await page.emulateMedia({reducedMotion:'no-preference'});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'vfx-verification.json'),JSON.stringify({passed:true,results,errors},null,2));console.log(JSON.stringify(results.map(({theme,stressMeanMs})=>({theme,tenSimultaneousEffectsMs:stressMeanMs}))));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
