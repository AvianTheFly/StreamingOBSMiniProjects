// Browser-observable work and lifetime checks; no live settings or OBS writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),app=path.join(root,'hub_ui/app');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const state={title:'STREAM STARTING SOON',subtitle:'Welcome',artwork:['fjord.png'],available_artwork:['fjord.png'],
  artwork_index:0,motion:'drift',active:true,playing:true,clip_title:'Highlight',clip_box:[690,320,1144,643.5]};
 let requests=0,fail=false,hold=false,release;const errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const original=fetch;window.aborted=0;window.fetch=(url,options)=>{
   options?.signal?.addEventListener('abort',()=>window.aborted++);return original(url,options);
  };});
  await page.route('http://resources.test/**',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname==='/api/starting-soon'){
    requests++;if(hold)await new Promise(resolve=>release=resolve);
    return route.fulfill(fail?{status:503,body:'offline'}:{json:{...state,elapsed:requests}}).catch(()=>{});
   }
   const file=u.pathname==='/shared/visible-poll.js'?path.join(root,'lib/browser_effects/web/visible-poll.js'):u.pathname.startsWith('/starting-soon/art/')?path.join(root,'mini projects/starting_soon/art',path.basename(u.pathname)):path.join(app,u.pathname);
   return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':'text/html'});
  });
  await page.goto('http://resources.test/starting-soon/overlay.html');
  await page.waitForFunction(()=>document.querySelector('.background.visible')&&document.body.classList.contains('playing'));
  const geometry=await page.locator('.opening').boundingBox();
  const session=await page.context().newCDPSession(page);await session.send('Performance.enable');
  const layouts=async()=>Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value])).LayoutCount;
  await page.evaluate(()=>{window.mutations=0;new MutationObserver(rows=>window.mutations+=rows.length).observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});});
  const before=await layouts(),start=requests;await page.waitForTimeout(3100);
  const idle={requests:requests-start,mutations:await page.evaluate(()=>mutations),layouts:(await layouts())-before};
  assert(idle.requests>=3);assert.equal(idle.mutations,0,'unchanged display must not rewrite DOM');assert.equal(idle.layouts,0,'status-only ticks must not force layout');
  await page.evaluate(()=>dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:false}})));
  assert.equal(await page.locator('.background.visible').evaluate(e=>e.getAnimations()[0].playState),'paused');
  const hiddenRequests=requests;
  state.title='A changed title';state.clip_box=[770,450,900,506.25];
  await page.waitForTimeout(1600);
  assert.equal(requests,hiddenRequests,'hidden artwork must not request full editor state');
  assert.equal(await page.locator('#title').textContent(),'STREAM STARTING SOON');
  await page.evaluate(()=>dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:true}})));
  await page.waitForFunction(()=>document.querySelector('#title').textContent==='A changed title');
  assert.notDeepEqual(await page.locator('.opening').boundingBox(),geometry);
  assert.equal(await page.locator('.background.visible').evaluate(e=>e.getAnimations()[0].playState),'running');
  fail=true;await page.waitForFunction(()=>!document.body.classList.contains('playing'),null,{timeout:5500});
  fail=false;await page.waitForFunction(()=>document.body.classList.contains('playing'));
  hold=true;while(!release)await page.waitForTimeout(50);
  await page.evaluate(()=>dispatchEvent(new Event('pagehide')));release();hold=false;
  await page.waitForFunction(()=>aborted===1);const closed=requests;await page.waitForTimeout(1600);
  assert.equal(requests,closed);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,idle,offScenePaused:true,edits:true,recovery:true,teardown:true}));
 }finally{release?.();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
