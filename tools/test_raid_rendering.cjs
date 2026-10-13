// Isolated Chromium proof + review artifacts. Never enqueues on the live Hub.
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),web=path.join(root,'mini projects/twitch_celebrations'),out=process.env.BORDER_REVIEW_ARTIFACT_DIR||path.join(root,'tmp_obs_debug');
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.wav':'audio/wav','.mp3':'audio/mpeg','.png':'image/png','.json':'application/json'};
let live=null,online=true,waitMode=false,revision=0,requests=0;const waiting=new Set();
const publish=value=>{live=value;revision++;for(const wake of [...waiting])wake();};
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/api/overlay'){requests++;if(!online){res.writeHead(503);res.end();return;}
 let timer;const send=()=>{clearTimeout(timer);waiting.delete(send);if(res.destroyed)return;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({active:live,settings:{volume:.22,muted:true,custom:{}},...(waitMode?{revision}:{})}));};
 if(waitMode&&!live&&Number(url.searchParams.get('after'))===revision){waiting.add(send);timer=setTimeout(send,1000);res.on('close',()=>{clearTimeout(timer);waiting.delete(send);});}else send();return;}
 const file=['/subtle.js','/optics.js'].includes(url.pathname)?path.join(root,'lib/browser_effects/web',url.pathname==='/optics.js'?'production.js':'subtle.js'):path.join(web,url.pathname==='/overlay'?'overlay.html':url.pathname.startsWith('/spirit/assets/')?'spirit_assets/'+path.basename(url.pathname):['/raid-dancers.json','/raid-penguin-frames.json'].includes(url.pathname)?'media/'+url.pathname.slice(1):url.pathname.slice(1));if(!file.startsWith(web+path.sep)&&!['/subtle.js','/optics.js'].includes(url.pathname)){res.writeHead(403);res.end();return;}try{res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
const fakeAudio=()=>{window.audioLog=[];window.Audio=class{constructor(src){this.src=src;this.volume=1;this.position=0;this.paused=true;window.audioLog.push(this);}get currentTime(){return this.position+(this.paused?0:(performance.now()-this.started)/1000);}set currentTime(v){this.position=v;this.started=performance.now();}play(){this.played=true;this.paused=false;this.started=performance.now();queueMicrotask(()=>this.onplaying?.());return Promise.resolve();}pause(){this.position=this.currentTime;this.paused=true;}};};
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let browser;try{
 browser=await chromium.launch({headless:true,channel:'chrome',args:['--mute-audio']});const page=await browser.newPage({viewport:{width:1920,height:1080}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(fakeAudio);
 // Exercise browser-clock behavior at the feature's configured OBS frame rate.
 if(process.env.RAID_TEST_FPS)await page.addInitScript(fps=>{
  window.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),1000/fps);
  window.cancelAnimationFrame=clearTimeout;
 },Number(process.env.RAID_TEST_FPS));
 await page.goto(base+'/overlay?preview');await page.waitForTimeout(150);
 fs.mkdirSync(out,{recursive:true});
 // Perimeter-only art at every transition; visible puppets, not hidden panels.
 const partyProof=await page.evaluate(async()=>{
  const {RaidParty,partyReady,raidGuests}=await import('/raid_party.js');await partyReady;const {musicAt}=await import('/raid_music.js');
  const {RAID_CAST,drawGuest}=await import('/raid_cast.js');
  const cv=document.createElement('canvas');cv.width=1920;cv.height=1080;const a=new RaidParty(cv);a.start({name:'Captain & <Friends>',count:420});
  const c=a.c,occupied=(x,y,w,h)=>c.getImageData(x,y,w,h).data.some((v,i)=>i%4===3&&v);
  c.fillText=c.strokeText=()=>{throw Error('Only the dedicated announcement may draw text');};
  let centerClear=true,maxGuests=0;const seen=new Set(),runs={};let previous=new Set();
  for(const theme of ['crab','dragon','cat','frog']){a.start({theme});previous=new Set();for(let frame=0;frame<=80;frame++){const t=frame/10;a.draw(musicAt(theme,t));centerClear&&=!occupied(240,170,1440,670);const guests=raidGuests(theme,t);maxGuests=Math.max(maxGuests,guests.length);guests.forEach(g=>{seen.add(g.key);if(!previous.has(g.id)){const key=theme+'/'+g.id;runs[key]=(runs[key]||0)+1;}});previous=new Set(guests.map(g=>g.id));}}
  const cast=RAID_CAST.map(key=>{a.clear();c.save();c.translate(960,540);drawGuest(c,key,3.5,.7);c.restore();return occupied(880,450,160,180);});
  a.start({theme:'crab'});a.draw(1.8);const penguinVisible=occupied(150,850,1300,210);a.draw(3.5);const edgesVisible=occupied(0,0,240,1080)&&occupied(1680,0,240,1080);
  const normal=cv.toDataURL();a.draw(4,true);const reduced=cv.toDataURL(),pixels=c.getImageData(0,0,1920,1080).data;a.draw(5,true);const after=c.getImageData(0,0,1920,1080).data;const reducedStable=pixels.every((v,n)=>v===after[n]);
  const start=performance.now();for(let j=0;j<90;j++)a.draw(2+j/30);const frameMs=(performance.now()-start)/90;
  a.draw(8);const cleared=!occupied(0,0,1920,1080);
  return {oneRunPerAct:Object.values(runs).every(n=>n===1),centerClear,maxGuests,seen:[...seen],edgesVisible,penguinVisible,cast,reducedStable,cleared,frameMs,changed:normal!==reduced};
 });
 console.log(JSON.stringify({partyProof}));
 assert(partyProof.centerClear&&partyProof.edgesVisible&&partyProof.penguinVisible&&partyProof.cast.every(Boolean)&&partyProof.reducedStable&&partyProof.cleared&&partyProof.changed);
 assert(partyProof.maxGuests<=4);assert(partyProof.oneRunPerAct,'An act must never cycle back during one raid');assert.equal(partyProof.seen.length,10);assert(partyProof.frameMs<30,'Edge animation fits 30fps');
 // Every shared payoff lands on an observed music beat, without reversing story time.
 const scoreProof=await page.evaluate(async()=>{
  const {RAID_SCORES,storyAt,musicAt}=await import('/raid_music.js');
  return Object.entries(RAID_SCORES).map(([theme,score])=>{
   let previous=-1,monotone=true;for(let t=0;t<=score.duration;t+=.001){const story=storyAt(theme,t);monotone&&=story>=previous;previous=story;}
   const hits=[1.13,1.71,3.35,4.48,4.9,6.22,7.24].map(story=>({story,seconds:musicAt(theme,story),error:Math.min(...score.beats.map(beat=>Math.abs(beat-musicAt(theme,story))))}));
   return {theme,duration:score.duration,monotone,hits,ends:storyAt(theme,score.duration)===8};
  });
 });
 assert(scoreProof.every(s=>s.monotone&&s.ends&&s.duration>6&&s.duration<6.7&&s.hits.every(h=>h.error<.001)));
 console.log(JSON.stringify({scoreProof}));
 // Exact user-made pose art and connected interaction endpoints.
 const crossoverProof=await page.evaluate(async()=>{
  const {GUEST_NAMES,guestsReady,drawSprite}=await import('/raid_guests.js');await guestsReady;
  const {activeCrossovers,rescueState,snackState,prankRecord,courierState}=await import('/raid_crossovers.js');
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=320;const c=canvas.getContext('2d');const poses=[];
  for(const name of GUEST_NAMES){const hashes=[];for(let pose=0;pose<3;pose++){c.clearRect(0,0,320,320);drawSprite(c,name,pose,160,265,160);const pixels=c.getImageData(0,0,320,320).data;const visible=pixels.filter((v,i)=>i%4===3&&v>32).length;hashes.push(canvas.toDataURL());poses.push({name,pose,visible});}if(new Set(hashes).size!==3)throw Error(name+' lost a distinct pose');}
  const starts={},seen=new Set();let last=new Set(),maxSupport=0;
  for(let frame=0;frame<=240;frame++){const t=frame/30,shows=activeCrossovers(t);maxSupport=Math.max(maxSupport,shows.reduce((n,s)=>n+s.cast.length,0));for(const s of shows){s.cast.forEach(n=>seen.add(n));if(!last.has(s.id))starts[s.id]=(starts[s.id]||0)+1;}last=new Set(shows.map(s=>s.id));}
  const anchored=[.4,.6,.8,1,1.15].every(t=>{const s=rescueState(t);return s.contact&&Math.abs(Math.hypot(s.hand.x-s.head.x,s.hand.y-s.head.y)-98)<.001&&s.head.x===1886&&s.head.y===320;});
  const snack=snackState(2.1),record=prankRecord({age:2.12,y:720}),cup=courierState(1.76);
  return {poses,uniqueScenes:Object.keys(starts).length,once:Object.values(starts).every(n=>n===1),cast:[...seen],maxSupport,anchored,snackHitsDrum:snack.star.x===107&&snack.star.y===496,recordBecomesHat:Math.abs(record.x-1733)<.001&&Math.abs(record.y-558)<.001,cupReachesRobot:cup.cup.x===1710&&cup.cup.y===995};
 });
 assert(crossoverProof.poses.every(p=>p.visible>1200));assert.equal(crossoverProof.poses.length,24);assert.equal(crossoverProof.cast.length,8);assert.equal(crossoverProof.uniqueScenes,5);assert(crossoverProof.once&&crossoverProof.anchored&&crossoverProof.snackHitsDrum&&crossoverProof.recordBecomesHat&&crossoverProof.cupReachesRobot);assert(crossoverProof.maxSupport<=4);
 console.log(JSON.stringify({crossoverProof}));
 const hashes=[];let maxMs=0;
 for(const theme of ['crab','dragon','cat','frog']){
  const result=await page.evaluate(async theme=>{const {RaidParty:RaidArt,partyReady}=await import('/raid_party.js');await partyReady;const {musicAt}=await import('/raid_music.js');const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;const art=new RaidArt(canvas);art.start({id:'test-'+theme,theme});const c=art.c;const checks=[];const start=performance.now();for(const t of [0,.8,1.8,3.5,5.5,7.8,8]){art.draw(musicAt(theme,t));const data=c.getImageData(0,0,1920,1080).data;let count=0,max=0;for(let i=3;i<data.length;i+=4){if(data[i])count++;max=Math.max(max,data[i]);}checks.push({t,count,max,center:c.getImageData(240,170,1440,670).data.some((v,i)=>i%4===3&&v)});}const ms=(performance.now()-start)/7;art.draw(3.5);const fingerprint=canvas.toDataURL();art.draw(4,true);const reducedA=canvas.toDataURL();art.draw(5,true);return {checks,ms,fingerprint,reducedStable:canvas.toDataURL()===reducedA};},theme);
  const drawMs=await page.evaluate(async theme=>{const {RaidParty:RaidArt,partyReady}=await import('/raid_party.js');await partyReady;const {musicAt}=await import('/raid_music.js');const cv=document.createElement('canvas');cv.width=1920;cv.height=1080;const a=new RaidArt(cv);a.start({theme,id:'timing'});a.draw(2);const start=performance.now();for(let i=0;i<90;i++)a.draw(2+i/30);return (performance.now()-start)/90;},theme);
  maxMs=Math.max(maxMs,drawMs);assert(drawMs<30,'Raid art must fit a 30fps frame budget');hashes.push(crypto.createHash('sha256').update(result.fingerprint).digest('hex'));assert(result.checks.every(x=>!x.center&&x.max<=255));assert.equal(result.checks[0].count,0);assert.equal(result.checks.at(-1).count,0);assert(result.checks[3].count>1000);assert(result.checks.some(x=>x.max>204),"Raid foreground must not receive a blanket opacity ceiling");assert(result.reducedStable);
  await page.evaluate(theme=>window.postMessage({type:'preview',item:{id:theme,kind:'raid',theme,name:'Friends <3 & Company',count:123,elapsed:3.5,duration:8},settings:{volume:.22,muted:true,custom:{}}},location.origin),theme);await page.waitForTimeout(120);assert.equal(await page.locator('#banner').isVisible(),false);assert.equal(await page.locator('#encore').isVisible(),false);assert.equal(await page.locator('#raidBadge').count(),0);assert.equal(await page.locator('#raidName').textContent(),'Friends <3 & Company');assert((await page.locator('#raidCrew').textContent()).includes('123'));assert.equal(await page.locator('#raidAnnouncement').isVisible(),true);const box=await page.locator('#raidAnnouncement').boundingBox();assert(box.y+box.height<=170,'Announcement stays above gameplay');assert.equal(await page.locator('.mascot').count(),0);assert.equal(await page.locator('video').count(),0);await page.screenshot({path:path.join(out,'raid-'+theme+'.png')});
 }
 assert.equal(new Set(hashes).size,4,'Worlds must have different actual artwork');
 // Fit a real long raider name, retain exact text and use the singular count.
 await page.evaluate(()=>window.postMessage({type:'preview',item:{id:'long',kind:'raid',theme:'cat',name:'AReallyLongRaiderName_With48Characters_AndFriends',count:1,elapsed:2,duration:8},settings:{volume:.22,muted:true,custom:{cat:{visual:'unused-video.mp4'}}}},location.origin));
 await page.waitForTimeout(100);
 assert(await page.locator('#raidName').evaluate(n=>n.scrollWidth<=n.clientWidth));
 assert.equal(await page.locator('#raidCrew').textContent(),'1 viewer just raided in!');
 assert.equal(await page.locator('video').count(),0);
 // No stale cues when opening halfway through; current-volume changes apply.
 await page.evaluate(()=>{window.audioLog=[];window.postMessage({type:'preview',item:{id:'late',kind:'raid',theme:'cat',name:'Late',count:12,elapsed:5.8,duration:8},settings:{volume:.4,muted:false,custom:{}}},location.origin);});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>audioLog.length),1);
 await page.evaluate(()=>window.postMessage({type:'stop'},location.origin));await page.waitForTimeout(120);assert.equal(await page.locator('#raidParty').count(),0);assert(await page.evaluate(()=>audioLog.every(a=>a.paused)));
 // The actual overlay follows the owned media position, including a stalled decoder.
 await page.evaluate(()=>window.postMessage({type:'preview',item:{id:'clock',kind:'raid',theme:'crab',name:'Music clock',count:2,elapsed:.9,duration:8},settings:{volume:.4,muted:true,custom:{}}},location.origin));
 await page.waitForTimeout(100);
 const clockProof=await page.evaluate(async()=>{
  const music=audioLog.findLast(a=>a.src.endsWith('raid-crab-single.wav'));
  music.pause();await new Promise(r=>setTimeout(r,50));const canvas=document.getElementById('raidParty'),held=canvas.toDataURL();await new Promise(r=>setTimeout(r,100));const heldSteady=canvas.toDataURL()===held;
  music.currentTime=4.21;await new Promise(r=>setTimeout(r,60));const moved=canvas.toDataURL()!==held;
  music.onended();return {heldSteady,moved,cleared:!document.getElementById('raidParty'),noLoop:music.loop===false};
 });
 assert(clockProof.heldSteady&&clockProof.moved&&clockProof.cleared&&clockProof.noLoop);console.log(JSON.stringify({clockProof}));
 // Reduced motion includes the new DOM announcement, even during the exit phase.
 await page.emulateMedia({reducedMotion:'reduce'});
 const reducedHeader=await page.evaluate(async()=>{
  const {RaidSequence}=await import('/raid_sequence.js');const s=new RaidSequence(document.getElementById('stage'));
  s.start({id:'reduced-header',theme:'crab',name:'A Very Welcome Raider',count:88});s.update(3,{muted:true,volume:.22});
  const snapshot=()=>[s.card.style.transform,s.card.style.opacity,s.crew.style.transform,s.party.canvas.toDataURL()];const first=snapshot();
  s.update(6.3,{muted:true,volume:.22});const stable=JSON.stringify(first)===JSON.stringify(snapshot());s.stop();
  return {stable,cleared:!document.querySelector('#raidAnnouncement')&&!document.querySelector('#raidParty')};
 });
 assert(reducedHeader.stable&&reducedHeader.cleared);await page.emulateMedia({reducedMotion:'no-preference'});
 // Real polling, not preview: elapsed server time, disconnect and idle cleanup.
 live={id:'transport',kind:'raid',theme:'dragon',name:'Crew',count:42,elapsed:2,duration:8};await page.goto(base+'/overlay');await page.locator('#raidParty').waitFor({timeout:3000});assert.equal(await page.locator('#raidParty').count(),1);
 const endedCount=await page.evaluate(()=>{audioLog.findLast(a=>a.src.endsWith('raid-dragon-single.wav')).onended();return audioLog.length;});
 await page.waitForTimeout(650);assert.equal(await page.locator('#raidParty').count(),0);assert.equal(await page.evaluate(()=>audioLog.length),endedCount,'A finished music file must not replay while the server event expires');
 live={...live,id:'transport-next'};await page.locator('#raidParty').waitFor({timeout:2000});online=false;await page.waitForTimeout(2900);assert.equal(await page.locator('#raidParty').count(),0);online=true;live=null;
 const legacyStart=requests;await page.waitForTimeout(2400);const legacyRequests=requests-legacyStart;
 waitMode=true;await page.goto(base+'/overlay');await page.waitForTimeout(1200);
 const startRequests=requests;await page.waitForTimeout(2400);const idleRequests=requests-startRequests;
 assert(idleRequests<=3&&idleRequests<legacyRequests/2,'idle overlay should wait for notifications');
 const wakeStart=Date.now();publish({id:'notified',kind:'raid',theme:'dragon',name:'Notified crew',count:42,elapsed:2,duration:8});
 await page.locator('#raidParty').waitFor({timeout:2000});const wakeMs=Date.now()-wakeStart;assert(wakeMs<700,'queued event wakes a waiting browser');
 publish(null);await page.waitForFunction(()=>!document.querySelector('#raidParty'));
 await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide')));await page.waitForTimeout(100);
 const exitRequests=requests;await page.waitForTimeout(1300);assert.equal(requests,exitRequests,'page exit cancels transport');
 console.log(JSON.stringify({legacyRequests,idleRequests,windowSeconds:2.4,wakeMs}));
 // Seven full-composition keyframes for reviewing setups, interactions and payoffs.
 for(const [i,story]of [1.35,2.25,3.3,4.75,5.28,6.45,7.32].entries()){
  await page.goto(base+'/overlay?preview');await page.evaluate(()=>import('/raid_party.js').then(m=>m.partyReady));
  const t=await page.evaluate(async story=>(await import('/raid_music.js')).musicAt('crab',story),story);
  await page.evaluate(t=>{document.body.style.background='#162330';document.querySelector('#stage').style.transition='none';window.postMessage({type:'preview',item:{id:'storyboard',kind:'raid',theme:'crab',name:'CaptainGoodVibes',count:420,elapsed:t,duration:8},settings:{volume:.22,muted:true,custom:{}}},location.origin);},t);
  await page.waitForTimeout(50);await page.screenshot({path:path.join(out,`story-${i}.png`)});
 }
 await page.close();
 if(process.env.RAID_EXPORT==='1')await require('./export_raid_preview.cjs')({browser,base,out,web,volume:Number(process.env.RAID_PREVIEW_VOLUME||.22)});
 const context=await browser.newContext({viewport:{width:1920,height:1080},recordVideo:{dir:out,size:{width:1920,height:1080}}});const preview=await context.newPage();await preview.addInitScript(fakeAudio);preview.on('pageerror',e=>errors.push(e.message));
 await preview.goto(base+'/overlay?preview');await preview.evaluate(base=>{document.body.innerHTML='';document.body.style.cssText='background:#121e25;display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px';for(const theme of ['crab','dragon','cat','frog']){const panel=document.createElement('div');panel.style.cssText='position:relative;background:radial-gradient(ellipse at 50% 50%,#25363b,#111c25);border:1px solid #31434c';const label=document.createElement('span');label.textContent=({crab:'CRAB CARNIVAL',dragon:'DRAGON DISCO',cat:'COSMIC CAT CLUB',frog:'FROG FIESTA'})[theme];label.style.cssText='position:absolute;top:45%;width:100%;text-align:center;color:#8397a0;font:18px Arial;letter-spacing:5px';panel.append(label);const frame=document.createElement('iframe');frame.dataset.theme=theme;frame.src=base+'/overlay?preview';frame.style.cssText='width:100%;height:100%;border:0;position:relative';panel.append(frame);document.body.append(panel);}},base);
 await preview.waitForTimeout(500);await preview.evaluate(()=>document.querySelectorAll('iframe').forEach(f=>f.contentWindow.postMessage({type:'preview',item:{id:f.dataset.theme,kind:'raid',theme:f.dataset.theme,name:'Your lovely raiding crew',count:123,elapsed:0,duration:8},settings:{volume:.22,muted:true,custom:{}}},location.origin)));
 await preview.waitForTimeout(3500);await preview.screenshot({path:path.join(out,'raid-worlds.png')});await preview.waitForTimeout(5000);assert.deepEqual(errors,[]);const video=preview.video();await context.close();await video.saveAs(path.join(out,'raid-worlds-motion.webm'));
 console.log(JSON.stringify({passed:true,uniqueWorlds:4,clearCenter:true,disconnectCleanup:true,maxFrameMs:Math.round(maxMs*100)/100,preview:path.join(out,'raid-worlds-motion.webm')}));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
