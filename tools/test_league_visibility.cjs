// Observe renderer calls and deadlines through the real presentation lifetimes.
// Art rendering itself has separate real-image Chromium regressions.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../mini projects/league_api/production/web');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://visibility.test/**',route=>{
   const p=new URL(route.request().url()).pathname;
   if(p==='/')return route.fulfill({contentType:'text/html',body:'<div id="stage"></div><script type="module">import "/overlay.js";import "/match-screens.js";</script>'});
   if(p.startsWith('/match-art/'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="red"/></svg>'});
   if(p==='/scene.js')return route.fulfill({contentType:'text/javascript',body:'window.calls={draws:0,clears:0};export class ProductionScene{constructor(){this.ready=Promise.resolve();}draw(s){calls.draws++;calls.last=s;}clear(){calls.clears++;}}'});
   return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,path.basename(p)))});
  });
  await page.goto('http://visibility.test/');await page.waitForFunction(()=>window.leagueMatchScreens);
  await page.evaluate(()=>{for(let i=0;i<10;i++)leagueMatchScreens.update(null);});
  await page.waitForTimeout(250);assert.deepEqual(await page.evaluate(()=>calls),{draws:0,clears:0});
  await page.evaluate(()=>leagueProduction.update({enabled:true,ambient:{theme:'hextech',elapsed:2}}));
  await page.waitForFunction(()=>calls.draws>2);
  await page.evaluate(()=>dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:false}})));
  const hiddenStart=await page.evaluate(()=>calls.draws);
  await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>calls.draws),hiddenStart);
  await page.evaluate(()=>{leagueProduction.update(null);leagueMatchScreens.update({key:'victory',elapsed:0,remaining:3,duration:3},{enabled:true});});
  await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>calls.draws),hiddenStart);
  await page.evaluate(()=>dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:true}})));
  await page.waitForFunction(n=>calls.draws>n,hiddenStart);
  assert.equal(await page.locator('#match-screen').evaluate(e=>e.style.display),'block');
  await page.evaluate(()=>{dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:false}}));leagueMatchScreens.update({key:'victory',elapsed:0,remaining:.15,duration:.15},{});});
  const expiredStart=await page.evaluate(()=>calls.draws);await page.waitForTimeout(250);
  await page.evaluate(()=>dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:true}})));
  assert.equal(await page.locator('#match-screen').evaluate(e=>e.style.display),'none');
  assert.equal(await page.evaluate(()=>calls.draws),expiredStart);
  assert.equal(await page.evaluate(()=>leagueMatchScreens.ownsPresentation()),false);
  assert.deepEqual(errors,[]);console.log('League visibility: zero idle clears, zero hidden draws, current-state resume and expired result rejection passed');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
