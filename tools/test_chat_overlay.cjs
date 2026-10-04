// Browser-level verification: text safety, emote parsing, moderation, layout.
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../hub_ui/app');
const settings={channel:'udyrisabotlaner',theme:'glass',font:'Segoe UI',font_size:17,emote_size:34,opacity:32,max_messages:6,fade_seconds:60,accent:'#76e4cf',motion:true,badges:true,hide_bots:true,hidden_users:['nightbot'],replacements:{hooray:'/viewer_assets/botlaneBear-chat.png'},show_header:false};
const fixtureEmotes={Party:{url:'https://cdn.test/party.gif',provider:'7TV'},Hat:{url:'https://cdn.test/hat.gif',provider:'7TV',zero_width:true}};
for(let i=0;i<100;i++)fixtureEmotes['Rave'+i]={url:`https://cdn.test/rave${i}.gif`,static_url:`https://cdn.test/still${i}.gif`,animated:true,category:'Rave / EDM',provider:'7TV · Chaos pack'};
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:1440,height:1200}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://chat.test/**',route=>{const url=new URL(route.request().url());if(url.pathname==='/api/chat/settings')return route.fulfill({json:settings});if(url.pathname==='/api/chat/catalog')return route.fulfill({json:{emotes:fixtureEmotes,badges:{},providers:{}}});let relative=url.pathname==='/chat/'?'/chat/index.html':url.pathname;const file=url.pathname.startsWith('/viewer_assets/')?path.join(root,'../',relative):path.join(root,relative);if(!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404});return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});});
 // Keep images valid and deterministic without external network dependencies.
 await page.route('https://cdn.test/**',r=>r.request().url().includes('/still')?r.fulfill({status:404}):r.fulfill({body:Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64'),contentType:'image/gif'}));
 let ws;await page.routeWebSocket('wss://irc-ws.chat.twitch.tv/**',socket=>{ws=socket;socket.onMessage(message=>{if(message.includes('JOIN'))socket.send('@room-id=53924461 :tmi.twitch.tv ROOMSTATE #udyrisabotlaner\r\n');});});
 await page.goto('http://chat.test/chat/overlay.html');await page.waitForFunction(()=>document.querySelector('#connection').textContent==='LIVE');
 const emit=(id,user,text,tags='')=>ws.send(`@id=${id};user-id=42;display-name=${user};color=#220000;${tags} :${user.toLowerCase()}!user PRIVMSG #udyrisabotlaner :${text}\r\n`);
 await page.waitForTimeout(200);emit('a','Tester','<img src=x onerror=alert(1)> hooray Party Hat');
 await page.waitForSelector('.message');assert.equal(await page.locator('.body').textContent(),'<img src=x onerror=alert(1)>   ');assert.equal(await page.locator('.body img').count(),3);assert.equal(await page.locator('.zero').count(),1);assert.equal(await page.locator('.body img[onerror]').count(),0);
 emit('b','Nightbot','hidden');await page.waitForTimeout(50);assert.equal(await page.locator('.message').count(),1);
 ws.send('@target-msg-id=a :tmi.twitch.tv CLEARMSG #udyrisabotlaner :gone\r\n');await page.waitForFunction(()=>!document.querySelector('.message'));
 emit('c','Tester','😀 Kappa','emotes=25:2-6');await page.waitForSelector('.message');assert.equal(await page.locator('.body img').getAttribute('alt'),'Kappa');
 ws.send('@target-user-id=42 :tmi.twitch.tv CLEARCHAT #udyrisabotlaner :tester\r\n');await page.waitForFunction(()=>!document.querySelector('.message'));
 for(let i=0;i<20;i++)emit('m'+i,'Tester','message '+i);await page.waitForTimeout(100);assert.equal(await page.locator('.message').count(),6);
 const readability=await page.evaluate(async()=>{
  const {applyReadability}=await import('/chat/readability.js');
  const list=document.querySelector('#messages'),row=list.lastElementChild,body=row.querySelector('.body');
  body.style.transition='none';
  const rect=row.getBoundingClientRect(),settings={focus_mode:'game'};
  const metrics=()=>({ink:Number(getComputedStyle(body).opacity),background:getComputedStyle(row).background,rect:JSON.stringify(row.getBoundingClientRect())});
  applyReadability(list,settings,{game:true,x:null,y:null});const resting=metrics();
  applyReadability(list,settings,{game:true,x:(rect.left+rect.width/2)/innerWidth,y:(rect.top+rect.height/2)/innerHeight});const hover=metrics();
  applyReadability(list,{focus_mode:'auto'},{game:false,x:null,y:null});const desktop=metrics();
  applyReadability(list,settings,{game:true,x:null,y:null});
  return {resting,hover,desktop};
 });
 assert(readability.hover.ink>readability.resting.ink&&readability.hover.ink<1);
 assert.equal(readability.desktop.ink,1);
 assert.equal(readability.hover.background,readability.resting.background,'hover must not darken cards');
 assert.equal(readability.desktop.background,readability.resting.background,'desktop clarity affects content only');
 assert.equal(readability.hover.rect,readability.resting.rect,'hover must not grow or move cards');
 const phraseTests=await page.evaluate(async()=>{
  const {fragments}=await import('/chat/protocol.js');
  const aliases={gg:'https://cdn.test/gg.gif','gg wp':'https://cdn.test/wp.gif',cook:'https://cdn.test/cook.gif','let him cook':'https://cdn.test/chef.gif',copium:'https://cdn.test/cope.gif'};
  const native={Hat:{url:'https://cdn.test/hat.gif',zero_width:true,provider:'7TV'}};
  return {
   longest:fragments('GG WP! (Let him cook.)',{},native,aliases),
   safe:fragments('cooking @cook !cook #cook https://x.test/cook www.cook.test',{},native,aliases),
   limited:fragments('cook COPIUM cook',{},native,aliases,{limit:2}),
   exact:fragments('COOK cook! cook',{},native,aliases,{natural:false}),
   twitch:fragments('cook Kappa COPIUM',{emotes:'25:5-9'},native,aliases),
   zero:fragments('Hat',{},native,aliases)
  };
 });
 assert.deepEqual(phraseTests.longest.filter(p=>p.url).map(p=>p.url),['https://cdn.test/wp.gif','https://cdn.test/chef.gif']);
 assert.equal(phraseTests.longest.filter(p=>'text' in p).map(p=>p.text).join(''),'! (.)');
 assert.equal(phraseTests.safe.filter(p=>p.url).length,0,'links, commands, mentions and substrings stay text');
 assert.equal(phraseTests.limited.filter(p=>p.url).length,2);assert.equal(phraseTests.limited.at(-1).text,'cook');
 assert.equal(phraseTests.exact.filter(p=>p.url).length,1);
 assert.equal(phraseTests.twitch.find(p=>p.alt==='Kappa').url,'https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/2.0');
 assert.equal(phraseTests.zero[0].zero_width,true);
 const protocol=await page.evaluate(async()=>{const p=await import('/chat/protocol.js');return {tags:p.parseLine('@display-name=A\\sB;id=x :a!b PRIVMSG #x :hi').tags,parts:p.fragments('hi',{gifs:'0-1|id|https://cdn.test/a.gif'},{},{})};});assert.equal(protocol.tags['display-name'],'A B');assert.equal(protocol.parts[0].url,'https://cdn.test/a.gif');
 await page.setViewportSize({width:339,height:467});await page.screenshot({path:path.resolve(__dirname,'../tmp_obs_debug/chat-overlay-test.png'),omitBackground:true});
 await page.setViewportSize({width:1440,height:1200});await page.goto('http://chat.test/chat/');await page.waitForSelector('output');await page.frameLocator('iframe').locator('.message').first().waitFor();
 await page.locator('[name=text_opacity]').fill('80');await page.locator('[name=text_opacity]').dispatchEvent('input');
 await page.waitForTimeout(3300);
 assert.equal(await page.frameLocator('iframe').locator('html').evaluate(el=>el.style.getPropertyValue('--text-alpha')),'0.8','saved-settings polling cannot overwrite unsaved preview edits');
 await page.locator('.sticker-library summary').click();await page.locator('#test-message').fill('hooray');await page.locator('#test-sticker').click();
 await page.frameLocator('iframe').locator('.message .name').filter({hasText:'Sticker test'}).waitFor();
 assert.equal(await page.frameLocator('iframe').locator('.message .body img').count(),1);
 await page.locator('#sticker-category').selectOption('Rave / EDM');
 assert.equal(await page.locator('.sticker-entry').count(),60);
 await page.locator('.sticker-entry').first().hover();
 await page.waitForTimeout(200);
 const active=await page.locator('#sticker-list').evaluate(el=>[...el.querySelectorAll('img')].filter(img=>img.getAttribute('src')===img.dataset.animation).length);
 assert(active>0&&active<10,'only visible rows animate in the large library');
 assert(await page.locator('#sticker-list').evaluate(el=>[...el.querySelectorAll('img')].filter(img=>img.dataset.visible==='true').every(img=>img.complete&&img.naturalWidth>0)),'visible animations render even when provider static thumbnails are unavailable');
 assert.equal(await page.frameLocator('iframe').locator('.body img').getAttribute('alt'),'Rave0','hover updates preview without a click');
 await page.locator('.sticker-library summary').click();await page.waitForTimeout(100);
 assert.equal(await page.locator('#sticker-list').evaluate(el=>[...el.querySelectorAll('img')].filter(img=>img.getAttribute('src')===img.dataset.animation).length),0,'closing the library pauses every animated thumbnail');
 await page.waitForTimeout(400);await page.screenshot({path:path.resolve(__dirname,'../tmp_obs_debug/chat-studio-preview.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile must not overflow');
 assert.deepEqual(errors,[]);console.log('PASS: escaped text, native Unicode emotes, stickers, 7TV layering, bot filters, deletion/ban events, message bounds, compact/mobile layout, clean browser console.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
