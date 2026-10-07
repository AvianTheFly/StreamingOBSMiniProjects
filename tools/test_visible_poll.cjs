// Exercise the real browser lifecycle, including a transport ignoring cancellation.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try {
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://poll.test/**',r=>r.fulfill({body:r.request().url().endsWith('.js')?
   fs.readFileSync(path.join(__dirname,'../lib/browser_effects/web/visible-poll.js'),'utf8'):'<html></html>',contentType:r.request().url().endsWith('.js')?'text/javascript':'text/html'}));
  await page.goto('http://poll.test/');
  await page.evaluate(async()=>{
   const {pollVisible}=await import('/poll.js');
   window.requests=[];window.values=[];window.failures=0;window.states=[];
   window.fetch=(_url,{signal})=>new Promise(resolve=>requests.push({signal,resolve}));
   window.poller=pollVisible({url:'/state',interval:50,timeout:150,onData:x=>values.push(x),onError:()=>failures++,onVisibility:x=>states.push(x)});
   window.resolve=(i,value)=>requests[i].resolve({ok:true,json:async()=>value});
   window.visible=value=>dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:value}}));
  });
  await page.waitForFunction(()=>requests.length===1);
  await page.evaluate(()=>visible(false));
  assert(await page.evaluate(()=>requests[0].signal.aborted));
  await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>requests.length),1);
  await page.evaluate(()=>visible(true));await page.waitForFunction(()=>requests.length===2);
  await page.evaluate(()=>{resolve(1,'new');resolve(0,'stale');});
  await page.waitForFunction(()=>values.length===1);assert.deepEqual(await page.evaluate(()=>values),['new']);
  await page.waitForFunction(()=>requests.length===3);
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>requests.length),3);
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await page.waitForFunction(()=>requests.length===4);
  // A visible transport that obeys abort must report its deadline and retry.
  await page.evaluate(()=>{requests[3].signal.addEventListener('abort',()=>resolve(3,'timed-out'));});
  await page.waitForFunction(()=>requests[3].signal.aborted);
  await page.waitForFunction(()=>failures===1);
  await page.evaluate(()=>{poller.dispose();resolve(2,'old-page');resolve(3,'disposed');});
  const count=await page.evaluate(()=>requests.length);
  await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>requests.length),count);
  assert.deepEqual(await page.evaluate(()=>values),['new']);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,hiddenRequests:0,staleResponsesRejected:true,bfcache:true,disposedRequests:0}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
