// Finite offline artwork audit. No live commands, client requests or settings writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname,'..'), feature = path.join(root,'mini projects/league_api');
const output = path.join(root,'output/champ-select-spirits/alignment');
const roles = ['TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY'];
const expectedRoles = ['TOP','JUNGLE','MID','BOT','SUPPORT'];
// Independent specification: five shrines stand on each generated terrace.
const landmarks=Object.fromEntries(['bear','turtle','ram','phoenix'].map(theme=>[theme,{picks:Array.from({length:5},(_,i)=>[100+i*142,585]),bans:Array.from({length:5},(_,i)=>[138+i*120,314])}]));
const rightLandmarks=Object.fromEntries(['bear','turtle','ram','phoenix'].map(theme=>[theme,{picks:Array.from({length:5},(_,i)=>[1252+i*142,585]),bans:Array.from({length:5},(_,i)=>[1302+i*120,314])}]));
const sample = (id,name,role,index) => ({championId:id,name,role,label:index===4?'A very long player alias that must never hide SUPPORT':`Player ${index+1}`,
  locked:index!==2,image:`/champ-select/icons/${id}.png`,portrait:`/champ-select/portraits/${id}.jpg`});
const state = {visible:true,theme:'bear',chat:[],draft:{localSlot:1,seconds:21,
  allies:roles.map((r,i)=>sample([266,64,103,22,412][i],['Aatrox','Lee Sin','Ahri','Ashe','Thresh'][i],r,i)),
  enemies:roles.map((r,i)=>sample([157,107,84,51,43][i],['Yasuo','Rengar','Akali','Caitlyn','Karma'][i],r,i)),
  allyBans:roles.map((r,i)=>sample([238,555,777,119,412][i],'Ban',r,i)),
  enemyBans:roles.map((r,i)=>sample([234,107,121,81,11][i],'Ban',r,i))}};
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser = await chromium.launch({headless:true,channel:'chrome'});
 try {
  const page = await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(url=>url.hostname!=='draft.test',route=>route.abort());
  await page.route('http://draft.test/**',route=>{
   const url = new URL(route.request().url()), name = path.basename(url.pathname);
   if(url.pathname==='/champ-select/state') return route.fulfill({json:state});
   const file = url.pathname.startsWith('/shared/')?path.join(root,'lib/browser_effects/web',path.basename(url.pathname)):
    url.pathname.includes('/vfx/')?path.join(feature,'media/champ-select/vfx',path.basename(url.pathname)):
    url.pathname.includes('/guests/')?path.join(feature,'media/draft-guests',path.basename(url.pathname)):
    url.pathname.includes('/backgrounds/')?path.join(feature,'media/champ-select',name):
    url.pathname.includes('/icons/')?path.join(feature,'media/champions',name):
    url.pathname.includes('/portraits/')?path.join(feature,'media/champion-portraits',name):
    path.join(feature,'champ_select_web',url.pathname==='/champ-select'?'index.html':url.pathname.replace('/champ-select/',''));
   return route.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.jpg')?'image/jpeg':'text/html'});
  });
  await page.goto('http://draft.test/champ-select');
  await page.waitForFunction(()=>document.querySelectorAll('.pick.filled').length===10);
  await page.evaluate(()=>document.fonts.ready);
  // Supply a dark camera placeholder for audit screenshots; production stays transparent.
  await page.evaluate(()=>document.querySelector('#stage').classList.add('demo'));
  const results=[];
  for(const theme of Object.keys(landmarks).filter(theme=>theme!=='verdant')) {
   state.theme=theme;
   await page.waitForFunction(theme=>document.querySelector('#stage').dataset.theme===theme,theme);
   for(const [width,height] of [[1920,1080],[880,495],[1280,720],[960,720]]) {
    await page.setViewportSize({width,height});
    const overlaps=await page.evaluate(()=>{const rect=e=>e.getBoundingClientRect();return [...document.querySelectorAll('.topline span')].some((h,i)=>{const r=rect(h),b=rect(document.querySelectorAll('.bans')[i].firstElementChild);return r.bottom>b.top;});});
    assert.equal(overlaps,false,'team banners must not cover ban icons');
    const geometry = await page.locator('.pick,.ban').evaluateAll(items=>items.map(item=>{
     const b=item.getBoundingClientRect(),role=item.querySelector('.role-label');
     let roleWidth=0;if(role){const range=document.createRange();range.selectNodeContents(role);roleWidth=range.getBoundingClientRect().width;}
     return {x:(b.x+b.width/2)/innerWidth*1920,y:(b.y+b.height/2)/innerHeight*1080,
      width:b.width,height:b.height,clip:getComputedStyle(item).clipPath,transform:getComputedStyle(item).transform,
      role:role?.textContent,roleWidth,roleSpace:role?.clientWidth};
    }));
    const check = (actual,expected) => {
     assert.ok(Math.abs(actual.x-expected[0])<2 && Math.abs(actual.y-expected[1])<2,`${theme} ${width} anchor ${JSON.stringify(actual)} vs ${expected}`);
     assert.notEqual(actual.clip,'none');assert.equal(actual.transform,'none');
    };
    // DOM order: left bans, right bans, left picks, right picks.
    landmarks[theme].bans.forEach((p,i)=>check(geometry[i],p));
    landmarks[theme].picks.forEach((p,i)=>check(geometry[10+i],p));
    rightLandmarks[theme].bans.forEach((p,i)=>check(geometry[5+i],p));
    rightLandmarks[theme].picks.forEach((p,i)=>check(geometry[15+i],p));
    for(const [i,item] of geometry.slice(10).entries()) {
     assert.equal(item.role,expectedRoles[i%5]);assert.ok(item.roleWidth<=item.roleSpace+.5,`${theme} ${width} role clipped: ${JSON.stringify(item)}`);
    }
    if(width===1920 || width===880) {
     await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth));
     await page.screenshot({path:path.join(output,`${theme}-${width}.png`),omitBackground:true});
    }
    results.push({theme,width,height,anchors:true,roles:true});
   }
  }
  state.draft.allies[0].role='';
  await page.waitForFunction(()=>document.querySelector('#allies .role-label').textContent==='ROLE TBD');
  state.draft.allies[0].role='utility';
  state.draft.allies[0].locked=true;
  await page.waitForFunction(()=>document.querySelector('#allies .role-label').textContent==='SUPPORT');
  state.draft.allies[0]={championId:0,role:'MIDDLE',label:'Unpicked'};
  await page.waitForFunction(()=>document.querySelector('#allies .role-label').textContent==='MID'&&!document.querySelector('#allies .pick').querySelector('img'));
  // Even mid-reveal the aperture must remain stationary, including ban lock-ins.
  await page.emulateMedia({reducedMotion:'no-preference'});
  state.draft.allies[0]=sample(103,'Ahri','MIDDLE',0);
  state.draft.enemyBans[0]=sample(238,'Zed','',0);
  await page.waitForFunction(()=>document.querySelector('#allies .pick img')?.src.endsWith('/103.jpg'));
  assert.equal(await page.locator('#allies .pick').first().evaluate(el=>getComputedStyle(el).transform),'none');
  assert.equal(await page.locator('#enemy-bans .ban').first().evaluate(el=>getComputedStyle(el).transform),'none');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'audit.json'),JSON.stringify({passed:true,results,unknownRoles:true,unpickedRoles:true,stationaryReveals:true},null,2));
  console.log('All four active artworks: 16 responsive layouts, pick/ban anchors, full lane labels, unresolved/unpicked lanes and stationary lock-ins passed.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
