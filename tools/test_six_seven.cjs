// Offline browser proof: local event delivery, safe compact copy and cleanup.
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../hub_ui/app');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:340,height:300},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://finder.test/**',r=>{const pathname=new URL(r.request().url()).pathname;if(pathname==='/')return r.fulfill({body:'<!doctype html><link rel="stylesheet" href="/chat/overlay.css"><body data-theme="glass" style="--text-alpha:1;--font-size:18px"><div id="messages"></div></body>',contentType:'text/html'});const file=path.join(root,pathname);return r.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.css')?'text/css':'application/javascript'});});
  await page.goto('http://finder.test/');
  // A dedicated fixture uses the actual stylesheet and notice module, without
  // loading the Twitch overlay entry point or any live network service.
  const result=await page.evaluate(async()=>{
   const {watchGameNotices,renderNotice}=await import('/chat/game_notices.js');
   const streams=[];window.EventSource=class{constructor(url){this.url=url;streams.push(this);}close(){this.closed=true;}};
   const list=document.querySelector('#messages');let trimmed=0;
   const stop=watchGameNotices(n=>renderNotice(list,n,()=>trimmed++));
   const base={id:'one',kind:'six-seven',title:'🔎 6–7 found!',lines:['⚔️ Jinx · 6 kills / 7 deaths','🌾 Ahri · 67 CS','🏟️ Team score · Blue 6 · Red 7'],created_at:Date.now()/1000};
   const emit=n=>streams.at(-1).onmessage({data:JSON.stringify({type:'hub_event',payload:{event:'chat.overlay.notice',data:n}})});
   emit(base);emit(base);emit({...base,id:'old',created_at:base.created_at-20});emit({...base,id:'bad',lines:[42]});
   const count=list.children.length;
   emit({...base,id:'html',lines:['<img src=x onerror=alert(1)> · 67 CS']});
   const safe=list.lastElementChild.querySelector('img')===null&&list.lastElementChild.textContent.includes('<img');list.lastElementChild.remove();
   Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
   const hiddenClosed=streams[0].closed;emit({...base,id:'hidden'});
   Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));
   emit(base);const resumedCount=list.children.length;
   stop();emit({...base,id:'stopped'});
   const closed=streams.every(s=>s.closed);const streamsBeforePreview=streams.length;watchGameNotices(()=>{throw Error('preview delivery');},{preview:true})();
   return {count,safe,hiddenClosed,resumedCount,closed,previewQuiet:streamsBeforePreview===streams.length,trimmed,finalCount:list.children.length,url:streams[0].url};
  });
  assert.deepEqual(result,{count:1,safe:true,hiddenClosed:true,resumedCount:1,closed:true,previewQuiet:true,trimmed:2,finalCount:1,url:'/api/events?events=hub_event'});
  assert(await page.locator('.message').evaluate(el=>el.scrollWidth<=el.clientWidth),'card must not overflow');
  assert.equal(await page.locator('.discovery-line').count(),3);
  await page.waitForTimeout(200);
  const output=path.resolve(__dirname,'../tmp_obs_debug/six-seven-chat.png');fs.mkdirSync(path.dirname(output),{recursive:true});await page.screenshot({path:output});
  await page.evaluate(()=>document.body.dataset.theme='minimal');
  assert.equal(await page.locator('.game-notice .name').evaluate(el=>getComputedStyle(el).display),'block');
  assert.deepEqual(errors,[]);console.log('PASS: exact notice UI, duplicate/expiry rejection, safe text, compact layout, hidden/preview/disposal cleanup.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
