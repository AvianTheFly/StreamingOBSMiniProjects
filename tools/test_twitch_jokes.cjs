// Browser fixture only: real overlay renderer with fake settings and no Twitch writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:620,height:640}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('http://joke.test/**',route=>{
   const pathname=new URL(route.request().url()).pathname;
   if(pathname==='/api/chat/settings')return route.fulfill({json:{channel:'owner',theme:'glass',font_size:20,font:'Segoe UI',accent:'#76e4cf',opacity:38,text_opacity:80,hover_opacity:94,fade_seconds:0,fade_hold_seconds:0,max_messages:10,motion:true,hide_bots:false,hidden_users:[],badges:true,replacements:{hello:'https://example.invalid/image.gif'},natural_stickers:true}});
   if(pathname.startsWith('/api/'))return route.fulfill({json:{emotes:{},badges:{},pack:{aliases:{}}}});
   const file=pathname==='/shared/visible-poll.js'?'lib/browser_effects/web/visible-poll.js':'hub_ui/app'+pathname;
   if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('http://joke.test/chat/overlay.html?preview=1');
  await page.waitForFunction(()=>document.querySelector('#channel').textContent==='OWNER');
  await page.evaluate(async()=>{
   const {render}=await import('/chat/overlay.js');document.querySelector('#messages').replaceChildren();
   render({prefix:'viewer!test',id:'viewer',text:'That play was actually clean.',tags:{'display-name':'Viewer'}});
   render({prefix:'owner!test',id:'reminder',text:'[COMMAND GUIDE] !opgg · !build',tags:{'display-name':'Owner'}});
   render({prefix:'owner!test',id:'joke',text:'🃏 My team treats the minimap like the terms and conditions. hello',tags:{'display-name':'Owner'}});
   render({prefix:'viewer!test',id:'lookalike',text:'🃏 A viewer using the same emoji',tags:{'display-name':'Viewer'}});
  });
  assert.equal(await page.locator('.chat-joke').count(),1);
  assert.equal(await page.locator('.chat-joke img').count(),0);
  assert.equal(await page.locator('[data-id=reminder].chat-joke').count(),0);
  const opacity=await page.evaluate(()=>Object.fromEntries(['viewer','joke','reminder'].map(id=>[id,Number(getComputedStyle(document.querySelector(`[data-id=${id}] .body`)).opacity)])));
  assert(opacity.joke<opacity.viewer*.6);
  assert.equal(await page.locator('[data-id=reminder].command-guide').count(),1);
  assert.match(await page.locator('[data-id=reminder] .name').innerText(),/⌨ COMMAND GUIDE/);
  assert.equal(await page.locator('.chat-joke').evaluate(row=>getComputedStyle(row).animationName),'none');
  await page.screenshot({path:'output/twitch-jokes-overlay.png'});
  // Existing row aging remains in control of expiry.
  await page.evaluate(async()=>{const {ageMessages}=await import('/chat/message_lifetime.js');const row=document.querySelector('.chat-joke');row.dataset.time=Date.now()-3000;ageMessages(document.querySelector('#messages'),1);});
  assert.equal(await page.locator('.chat-joke').count(),0);
  // Private panel uses text nodes, saves only the setting, and creates no timer.
  await page.evaluate(async()=>{
   const {jokePanel}=await import('/js/pages/twitch-jokes.js');
   window.writes=[];const update=jokePanel(document.body,async(path,body)=>{writes.push({path,body});return {...window.fixture,enabled:body.enabled,revision:'two'};});
   window.fixture={enabled:true,revision:'one',count:2,message:'Waiting for OBS to stream',next_in_seconds:null,catalog:[{text:'<img src=x onerror=alert(1)>'},{text:'Another joke'}]};update(window.fixture);
  });
  assert.equal(await page.locator('#tjList img').count(),0);
  await page.locator('#tjEnabled').uncheck();
  const writes=await page.evaluate(()=>window.writes);
  assert.deepEqual(writes,[{path:'/api/twitch-commands/jokes',body:{revision:'one',enabled:false}}]);
  assert.deepEqual(errors,[]);
  console.log('Joke overlay: broadcaster-only marker, softer text, literal content, no arrival animation, preserved expiry; private panel toggle passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
