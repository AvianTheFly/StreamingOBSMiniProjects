// Disposable Chromium fixtures: audio-clock timing, alpha, editor and cleanup.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),web=path.join(root,'mini projects/love_me/web');
const rows=JSON.parse(fs.readFileSync(path.join(root,'output/mood-cues/catalog.json')));
const assets=path.join(process.env.LOCALAPPDATA,'StreamingHub/mood-cues/signal-v2');
const montageAssets=path.join(process.env.LOCALAPPDATA,'StreamingHub/mood-cues/signal-montage');
const assetNames=['ram-charge.png','bear-attack.png','phoenix-hero.png','turtle.png','UnifrakturCook-Bold.ttf',...['CourierPrime','RubikDirt','RubikWetPaint','RubikBurned','BungeeShade','MetalMania','Eater'].map(name=>name+'-Regular.ttf')];
const montageManifest=JSON.parse(fs.readFileSync(path.join(montageAssets,'montage.json')));
assert.equal(montageManifest.shots.length,35);assert.equal(new Set(montageManifest.shots.map(shot=>shot.sha256)).size,35,'Each still must be a different image');
const montageNames=['montage.json',...montageManifest.shots.map(shot=>shot.file)];
assetNames.push(...montageNames);
function assetReply(route,name){return route.fulfill({body:fs.readFileSync(path.join(montageNames.includes(name)?montageAssets:assets,name)),contentType:name.endsWith('.png')?'image/png':name.endsWith('.jpg')?'image/jpeg':name.endsWith('.json')?'application/json':'font/ttf'});}
const output=process.env.MOOD_CUES_TEST_OUTPUT||path.join(root,'output/mood-cues');
async function checkEditor(browser){
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],actions=[];
 let revision=1,saved=rows.map(row=>({...row,audio_ready:false})),conflict=false;
 const state=()=>({revision:String(revision),variations:saved,ready:true,runtime:{busy:false},preview_url:'http://127.0.0.1:7444/presentation/love_me/preview.html'});
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url()),name=path.basename(url.pathname);
  if(assetNames.includes(name))return assetReply(route,name);
  if(url.pathname==='/api/mood-cues')return route.fulfill({json:state()});
  if(url.pathname==='/api/mood-cues/settings'){
   const body=route.request().postDataJSON();
   if(conflict||body.revision!==String(revision))return route.fulfill({status:409,json:{error:'Settings changed. Reload saved.'}});
   const base=saved.find(row=>row.id===(body.clone_from||body.id)),row={...base,...body.changes,id:body.id};
   saved=[...saved.filter(row=>row.id!==body.id),row];revision++;return route.fulfill({json:state()});
  }
  if(url.pathname==='/api/mood-cues/control'){actions.push(route.request().postDataJSON().action);return route.fulfill({json:{ok:true}});}
  if(url.pathname==='/editor-fixture')return route.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/css/main.css"><link rel="stylesheet" href="/css/workspace.css"><style>html,body{height:auto;overflow:auto}</style><main id="fixture" style="padding:24px"></main><script type="module">import * as editor from "/js/pages/mood-cues.js";window.editor=editor;editor.mount(document.querySelector("main"));</script>'});
  const allowed={'/js/pages/mood-cues.js':'hub_ui/app/js/pages/mood-cues.js','/js/utils.js':'hub_ui/app/js/utils.js','/css/main.css':'hub_ui/app/css/main.css','/css/workspace.css':'hub_ui/app/css/workspace.css'};
  if(allowed[url.pathname])return route.fulfill({body:fs.readFileSync(path.join(root,allowed[url.pathname])),contentType:name.endsWith('.js')?'application/javascript':'text/css'});
  if(url.port==='7444'&&['preview.html','preview.js','renderer.js','art.js','signal.js','montage.js','type-ink.js','timeline.js'].includes(name))return route.fulfill({body:fs.readFileSync(path.join(web,name)),contentType:name.endsWith('.js')?'application/javascript':'text/html'});
  return route.fulfill({status:404});
 });
 await page.goto('http://127.0.0.1:7420/editor-fixture');await page.locator('#mcTitle').filter({hasText:'Signal found'}).waitFor();
 assert.equal(await page.locator('[data-mood]').count(),4);
 assert.equal(await page.locator('[data-mood]').first().evaluate(element=>getComputedStyle(element).display),'block','gallery copy stacks vertically');
 await page.locator('#mcMode').selectOption('repeat');assert(await page.locator('#mcRepeats').isEnabled());
 await page.locator('#mcRepeats').fill('3');await page.locator('#mcOpacity').fill('58');
 await page.getByRole('button',{name:'Save variation',exact:true}).click();await page.locator('#mcFeedback').filter({hasText:'Saved.'}).waitFor();
 assert.equal(saved.find(row=>row.id==='signal_found').repeats,3);assert.equal(saved.find(row=>row.id==='signal_found').opacity,.58);
 await page.getByRole('button',{name:'Make a variation',exact:true}).click();await page.locator('#mcName').fill('Fixture variation');
 await page.getByRole('button',{name:'Save variation',exact:true}).click();await page.locator('#mcFeedback').filter({hasText:'Saved.'}).waitFor();
 assert.equal(saved.length,5);assert.equal(saved.at(-1).hotkey,'');
 await page.getByRole('button',{name:'Save & play in OBS',exact:true}).click();await page.locator('#mcFeedback').filter({hasText:'Cue requested'}).waitFor();
 assert.equal(actions.at(-1),saved.at(-1).id);
 await Promise.all([page.waitForResponse(response=>response.url().endsWith('/control')),page.getByRole('button',{name:'Stop cue',exact:true}).click()]);assert.equal(actions.at(-1),'revert');
 conflict=true;await page.locator('#mcName').fill('Unsaved');await page.getByRole('button',{name:'Save variation',exact:true}).click();await page.locator('#mcFeedback').filter({hasText:'Reload saved'}).waitFor();
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Reload saved',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#mcName').value==='Fixture variation');
 await page.screenshot({path:path.join(output,'mood-editor-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);assert.equal(overflow,false,'editor fits mobile width');
 await page.screenshot({path:path.join(output,'mood-editor-mobile.png'),fullPage:true});
 await page.evaluate(()=>window.editor.unmount());assert.deepEqual(errors,[]);await page.close();
 return {variations:saved.length,actions,errors};
}
function wave(seconds){const samples=44100*seconds,file=Buffer.alloc(44+samples*2);file.write('RIFF');file.writeUInt32LE(file.length-8,4);file.write('WAVEfmt ',8);file.writeUInt32LE(16,16);file.writeUInt16LE(1,20);file.writeUInt16LE(1,22);file.writeUInt32LE(44100,24);file.writeUInt32LE(88200,28);file.writeUInt16LE(2,32);file.writeUInt16LE(16,34);file.write('data',36);file.writeUInt32LE(samples*2,40);return file;}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
 const errors=[],acks=[];let active=null,offline=false,audioBytes=wave(7),audioType='audio/wav';
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.audioObjects=[];window.frames=0;const AudioOriginal=Audio,raf=requestAnimationFrame;window.Audio=function(...args){const a=new AudioOriginal(...args);window.audioObjects.push(a);return a;};window.requestAnimationFrame=fn=>raf(t=>{window.frames++;fn(t);});});
  await page.route('http://127.0.0.1:7444/**',async route=>{
   const url=new URL(route.request().url());
   if(assetNames.includes(path.basename(url.pathname)))return assetReply(route,path.basename(url.pathname));
   if(url.pathname.startsWith('/api/state/')){if(offline)return route.abort();return route.fulfill({json:{active}});}
   if(url.pathname.startsWith('/api/ack/')){acks.push(route.request().postDataJSON());return route.fulfill({json:{ok:true}});}
   if(url.pathname.startsWith('/audio/'))return route.fulfill({body:audioBytes,contentType:audioType});
   const name=url.pathname.startsWith('/overlay/')?'overlay.html':path.basename(url.pathname);
   if(!['overlay.html','preview.html','renderer.js','art.js','playback.js','signal.js','montage.js','type-ink.js','timeline.js','preview.js'].includes(name))return route.fulfill({status:404});
   return route.fulfill({body:fs.readFileSync(path.join(web,name)),contentType:name.endsWith('.js')?'application/javascript':'text/html'});
  });
  await page.goto('http://127.0.0.1:7444/overlay/love_me');await page.waitForTimeout(450);
  assert.equal(await page.evaluate(()=>window.frames),0,'idle does not animate');
  const stats=await page.evaluate(async rows=>{
   const {MoodRenderer}=await import('/presentation/love_me/renderer.js'),{authoredTime}=await import('/presentation/love_me/timeline.js'),{ArtAtlas}=await import('/presentation/love_me/art.js');
   const atlas=new ArtAtlas(rows[0].palette),realms=Array.from({length:6},(_,i)=>atlas.get('realm',i).toDataURL());
   if(new Set(realms).size!==6)throw Error('Montage needs six distinct realms.');
   if(atlas.get('realm',0)!==atlas.get('realm',6))throw Error('Realm cache must reuse images.');
   const canvas=document.querySelector('canvas'),renderer=new MoodRenderer(canvas),results=[];
   for(const row of rows){for(const position of ['top','left','right']){
    await renderer.prepare(row);renderer.draw(row.audio_anchor+1,{...row,position});const c=canvas.getContext('2d'),center=row.style==='signal'?c.getImageData(490,290,940,570).data:c.getImageData(310,325,1300,530).data;
    let central=0;for(let i=3;i<center.length;i+=4)if(center[i])central++;
    const all=c.getImageData(0,0,1920,1080).data;let painted=0;for(let i=3;i<all.length;i+=4)if(all[i])painted++;
    let photoMax=0;for(let y=290;y<1080;y++)for(let x=0;x<1920;x++)photoMax=Math.max(photoMax,all[(y*1920+x)*4+3]);
    results.push({id:row.id,style:row.style,position,central,painted,photoMax});
   }}
   const altered={...rows[0],duration:12,audio_anchor:3};
   if(authoredTime(3,altered)!==altered.anchor)throw Error('anchor did not map to authored reveal');
   if(authoredTime(12,altered)!==altered.timeline_duration)throw Error('excerpt end did not map to authored end');
   const {lyricAt,faces}=await import('/presentation/love_me/signal.js');
   if(faces.length<23||new Set(faces).size<23)throw Error('Signal needs at least twenty-three different typefaces');
   if(lyricAt(9.99,rows[0]).text!=='')throw Error('User requested no words for first ten seconds');
   if(lyricAt(10.04,rows[0]).text!=='WHERE'||lyricAt(12.1,rows[0]).text!=='HAVE'||lyricAt(13.5,rows[0]).text!=='BEEN'||lyricAt(16.5,rows[0]).text!=='LIFE'||lyricAt(18.01,rows[0]).text!=='')throw Error('User listening score was not respected');
   const lyricRow={...rows[0],audio_start:2,audio_rate:2,lyric_offset:.1,lyric_cues:[{start:3,end:6,text:'WHERE'}]};
   if(lyricAt(.54,lyricRow).text!=='')throw Error('lyric appeared before its file-time onset');
   const first=lyricAt(.6,lyricRow),later=lyricAt(.7,lyricRow),held=lyricAt(1.3,lyricRow);
   if(first.text!=='WHERE'||later.text!=='WHERE'||first.font===later.font)throw Error('held word must cycle distinct fonts');
   if(held.alpha>=first.alpha)throw Error('long held word must fade');
   if(lyricAt(2.1,lyricRow).text!=='')throw Error('lyrics must clear between phrases');
   const {montageAt}=await import('/presentation/love_me/montage.js'),signal=rows[0];
   for(const time of [10,10.07,10.15,10.39,10.4,12.47,14.95]){
    const score=montageAt(time,signal,18);
    if(Math.abs(score.incoming+score.outgoing*(1-score.incoming)-score.opacity)>1e-9)throw Error('Crossfade increases combined opacity');
    if(time<12?!(score.interval>.1&&score.interval<=.12):score.interval!==.2)throw Error('WHERE must cut faster than HAVE YOU BEEN');
   }
   if(montageAt(signal.image_onset+.12,signal,35).index!==1)throw Error('Rapid cuts must start on the musical hit');
   const normal=montageAt(12.6,signal,18),trimmed=montageAt(5.3,{...signal,audio_start:2,audio_rate:2},18);
   if(normal.index!==trimmed.index||normal.phase!==trimmed.phase)throw Error('Montage lost file-time alignment after trim/speed');
   const hit=signal.image_onset??10;
   if(montageAt(hit-.0001,signal,21).opacity!==0||montageAt(15,signal,21).opacity!==0)throw Error('Images must stay between the musical hit and fifteen seconds');
   if(montageAt(hit,signal,35).opacity===0||montageAt(hit+.24,signal,35).index<2)throw Error('Images must already be rapidly changing before WHERE');
   const slots=[];for(let t=hit;t<15;t+=.005){const n=montageAt(t,signal,35).index;if(slots.at(-1)!==n)slots.push(n);}
   if(slots.length!==35||new Set(slots).size!==slots.length)throw Error('All 35 shots must appear once, without looping');
   const scarce=[];for(let t=hit;t<15;t+=.005){const n=montageAt(t,signal,4).index;if(scarce.at(-1)!==n)scarce.push(n);}
   if(scarce.join(',')!=='0,1,2,3')throw Error('A short catalog must hold its final image rather than repeat earlier shots');
   const {TypeInk}=await import('/presentation/love_me/type-ink.js'),ink=new TypeInk();
   for(const face of faces)ink.get('WHERE',face);if(ink.cache.size>12)throw Error('Glyph cache exceeds bounded memory');
   if(ink.get('WHERE',faces[0])!==ink.get('WHERE',faces[0]))throw Error('Glyph cache must reuse rendered text');
   const trimmedHit=montageAt((hit-2)/2,{...signal,audio_start:2,audio_rate:2},21);
   if(trimmedHit.opacity===0||trimmedHit.index!==0)throw Error('Trim/speed must preserve the image hit in original-file seconds');
   if(!(montageAt(12.1,signal,18).opacity>montageAt(13.5,signal,18).opacity&&montageAt(13.5,signal,18).opacity>montageAt(14.5,signal,18).opacity))throw Error('HAVE YOU BEEN must fade quickly');
   renderer.draw(hit-.0001,signal);
   if(canvas.getContext('2d').getImageData(0,0,1920,1080).data.some((v,i)=>i%4===3&&v))throw Error('No imagery before the actual musical hit');
   renderer.draw(hit,signal);
   if(!canvas.getContext('2d').getImageData(960,500,1,1).data[3])throw Error('First image is delayed by an attack ramp');
   renderer.draw(15.1,signal);
   if(canvas.getContext('2d').getImageData(0,290,1920,790).data.some((v,i)=>i%4===3&&v))throw Error('Imagery must finish before ALL MY LIFE');
   if(lyricAt(15.1,signal).text!=='ALL')throw Error('Ending imagery must not change the sung word timings');
   await renderer.prepare(signal);renderer.draw(18.01,signal);
   if(canvas.getContext('2d').getImageData(0,0,1920,1080).data.some((v,i)=>i%4===3&&v))throw Error('Montage must clear when lyric phrase ends');
   renderer.clear();return results;
  },rows);
  for(const r of stats){
   if(r.style==='signal'){
    assert(r.central>940*570*.99,'cinematic montage covers the gameplay center');
    assert.equal(r.painted,1920*1080,'cinematic montage covers the entire frame');
    assert(r.photoMax<=90,'photos stay near original Love Me 35% opacity');
   }else{
    assert.equal(r.central,0,`${r.id} gameplay center`);assert(r.painted>9000,`${r.id} renders imagery`);assert(r.painted<1920*1080*.18,`${r.id} must leave at least 82% clear`);
   }
  }
  const silentStarted=page.waitForResponse(response=>response.url().includes('/api/ack/')&&response.request().postDataJSON()?.id==='silent'&&response.request().postDataJSON()?.status==='playing');
  active={id:'silent',stem:'signal_found',effect:{...rows[0],audio:false,duration:4,audio_anchor:1},started:false,elapsed:0,paused:false};
  await silentStarted;await page.waitForFunction(()=>window.frames>8);assert(acks.some(x=>x.id==='silent'&&x.status==='playing'));
  active={...active,paused:true};await page.waitForTimeout(220);const frozen=await page.evaluate(()=>window.frames);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.frames),frozen,'silent pause freezes visuals');
  active={...active,paused:false};await page.waitForTimeout(250);assert((await page.evaluate(()=>window.frames))>frozen);active=null;await page.waitForTimeout(250);
  active={id:'audio',stem:'golden',effect:{...rows[2],audio:true,audio_start:.5,audio_rate:1,duration:4,audio_anchor:1},started:false,elapsed:0,paused:false};
  await page.waitForFunction(()=>window.audioObjects.at(-1)?.currentTime>.8);assert(acks.some(x=>x.id==='audio'&&x.status==='playing'));
  active={...active,paused:true};await page.waitForFunction(()=>window.audioObjects.at(-1).paused);const clock=await page.evaluate(()=>window.audioObjects.at(-1).currentTime);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.audioObjects.at(-1).currentTime),clock);
  active={...active,paused:false};await page.waitForFunction(()=>window.audioObjects.at(-1).currentTime>1.1);
  await page.waitForFunction(()=>window.audioObjects.at(-1).getAttribute('src')===null,{timeout:6500});await page.waitForTimeout(150);assert(acks.some(x=>x.id==='audio'&&x.status==='ended'));
  active=null;await page.waitForTimeout(450);audioBytes=wave(1);
  const audioCount=await page.evaluate(()=>window.audioObjects.length);
  active={id:'too-short',stem:'golden',effect:{...rows[2],audio:true,duration:4,audio_anchor:1},elapsed:0,paused:false};
  await page.waitForFunction(n=>window.audioObjects.length>n&&window.audioObjects.at(-1)?.getAttribute('src')===null,audioCount);await page.waitForTimeout(150);assert(acks.some(x=>x.id==='too-short'&&x.status==='error'),'short excerpt reports error');
  active=null;await page.waitForTimeout(450);active={id:'offline',stem:'golden',effect:{...rows[2],audio:false,duration:20},elapsed:0,paused:false};await page.waitForTimeout(350);offline=true;await page.waitForTimeout(2900);
  const stopped=await page.evaluate(()=>window.frames);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.frames),stopped,'server loss stops animation');
  assert.deepEqual(errors,[]);
  // Optional user-provided file check; still muted and isolated from the live Hub.
  let suppliedAudio=null;
  if(process.env.MOOD_CUES_AUDIO_PATH){
   offline=false;active=null;await page.waitForTimeout(450);
   audioBytes=fs.readFileSync(process.env.MOOD_CUES_AUDIO_PATH);audioType='audio/mpeg';
   active={id:'supplied-audio',stem:'signal_found',effect:{...rows[0],audio:true,audio_start:0,duration:30.65,audio_anchor:9.65},started:false,elapsed:0,paused:false};
   await page.waitForFunction(()=>window.audioObjects.at(-1)?.currentTime>1);
   suppliedAudio={duration:await page.evaluate(()=>window.audioObjects.at(-1).duration),excerpt:30.65,anchor:9.65};
   assert(suppliedAudio.duration>=30.65,'supplied MP3 supports the saved excerpt');
   await page.waitForFunction(()=>window.audioObjects.at(-1).getAttribute('src')===null,{timeout:35000});await page.waitForTimeout(150);
   assert(acks.some(ack=>ack.id==='supplied-audio'&&ack.status==='ended'),'supplied MP3 finishes its exact excerpt');
  }
  // Contact sheet of actual renderer output over a game-like field.
  offline=false;active=null;
  await page.goto('http://127.0.0.1:7444/presentation/love_me/preview.html');
  await page.setContent('<style>body{margin:0;padding:36px;background:#101a24;color:#f4e7d9;font:16px system-ui}h1{font:42px Georgia;margin:0 0 6px}p{color:#adbac5}main{display:grid;grid-template-columns:1fr 1fr;gap:24px}section{border:1px solid #ffffff20;border-radius:12px;overflow:hidden}h2{font:24px Georgia;margin:14px 20px}canvas{display:block;width:100%;background:radial-gradient(ellipse at center,#294046,transparent 65%),linear-gradient(130deg,#0e242e,#19343e)}</style><h1>Mood cues</h1><p>Original spirit artwork · transparent perimeter · one musical lift</p><main>'+rows.map(r=>`<section><canvas id="${r.id}" width="1920" height="1080"></canvas><h2>${r.hotkey} · ${r.name}</h2></section>`).join('')+'</main>');
  await page.evaluate(async rows=>{const {MoodRenderer}=await import('/presentation/love_me/renderer.js');for(const row of rows){const r=new MoodRenderer(document.getElementById(row.id));await r.prepare(row);r.draw(row.style==='signal'?10.4:row.audio_anchor+1,row);}},rows);
  await page.screenshot({path:path.join(output,'mood-cues-preview.png'),fullPage:true});
  const editor=await checkEditor(browser);
  fs.writeFileSync(path.join(output,'browser-verification.json'),JSON.stringify({stats,acks,errors,editor,suppliedAudio},null,2));
  console.log('Mood cues: alpha, timing, pause, cleanup, editor save/clone/play, conflict recovery and mobile checks passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
