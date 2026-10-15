// Review the production choreography in its actual scene, and test finite ownership.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const {draftFixture,root}=require('./champ_select_fixture.cjs');
const output=path.join(root,'output/champ-select-easter-eggs');
(async()=>{
 fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],results=[];
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});await draftFixture(page,{});page.on('pageerror',e=>errors.push(e.message));
  for(const theme of ['bear','turtle','ram','phoenix']){
   await page.goto(`http://draft.test/champ-select?demo=1&clean=1&theme=${theme}`);await page.locator('#stage.art-ready').waitFor();await page.evaluate(()=>document.fonts.ready);await page.emulateMedia({reducedMotion:'reduce'});
   const audit=await page.evaluate(async theme=>{
    const {WorldAssets}=await import('/champ-select/world-assets.js'),{secretProgram,castFor}=await import('/champ-select/secret-program.js'),{paintSecrets}=await import('/champ-select/spirit-secrets.js'),{paintWorld}=await import('/champ-select/world-art.js'),{paintDetails}=await import('/champ-select/world-details.js');
    const assets=new WorldAssets();await assets.load(theme);const canvas=document.querySelector('canvas'),c=canvas.getContext('2d');
    const test=document.createElement('canvas');test.width=1920;test.height=1080;const tc=test.getContext('2d',{willReadFrequently:true});
    const slots=secretProgram(theme,0),seen=new Set();let minimum=3,maximum=0,escaped=0,draws=0,clipped=[];
    const draw=tc.drawImage.bind(tc);tc.drawImage=(img,x,y,w,h)=>{
     const m=tc.getTransform(),corners=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([x,y])=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f}));
     const box={l:Math.min(...corners.map(p=>p.x)),r:Math.max(...corners.map(p=>p.x)),t:Math.min(...corners.map(p=>p.y)),b:Math.max(...corners.map(p=>p.y))};
     if(!slots.some(s=>box.l>=s.box[0]-1&&box.r<=s.box[0]+s.box[2]+1&&box.t>=s.box[1]-1&&box.b<=s.box[1]+s.box[3]+1))clipped.push(box);
     draws++;return draw(img,x,y,w,h);
    };
    for(let tick=0;tick<216;tick++){
     const clock=tick*.5,active=secretProgram(theme,clock).filter(s=>s.active);
     minimum=Math.min(minimum,active.length);maximum=Math.max(maximum,active.length);for(const s of active)seen.add(s.name);
     tc.clearRect(0,0,1920,1080);paintSecrets(tc,clock,theme,[],assets,clock);
     // Representative frames must have no ink outside the authored scenic pockets.
     if(tick%18===0){const data=tc.getImageData(0,0,1920,1080).data;for(let y=0;y<1080;y++)for(let x=0;x<1920;x++)if(data[(y*1920+x)*4+3]&&!slots.some(s=>x>=s.box[0]&&x<s.box[0]+s.box[2]&&y>=s.box[1]&&y<s.box[1]+s.box[3]))escaped++;}
    }
    window.eggs={assets,c,paintWorld,paintDetails,paintSecrets,secretProgram};
    return {theme,minimum,maximum,seen:[...seen],cast:castFor(theme),images:assets.images.length,escaped,draws,clipped:clipped.slice(0,5),clippedCount:clipped.length,slots};
   },theme);
   assert.equal(audit.minimum,2);assert.equal(audit.maximum,3);assert.deepEqual([...audit.seen].sort(),[...audit.cast].sort());assert.equal(audit.images,2+3*audit.cast.length);assert.equal(audit.escaped,0);assert.ok(audit.draws>300);
   // Keep clipping evidence for the artistic audit even before it is resolved.
   results.push(audit);
   for(const clock of [4,10,22,28,40,58]){
    await page.evaluate(({theme,clock})=>{const {c,assets,paintWorld,paintDetails,paintSecrets}=window.eggs;c.clearRect(0,0,1920,1080);paintWorld(c,clock,theme);paintDetails(c,clock,theme);paintSecrets(c,clock,theme,[],assets,clock);},{theme,clock});
    await page.screenshot({path:path.join(output,`${theme}-${clock}.png`)});
    for(const slot of audit.slots)await page.screenshot({path:path.join(output,`${theme}-${clock}-spot${slot.lane}.png`),clip:{x:slot.box[0],y:slot.box[1],width:slot.box[2],height:slot.box[3]}});
   }
   const released=await page.evaluate(()=>{const a=window.eggs.assets,images=[...a.images];a.dispose();return a.images.length===0&&a.guestFrames.size===0&&a.poses.length===0&&images.every(i=>!i.getAttribute('src'));});assert.equal(released,true);audit.released=released;
   await page.emulateMedia({reducedMotion:'no-preference'});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'placement-audit.json'),JSON.stringify({results,errors},null,2));
  console.log(JSON.stringify(results.map(({theme,minimum,maximum,seen,clippedCount,released})=>({theme,minimum,maximum,seen,clippedCount,released}))));
  assert.ok(results.every(r=>r.clippedCount===0),'Visitor artwork must fit its scenic pocket; see placement-audit.json');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
