const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),feature=path.join(root,'mini projects/league_api');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try {
  const page=await browser.newPage(),errors=[];let requests=0;
  const state={visible:true,theme:'astral',draft:{seconds:25,allies:[{championId:103,name:'Ahri',locked:false}],localSlot:0},chat:[]};
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://draft.test/**',route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/champ-select/state'){requests++;return route.fulfill({json:state});}
   let file=url.pathname==='/shared/visible-poll.js'?path.join(root,'lib/browser_effects/web/visible-poll.js'):
    url.pathname.includes('/backgrounds/')?path.join(feature,'media/champ-select',path.basename(url.pathname)):
    path.join(feature,'champ_select_web',url.pathname==='/champ-select'?'index.html':url.pathname.replace('/champ-select/',''));
   return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.jpg')?'image/jpeg':file.endsWith('.svg')?'image/svg+xml':'text/html'});
  });
  await page.goto('http://draft.test/champ-select');await page.waitForFunction(()=>document.querySelector('.pick.tentative'));
  await page.evaluate(()=>dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:false}})));
  const hidden=requests;state.draft.seconds=12;state.draft.allies[0].locked=true;
  await page.waitForTimeout(1600);assert.equal(requests,hidden);assert.equal(await page.locator('#timer').textContent(),'25 SEC');
  await page.evaluate(()=>dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:true}})));
  await page.waitForFunction(()=>document.querySelector('.pick.locked')&&document.querySelector('#timer').textContent==='12 SEC');
  await page.evaluate(()=>dispatchEvent(new Event('pagehide')));const closed=requests;
  await page.waitForTimeout(800);assert.equal(requests,closed);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,hiddenRequests:0,latestDraftRestored:true,teardown:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
