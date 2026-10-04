const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const captureDir=path.resolve(__dirname,'../output/spotify/live-video');
  fs.mkdirSync(captureDir,{recursive:true});
  const page=await browser.newPage({viewport:{width:400,height:300},recordVideo:process.env.SPOTIFY_CAPTURE_VIDEO?{dir:captureDir,size:{width:400,height:300}}:undefined}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:7447/overlay');
  if(process.env.SPOTIFY_CAPTURE_VIDEO)await page.addStyleTag({content:'body{background:#090e18}'});
  await page.evaluate(()=>{window.livePixels=()=>{clear();if(world.active)present();const probe=document.createElement('canvas');probe.width=canvas.width;probe.height=canvas.height;probe.getContext('2d').drawImage(canvas,0,0);return probe.toDataURL();};});
  const state=await (await page.request.get('http://127.0.0.1:7447/api/state')).json();
  await page.waitForFunction(()=>typeof MusicMotion==='function'&&typeof VisualJourney==='function'&&typeof journey==='object');
  assert.deepEqual(await page.evaluate(()=>VisualJourney.names),require('../mini projects/spotify/web/journey.js').names,'the complete scene catalog must be served');
  assert(await page.evaluate(()=>typeof VisualStageRenderer==='function'&&world.geometryEnabled===false),'the new production pipeline must be loaded');
  assert(await page.evaluate(()=>typeof VisualMorph?.render==='function'&&typeof VisualPalette?.color==='function'),'geometric transport and dynamic palette must be served');
  assert(await page.evaluate(()=>typeof MusicFeed==='function'&&typeof musicFeed.accept==='function'),'capture-clock input must be loaded');
  assert(await page.evaluate(()=>journey.history.length<=48),'bounded scene history must be loaded');
  for(const key of ['pitch','tonality','width','balance','flux'])assert.equal(typeof state[key],'number',`${key} must be served by the running audio analyzer`);
  assert.equal(state.audio_error,'');assert.match(state.audio_device,/Spotify process tree/);
  assert.equal(await page.locator('#disc,.note,.label').count(),0);
  if(state.playing){
   await page.waitForFunction(()=>!document.getElementById('widget').hidden);
   await page.waitForTimeout(250);
   assert.equal(await page.locator('#title').textContent(),state.title);
   const first=await page.evaluate(()=>livePixels());
   await page.waitForTimeout(350);
   if(state.energy>.03)assert.notEqual(await page.evaluate(()=>livePixels()),first);
   assert(await page.evaluate(()=>typeof world==='object'&&typeof world.step==='function'),'stateful world must be loaded');
   if(process.env.SPOTIFY_CAPTURE_VIDEO){
    const before=await page.evaluate(()=>world.snapshot());
    await page.waitForTimeout(18000);
    const after=await page.evaluate(()=>world.snapshot());
    assert(after.phase.some((v,i)=>v>before.phase[i]),'real Spotify audio must advance spectral travel');
    assert(after.onsets>before.onsets,'real Spotify audio must excite frequency lanes');
    console.log('Live musical history:',JSON.stringify({form:await page.evaluate(()=>journey.name),morph:await page.evaluate(()=>journey.blend),onsets:after.onsets,transitions:after.transitions}));
   }
   const output=path.resolve(process.env.SPOTIFY_LIVE_OUTPUT||path.resolve(__dirname,'../output/spotify'),'live.png');
   fs.mkdirSync(path.dirname(output),{recursive:true});await page.screenshot({path:output,omitBackground:true});
  }else assert(await page.locator('#widget').isHidden());
  const hub=await browser.newPage();hub.on('pageerror',e=>errors.push(e.message));await hub.goto('http://127.0.0.1:7420');
  await hub.waitForFunction(()=>document.getElementById('statusText')?.textContent==='Hub connected',null,{timeout:60000});
  const status=await (await hub.request.get('http://127.0.0.1:7420/api/status')).json();
  assert(status.projects.some(p=>p.name==='spotify'&&p.controlled_scenes.includes('Spotify Overlay')),'Spotify must be registered in the running Hub');
  assert.deepEqual(errors,[]);
  if(process.env.SPOTIFY_CAPTURE_VIDEO){const video=page.video();await page.close();await video.saveAs(path.resolve(__dirname,'../output/spotify/live-reactive.webm'));}
  console.log(JSON.stringify({playing:state.playing,title:state.title,energy:state.energy,capture:state.audio_device,ui:'ready'}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
