// Real browser animation lifetime and optional-layer regressions, isolated from OBS.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),app=path.join(root,'hub_ui/app');
const out=process.env.STARTING_SOON_OUTPUT_DIR||'C:/Users/Michael/.codex/artifacts/starting-soon-production-20261003/motion';
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:'chrome'});
 const state={title:'STREAM STARTING SOON',subtitle:'The next adventure awaits.',artwork:['stormglass.png','drowned-cathedral.png','cinder-express.png'],artwork_index:0,highlights_enabled:true,active:true,playing:true,clip_title:'A favorite moment',clip_box:[690,320,1144,643.5]};
 state.available_artwork=[...state.artwork,'fjord.png','forest.png','mountain.png'];
 const errors=[];let blocked=null;
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://motion.test/**',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname==='/api/starting-soon')return route.fulfill({json:state});
   if(u.pathname==='/deck-test.html')return route.fulfill({contentType:'text/html',body:'<div id="a"></div><div id="b"></div>'});
   if(u.searchParams.has('hold'))return;
   if(u.pathname.endsWith('/mountain.png')&&blocked)await blocked;
   const file=u.pathname.startsWith('/starting-soon/art/')?path.join(root,'mini projects/starting_soon/art',path.basename(u.pathname)):path.join(app,u.pathname);
   return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':'text/html'});
  });
  await page.goto('http://motion.test/starting-soon/overlay.html?demo=1');
  await page.waitForFunction(()=>document.querySelector('.background.visible')?.style.backgroundImage&&document.body.classList.contains('demo'));
  const clipBefore=await page.locator('.opening').boundingBox();
  for(const [i,style] of ['dissolve','portal','gates','embers'].entries()){
   await page.evaluate(({style,art})=>postMessage({startingSoonPreview:{transition_style:style,motion:'drift',art}},location.origin),{style,art:state.artwork[(i+1)%3]});
   await page.waitForFunction(()=>[...document.querySelectorAll('.background.visible')].some(e=>e.getAnimations().some(a=>a.effect.getTiming().duration===1800)),null,{timeout:5000}).catch(async e=>{console.log(await page.evaluate(()=>({reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,bgs:[...document.querySelectorAll('.background')].map(e=>({image:e.style.backgroundImage,motion:e.dataset.motion,visible:e.className,animations:e.getAnimations().map(a=>a.effect.getTiming())}))})));throw e;});
   await page.waitForTimeout(650);await page.screenshot({path:path.join(out,style+'.png')});
   assert.deepEqual(await page.locator('.opening').boundingBox(),clipBefore,'scenery motion must leave the native clip window fixed');
   await page.waitForTimeout(1300);
   assert.equal(await page.locator('.background.visible').count(),1,'only two bounded layers with one visible after cleanup');
  }
  state.highlights_enabled=false;await page.evaluate(()=>postMessage({startingSoonPreview:{reset:true}},location.origin));
  await page.waitForFunction(()=>!document.body.classList.contains('playing'));
  await page.goto('http://motion.test/starting-soon/overlay.html?layer=frame');
  assert.equal(await page.locator('html').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
  for(const selector of ['header','footer','.shade','.background'])assert.equal(await page.locator(selector).first().isVisible(),false);
  state.highlights_enabled=true;await page.waitForFunction(()=>document.body.classList.contains('playing'));
  await page.screenshot({path:path.join(out,'frame-only.png'),omitBackground:true});
  await page.goto('http://motion.test/deck-test.html');
  await page.evaluate(async()=>{const {WorldDeck}=await import('/starting-soon/world-deck.js');window.deck=new WorldDeck([document.querySelector('#a'),document.querySelector('#b')]);await deck.show('fjord.png');});
  let release;blocked=new Promise(resolve=>release=resolve);
  await page.evaluate(()=>{window.pending=deck.show('mountain.png');});
  await page.waitForFunction(()=>deck.pending==='mountain.png');
  await page.evaluate(()=>deck.show('fjord.png'));release();blocked=null;
  await page.evaluate(()=>pending);assert.equal(await page.evaluate(()=>deck.shown),'fjord.png','latest intent cancels a stale decode even when choosing the existing painting');
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>deck.show('forest.png',{style:'portal',motion:'drift'}));
  assert.equal(await page.evaluate(()=>deck.animations.length),0,'reduced motion skips the reveal');
  await page.evaluate(()=>deck.dispose());await page.evaluate(()=>deck.show('mountain.png'));assert.equal(await page.evaluate(()=>deck.shown),'forest.png','disposed deck rejects further work');
  assert.deepEqual(errors,[]);console.log('Four artwork reveals, fixed clip geometry, optional transparent frame, stale loads, reduced motion and bounded cleanup verified');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
