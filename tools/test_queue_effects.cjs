// Finite catalogue review: all 48 acts, meaningful visible differences and cost.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),web=path.join(root,'mini projects/league_api/stage_web'),out=process.env.QUEUE_OVERLAY_TEST_OUTPUT||path.join(root,'output/queue-shuffle');
async function main(){fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://queue.test/**',r=>{const p=new URL(r.request().url()).pathname,file=p==='/shared/visible-poll.js'?path.join(root,'lib/browser_effects/web/visible-poll.js'):path.join(web,p==='/stage/queue'?'queue.html':p.split('/').at(-1));return r.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':'text/html'});});
 await page.goto('http://queue.test/stage/queue?demo=1&theme=bear');await page.waitForFunction(()=>document.querySelector('#queueAtmosphere')?.dataset.artCount==='4');
 await page.evaluate(async()=>{dispatchEvent(new PageTransitionEvent('pagehide'));const {loadSpiritArt}=await import('/stage/queue-background.js');window.catalogueArt=await loadSpiritArt(new AbortController().signal);});
 const report=[],allImages=new Set();
 for(const theme of ['bear','turtle','ram','phoenix']){
  for(let id=0;id<12;id++){
   const result=await page.evaluate(async({theme,id})=>{
    const {paintBackground}=await import('/stage/queue-background.js'),{paintSpirit,paintTrack}=await import('/stage/queue-art.js'),{EFFECT_NAMES}=await import('/stage/queue-effects.js');
    const canvas=document.querySelector('#queueAtmosphere'),c=canvas.getContext('2d');
    paintBackground(canvas,{from:theme,to:theme,mix:1,cue:null},5,true,window.catalogueArt);const base=c.getImageData(0,0,canvas.width,canvas.height).data;
    const frame={from:theme,to:theme,mix:1,cue:{id,phase:.5,amount:1}};
    paintBackground(canvas,frame,5,true,window.catalogueArt);const pixels=c.getImageData(0,0,canvas.width,canvas.height).data;
    let changed=0;for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i+3]-base[i+3])>10||Math.abs(pixels[i]-base[i])>20)changed++;
    const image=canvas.toDataURL();paintBackground(canvas,{...frame,cue:{id,phase:.7,amount:Math.sin(.7*Math.PI)**2}},7,true,window.catalogueArt);const moving=canvas.toDataURL()!==image;
    // Measure the normal drawing path, without inserting a synchronous GPU
    // readback into each frame. Pixel verification above covers raster output.
    const start=performance.now();for(let i=0;i<12;i++){paintBackground(canvas,frame,i/24,true,window.catalogueArt);paintSpirit(document.querySelector('#spirit'),theme,i/24,true,1,frame.cue);paintTrack(document.querySelector('#queueTrack'),frame,i/24,true);}const averageMs=(performance.now()-start)/12;
    paintBackground(canvas,frame,5,true,window.catalogueArt);paintSpirit(document.querySelector('#spirit'),theme,5,true,1,frame.cue);paintTrack(document.querySelector('#queueTrack'),frame,5,true);document.querySelector('#queueCard').dataset.theme=theme;
    return {name:EFFECT_NAMES[theme][id],changed,moving,averageMs,image};
   },{theme,id});
   assert(result.changed>500,`${theme}/${result.name} is visibly distinct from ambience: ${result.changed}`);assert(result.moving);assert(result.averageMs<20,`${theme}/${result.name} submission cost ${result.averageMs}ms leaves at least half the 24 FPS budget`);allImages.add(result.image);
   const {image,...record}=result;report.push({theme,id,...record});await page.locator('#queueCard').screenshot({path:path.join(out,`${theme}-effect-${id}.png`),omitBackground:true,animations:'disabled'});
   if(id>=8){
    const phases=[];
    for(const phase of [.18,.5,.82]){
     phases.push(await page.evaluate(async({theme,id,phase})=>{const {paintBackground}=await import('/stage/queue-background.js'),{paintSpirit}=await import('/stage/queue-art.js'),canvas=document.querySelector('#queueAtmosphere'),cue={id,phase,amount:Math.sin(phase*Math.PI)**2};paintBackground(canvas,{from:theme,to:theme,mix:1,cue},phase*10,true,window.catalogueArt);paintSpirit(document.querySelector('#spirit'),theme,phase*10,true,cue.amount,cue);return canvas.toDataURL();},{theme,id,phase}));
     await page.locator('#queueCard').screenshot({path:path.join(out,`${theme}-story-${id}-${Math.round(phase*100)}.png`),omitBackground:true,animations:'disabled'});
    }
    assert.equal(new Set(phases).size,3,`${theme}/${id} has distinct arrival, action and aftermath`);
   }
  }
 }
 assert.equal(allImages.size,48);assert.deepEqual(errors,[]);
 await page.evaluate(()=>{for(const surface of Object.values(window.catalogueArt))surface.width=surface.height=0;delete window.catalogueArt;});
 await page.setViewportSize({width:1244,height:1170});
 for(const theme of ['bear','turtle','ram','phoenix']){
  await page.setContent(`<style>html,body{margin:0;background:#0c141b}body{display:grid;grid-template-columns:604px 604px;gap:12px;padding:12px;color:#c3d1dd;font:12px Segoe UI}img{display:block;width:604px;height:154px}p{margin:0 0 6px}</style>${report.filter(r=>r.theme===theme).map(r=>`<div><p>${r.name}</p><img src="data:image/png;base64,${fs.readFileSync(path.join(out,`${theme}-effect-${r.id}.png`)).toString('base64')}"></div>`).join('')}`);
  await page.screenshot({path:path.join(out,`${theme}-catalogue.png`)});
 }
 fs.writeFileSync(path.join(out,'catalogue-audit.json'),JSON.stringify(report,null,2));console.log('All 48 acts: distinct artwork, multi-stage performances, animation and render budget passed.');
}finally{await browser.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
