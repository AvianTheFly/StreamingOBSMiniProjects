// Disposable browser fixture: hidden chat owns no pointer polling work.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 let release;
 try{
  const page=await browser.newPage(),errors=[];let requests=0,hold=false;
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('http://chat-resource.test/**',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api/chat/pointer'){
    requests++;if(hold)await new Promise(resolve=>release=resolve);
    return route.fulfill({json:{game:true,x:.5,y:.5}}).catch(()=>{});
   }
   if(url.pathname==='/')return route.fulfill({body:'<div id="messages"><article>A message</article></div>',contentType:'text/html'});
   const file=url.pathname==='/shared/visible-poll.js'?'lib/browser_effects/web/visible-poll.js':'hub_ui/app/chat/readability.js';
   return route.fulfill({body:fs.readFileSync(path.resolve(file)),contentType:'text/javascript'});
  });
  await page.goto('http://chat-resource.test/');
  await page.evaluate(async()=>{
   const {watchReadability}=await import('/readability.js');
   window.watch=watchReadability(document.querySelector('#messages'),()=>({focus_mode:'auto'}));
  });
  await page.waitForTimeout(700);assert(requests>=2);
  await page.evaluate(()=>dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:false}})));
  const hidden=requests;await page.waitForTimeout(700);assert.equal(requests,hidden);
  await page.evaluate(()=>dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:true}})));
  await page.waitForTimeout(350);assert(requests>hidden);
  hold=true;while(!release)await page.waitForTimeout(20);
  await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
  release();hold=false;const closed=requests;await page.waitForTimeout(400);assert.equal(requests,closed);
  await page.evaluate(()=>dispatchEvent(new Event('pageshow')));
  await page.waitForTimeout(350);assert(requests>closed);
  await page.evaluate(()=>watch.dispose());const disposed=requests;
  await page.waitForTimeout(400);assert.equal(requests,disposed);
  await page.evaluate(async()=>{
   const {watchReadability}=await import('/readability.js');
   window.preview=watchReadability(document.querySelector('#messages'),()=>({focus_mode:'game'}),{preview:true});
   dispatchEvent(new PointerEvent('pointermove',{clientX:5,clientY:5}));
  });
  await page.waitForTimeout(400);assert.equal(requests,disposed,'preview does not query OS pointer');
  await page.evaluate(()=>preview.dispose());assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,hiddenRequests:0,pageExitRequests:0,previewRequests:0,restores:true}));
 }finally{release?.();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
