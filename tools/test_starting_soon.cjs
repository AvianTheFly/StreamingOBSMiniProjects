// Isolated Chromium visual/state tests; no OBS or personal settings writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),web=path.join(root,'hub_ui/app'),out=process.env.STARTING_SOON_OUTPUT_DIR||path.join(root,'output/starting-soon');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const state={title:'STREAM STARTING SOON',subtitle:'Gather by the fire. The next adventure is almost here.',artwork:['fjord.png','forest.png','mountain.png'],available_artwork:['fjord.png','forest.png','mountain.png'],artwork_index:0,active:false,playing:false};
  state.available_artwork=fs.readdirSync(path.join(root,'mini projects/starting_soon/art')).filter(n=>n.endsWith('.png'));
  await page.route('http://starting.test/**',route=>{
   const p=new URL(route.request().url()).pathname;
   if(p==='/api/starting-soon')return route.fulfill({json:state});
   const file=p.startsWith('/starting-soon/art/')?path.join(root,'mini projects/starting_soon/art',path.basename(p)):path.join(web,p);
   return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':'text/html'});
  });
  for(const name of state.available_artwork){
   await page.goto('http://starting.test/starting-soon/overlay.html?demo=1&art='+name);
   await page.waitForFunction(()=>document.querySelector('.background.visible')?.style.backgroundImage);
   await page.waitForTimeout(2200);
   assert.equal(await page.locator('#clip-frame').evaluate(e=>getComputedStyle(e).opacity),'1');
   const box=await page.locator('.opening').boundingBox();assert.equal(box.x+10,690);assert.equal(box.y+10,320);assert.equal(box.width-20,1144);assert.equal(box.height-20,643.5);
   const header=await page.locator('header').boundingBox();assert(header.y+header.height<=279,'heading must not overlap clip header');
   await page.screenshot({path:path.join(out,`preview-${name}`)});
  }
  await page.goto('http://starting.test/starting-soon/overlay.html');await page.waitForTimeout(900);
  assert.equal(await page.locator('body.playing').count(),0);
  state.active=true;state.playing=true;state.clip_title='<personal title & text>';
  await page.waitForFunction(()=>document.body.classList.contains('playing'));
  assert.equal(await page.locator('#clip-title').textContent(),state.clip_title);
  state.artwork_index=1;await page.waitForFunction(()=>document.querySelector('#location').textContent==='THE SPIRIT GROVE');
  state.active=false;await page.waitForFunction(()=>!document.body.classList.contains('playing'));
  await page.setViewportSize({width:960,height:540});
  assert.equal(await page.locator('#stage').boundingBox().then(b=>b.width),960);
  assert.deepEqual(errors,[]);console.log('Starting Soon: seven backgrounds, exact 16:9 source placement, title safety, rotation, playback visibility, responsive scaling OK');
  const placements={left:[86,320,1144,643.5],cinema:[280,230,1360,765],corner:[1020,530,800,450],custom:[500,300,960,540]};
  await page.setViewportSize({width:1920,height:1080});
  state.active=true;state.playing=true;
  for(const [name,box] of Object.entries(placements)){
   state.clip_box=box;await page.waitForFunction(x=>parseFloat(document.querySelector('#clip-frame').style.left)===x,box[0]-10);
   const opening=await page.locator('.opening').boundingBox();assert.equal(opening.x+10,box[0]);assert.equal(opening.y+10,box[1]);assert.equal(opening.width-20,box[2]);assert.equal(opening.height-20,box[3]);
   await page.screenshot({path:path.join(out,'layout-'+name+'.png')});
  }
  state.clip_box=[690,320,1144,643.5];
  await page.setViewportSize({width:1920,height:1080});
  state.title='The adventures of the spirit warrior — gathering before the next great journey across the frozen mountains and misty forests';
  await page.waitForFunction(()=>document.querySelector('#title').textContent.includes('adventures'));
  await page.waitForTimeout(800);
  const longHeader=await page.locator('header').boundingBox();assert(longHeader.y+longHeader.height<=262,'custom heading must fit above clips');
  state.show_message=false;state.show_footer=false;
  await page.waitForFunction(()=>document.querySelector('header').hidden);
  assert.equal(await page.locator('footer').isVisible(),false);
  assert.equal(await page.locator('body.playing').count(),1,'hiding the message must preserve clip playback');
  state.show_message=true;state.show_footer=true;
  await page.waitForFunction(()=>!document.querySelector('header').hidden);
  assert.equal(await page.locator('#title').textContent(),state.title,'message wording survives visibility changes');
  await page.goto('http://starting.test/starting-soon/overlay.html?layer=artwork&art=lantern-tide.png');
  await page.waitForFunction(()=>document.querySelector('.background.visible')?.style.backgroundImage);
  for(const selector of ['header','footer','#clip-frame','.shade'])assert.equal(await page.locator(selector).isVisible(),false,selector+' excluded from clean art');
  await page.waitForTimeout(2200);await page.screenshot({path:path.join(out,'artwork-only.png')});
  state.title='STREAM STARTING SOON';
  await page.goto('http://starting.test/starting-soon/overlay.html?layer=message');
  await page.waitForFunction(()=>!document.querySelector('header').hidden);
  for(const selector of ['.background','.shade','#clip-frame','footer'])assert.equal(await page.locator(selector).first().isVisible(),false,selector+' excluded from transparent text');
  assert.equal(await page.locator('html').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
  await page.screenshot({path:path.join(out,'message-only.png'),omitBackground:true});
  state.show_message=false;await page.waitForFunction(()=>document.querySelector('header').hidden);
  await page.screenshot({path:path.join(out,'message-hidden.png'),omitBackground:true});
  state.show_message=true;
  console.log('Independent artwork/message layers, transparency and persistent message controls verified');
  // Optional actual-Hub check; ordinary visual regressions stay offline.
  if(process.env.STARTING_SOON_LIVE==='1'){
  const live=await browser.newPage({viewport:{width:1600,height:1100}});
  live.on('pageerror',e=>errors.push(e.message));
  await live.goto('http://127.0.0.1:7420/#projects/starting_soon');
  await live.locator('#ssArtTab').click();
  await live.locator('#ssArtGrid input').first().waitFor();
  assert.equal(await live.locator('#ssArtGrid input').count(),state.available_artwork.length);
  await live.locator('#ssClipsTab').click();
  await live.locator('#ssLibrary button').first().waitFor();
  await live.screenshot({path:path.join(out,'hub-controls.png'),fullPage:true});
  assert.deepEqual(errors,[]);console.log('Real Hub controls loaded with saved clips and seven artwork selectors');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
