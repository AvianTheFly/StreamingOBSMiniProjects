// Offline chat readability: busy conversations retain whole, non-overlapping cards.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {draftFixture,root}=require('./champ_select_fixture.cjs');
const output=path.join(root,'output/champ-select-chat-20261014');
const state={visible:true,theme:'bear',generation:1,draft:{},chat:[]};
const aliases=['Gromp','Krugs','Murk Wolf','YOU'];
const busy=Array.from({length:10},(_,i)=>({id:String(i),sender:aliases[i%4],body:[
  'I can cover top after the first clear.',
  'Save the last pick for support?',
  'We have plenty of engage. I’ll bring exhaust and play around bot lane.',
  'Ready when you are!'][i%4]}));
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await draftFixture(page,state);await page.goto('http://draft.test/champ-select');
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('.empty-chat').waitFor();
  const show=async messages=>{
    state.chat=messages;
    await page.waitForFunction(body=>document.querySelector('.message:last-child')?.textContent.includes(body),messages.at(-1).body);
  };
  const geometry=async()=>page.evaluate(()=>{
    const box=document.querySelector('#chat-messages'),b=box.getBoundingClientRect(),s=getComputedStyle(box);
    const cards=[...box.querySelectorAll('.message')].map(card=>{
      const r=card.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,text:card.textContent};
    });
    return {cards,top:b.top+parseFloat(s.paddingTop),bottom:b.bottom-parseFloat(s.paddingBottom),left:b.left,right:b.right,
      font:parseFloat(getComputedStyle(box.querySelector('.message')).fontSize)};
  });
  const fits=async()=>{
    const g=await geometry();assert.ok(g.cards.length>0&&g.cards.length<=10);
    for(let i=0;i<g.cards.length;i++){
      const c=g.cards[i];assert.ok(c.top>=g.top-.6&&c.bottom<=g.bottom+.6,JSON.stringify(g));
      assert.ok(c.left>=g.left&&c.right<=g.right);
      if(i)assert.ok(c.top>=g.cards[i-1].bottom+1,'messages must have a clear gap');
    }
    return g;
  };
  await show(busy);
  for(const theme of ['bear','turtle','ram','phoenix']){
    state.theme=theme;await page.waitForFunction(t=>document.querySelector('#stage').dataset.theme===t,theme);
    for(const [width,height] of [[1920,1080],[1280,720],[880,495],[960,720]]){
      await page.setViewportSize({width,height});
      await page.waitForTimeout(80);const g=await fits();
      assert.ok(g.cards.at(-1).text.endsWith(busy.at(-1).body));
      assert.ok(g.cards.length<10,'busy chat should retire old messages');
      if(width===1920){assert.ok(g.font>=22);await page.screenshot({path:path.join(output,`${theme}.png`)});}
    }
  }
  await page.setViewportSize({width:1920,height:1080});
  await show([{id:'unknown',sender:'TEAM',body:'<img src=x onerror=alert(1)> No repeated label.'}]);
  assert.equal(await page.locator('.sender').count(),0);assert.equal(await page.locator('.message img').count(),0);await fits();
  await show([{id:'long',sender:'Krugs',body:'A very long strategy message with a link https://example.test/'+('abcdefgh'.repeat(50))}]);
  await fits();assert.ok((await page.locator('.message').getAttribute('title')).length>450);
  await page.locator('.chat').screenshot({path:path.join(output,'long-message.png')});
  // Late sender evidence updates an unchanged message; raw content remains plain text.
  state.chat=[{id:'long',sender:'Gromp',body:state.chat[0].body}];
  await page.waitForFunction(()=>document.querySelector('.sender')?.textContent==='Gromp:');
  const retained=await page.locator('.message').evaluate(e=>{e.dataset.retained='yes';return e.textContent;});
  await page.waitForTimeout(650);assert.equal(await page.locator('.message').getAttribute('data-retained'),'yes');
  assert.equal(await page.locator('.message').textContent(),retained);
  // Resize reconsiders the full bounded snapshot, so older messages return if they fit.
  await show(Array.from({length:10},(_,i)=>({id:'short'+i,sender:aliases[i%4],body:'Message '+i})));
  await page.setViewportSize({width:1920,height:540});await page.waitForTimeout(80);const small=(await fits()).cards.length;
  await page.setViewportSize({width:1920,height:1080});await page.waitForTimeout(80);assert.ok((await fits()).cards.length>small);
  state.chat=[];await page.locator('.empty-chat').waitFor();
  await page.goto('about:blank');assert.deepEqual(errors,[]);
  console.log('Champion-select chat: busy/long/unknown senders, plain text, responsive fit, stable polling and four themes passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
