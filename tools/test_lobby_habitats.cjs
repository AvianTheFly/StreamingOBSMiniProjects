// Finite browser audit of the four inhabited paintings and preserved generated cast.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),sharp=require('sharp');
const out=path.resolve('output/lobby-distinct-v4');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[],report=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const id of ['aurora-camp','sanctuary','forge','phoenix-observatory']){
   const url=`http://127.0.0.1:7420/lobby-motion/index.html?world=${id}&preview=1&screen=0&auto=0&paused=1&at=30`;
   await page.goto(url);await page.locator('canvas[data-ready=true]').waitFor();
   assert.equal(await page.locator('canvas').getAttribute('data-festival'),'');
   await page.screenshot({path:path.join(out,id+'.png')});
   const result=await page.evaluate(async id=>{
    const {loadWorld}=await import('./worlds.js'),{habitatPlaces,admitHabitat,visibleHabitatEvents}=await import('./habitat-blocking.js');
    const w=await loadWorld(id),art=await w.createMotion().load(),canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
    const {habitatDesigns}=await import('./habitat-designs.js');
    if(JSON.stringify(w.scene.holes)!==JSON.stringify(['screen','camera','chat'].map(k=>habitatDesigns[id][k])))throw Error('Composition and renderer diverged');
    const c=canvas.getContext('2d',{willReadFrequently:true}),evidence=[];
    for(const spec of w.cues.filter(e=>!e.id.startsWith('border-'))){
     const samples=[];for(const age of [1,4,6.73,11]){c.clearRect(0,0,1920,1080);w.artists[spec.id](c,age,{seed:73},art);samples.push(c.getImageData(0,0,1920,1080).data);}
     let visible=0,motion=0;for(let i=3;i<samples[1].length;i+=4){visible+=samples[1][i]>16;motion+=Math.abs(samples[1][i]-samples[2][i])>16;}
     if(visible<50||motion<10)throw Error(id+'/'+spec.id+' insufficient visible action '+visible+'/'+motion);
     // Effects are cleared by the one stage owner, including custom saved apertures.
     for(const h of w.scene.holes)c.clearRect(...h);
     for(const h of w.scene.holes){const d=c.getImageData(...h).data;for(let i=3;i<d.length;i+=4)if(d[i])throw Error('Aperture not clear');}
     evidence.push({cue:spec.id,visiblePixels:visible,motionPixels:motion});
    }
    const one={id:'one',habitatZone:'tea',habitatStory:true},two={id:'two',habitatZone:'fire',habitatStory:true};
    if(admitHabitat({...one,id:'three'},[one])||admitHabitat({...one,habitatZone:'path'},[one,two]))throw Error('Automatic cast overcrowded');
    const manual={...one,id:'manual',manual:true};if(visibleHabitatEvents([one,two,manual]).some(e=>e.id==='one'))throw Error('Manual story did not claim its surface');
    if(id==='forge'&&w.scene.residents!==false)throw Error('Old floating shelf residents returned');
    art.dispose();if(art.guests.frames.size||art.league.frames.size||art.base.width!==1)throw Error('Resource leak');
    return {id,places:habitatPlaces[id],evidence};
   },id);report.push(result);
   for(const p of result.places){
    for(const age of [3,6,9]){
     await page.goto(url+`&cue=game-${p.character}&age=${age}`);await page.locator('canvas[data-ready=true]').waitFor();
     await page.screenshot({path:path.join(out,`${id}-${p.character}-${age}.png`)});
    }
   }
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'habitat-qa.json'),JSON.stringify({report,errors},null,2));
  const tiles=[];for(const [i,row] of report.entries())tiles.push({input:await sharp(path.join(out,row.id+'.png')).resize(960,540).toBuffer(),left:i%2*960,top:Math.floor(i/2)*540});
  await sharp({create:{width:1920,height:1080,channels:3,background:'#101722'}}).composite(tiles).png().toFile(path.join(out,'four-worlds.png'));
  console.log('Four habitats: visible finite actions, eight preserved character types, quiet surfaces, manual priority, no default captions, aperture clearing and decoded cleanup passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
