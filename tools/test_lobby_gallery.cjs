// Disposable HTTP fixture: controls, search, screen intent, errors and cleanup.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const app=path.resolve(__dirname,'../hub_ui/app');
const output=process.env.LOBBY_QA_OUTPUT||path.resolve(__dirname,'../output/lobbies/gallery');

async function main(){
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[],requests=[];let fail=false,current='ForgeLobby',visible=false,hold=null;
    const names=['ForgeLobby','SpiritArcadeLobby','Spirit Afterparty'];
    const labels=['Spirit forge','Spirit arcade','Spirit afterparty'];
    const data=()=>({game_scene:'Test',program_scene:'Lobbies',current_lobby:current,screen:{visible},lobbies:names,
      locations:names.map((source,i)=>({source,label:labels[i],description:['Amber smithy','Rainy neon arcade','Animated clubhouse'][i],managed:true,ready:true,rotation:true,
        layout:{screen:[100,200,600,300],camera:[800,300,400,500],chat:[1500,200,300,500]}}))});
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('http://lobby.test/**',async route=>{
      const req=route.request(),url=new URL(req.url());
      if(url.pathname==='/api/projects/scene_voice_switcher/lobbies'){
        const snapshot=data();if(hold)await new Promise(resolve=>hold=resolve);
        return route.fulfill({json:snapshot});
      }
      if(req.method()==='POST'){
        requests.push({path:url.pathname,body:req.postDataJSON()});
        if(fail)return route.fulfill({status:400,json:{error:'Fixture repair rejected'}});
        if(url.pathname.endsWith('/select_lobby')){const body=req.postDataJSON();current=body.source||'SpiritArcadeLobby';if(body.screen_visible!==undefined)visible=body.screen_visible;}
        return route.fulfill({json:{ok:true,lobby:current}});
      }
      if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/css/main.css"><link rel="stylesheet" href="/css/workspace.css"><main id="page" style="padding:24px"></main><div id="toasts"></div>'});
      const file=path.resolve(app,'.'+url.pathname);
      if(!file.startsWith(app+path.sep)||!fs.existsSync(file))return route.fulfill({status:404});
      return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});
    });
    await page.goto('http://lobby.test/');
    await page.evaluate(async()=>{
      const {state}=await import('/js/state.js');window.fixtureState=state;
      state.set({connected:true,projects:[{name:'scene_voice_switcher',is_active:true,current_activity:'showing: ForgeLobby'}]});
      window.gallery=await import('/js/pages/scene-switcher.js');await gallery.mount(document.querySelector('#page'));
    });
    assert.equal(await page.locator('[data-location-card]').count(),3);
    await page.getByRole('searchbox',{name:'Find a lobby'}).fill('neon');
    assert.equal(await page.locator('[data-location-card]:visible').count(),1);
    await page.locator('[data-lobby="SpiritArcadeLobby"][data-with-screen]').click();
    await page.waitForFunction(()=>document.querySelector('[data-location-card] h3')&&[...document.querySelectorAll('h3')].some(h=>h.textContent.includes('Spirit arcade · On screen')));
    assert.deepEqual(requests.at(-1),{path:'/api/projects/scene_voice_switcher/select_lobby',body:{source:'SpiritArcadeLobby',screen_visible:true}});
    assert.equal(await page.getByRole('searchbox',{name:'Find a lobby'}).inputValue(),'neon');
    await page.getByRole('searchbox',{name:'Find a lobby'}).fill('');
    await page.locator('[data-lobby="ForgeLobby"]').filter({hasText:'Enter lobby'}).click();
    await page.waitForFunction(()=>[...document.querySelectorAll('h3')].some(h=>h.textContent.includes('Spirit forge · On screen')));
    assert.deepEqual(requests.at(-1).body,{source:'ForgeLobby'});
    await page.getByText('Screen shown',{exact:true}).waitFor();
    await page.evaluate(()=>fixtureState.set({projects:[{name:'scene_voice_switcher',is_active:true,current_activity:'showing: Spirit Afterparty'}]}));
    await page.getByRole('heading',{name:'Spirit afterparty · On screen',exact:true}).waitFor();
    await page.evaluate(()=>fixtureState.set({projects:[{name:'scene_voice_switcher',is_active:false,current_activity:null}]}));
    await page.getByText('No lobby is on screen. Enter a world whenever you want to chat.').waitFor();
    await page.getByRole('searchbox',{name:'Find a lobby'}).fill('<img src=x onerror=alert(1)>');
    assert.equal(await page.locator('[data-location-card]:visible').count(),0);
    await page.getByText('No matching lobby. Try another name.').waitFor();
    await page.getByRole('searchbox',{name:'Find a lobby'}).fill('');
    fail=true;
    await page.locator('[data-lobby="Spirit Afterparty"]').filter({hasText:'Enter lobby'}).click();
    await page.getByText('Fixture repair rejected',{exact:true}).waitFor();
    assert.equal(await page.locator('[data-lobby="Spirit Afterparty"]').first().isEnabled(),true);
    fail=false;
    await page.locator('[data-location-card]').first().locator('summary').click();
    await page.locator('[data-placement="ForgeLobby"] [name="chat_w"]').fill('280');
    await page.locator('[data-placement="ForgeLobby"] button').click();
    await page.waitForFunction(()=>!document.querySelector('[data-placement="ForgeLobby"] button').disabled);
    assert.equal(requests.at(-1).path,'/api/projects/scene_voice_switcher/configure_lobby');
    assert.deepEqual(requests.at(-1).body.changes.chat,[1500,200,280,500]);
    await page.evaluate(()=>fixtureState.set({connected:false}));
    assert.equal(await page.locator('[data-lobby="ForgeLobby"]').first().isDisabled(),true);
    await page.evaluate(()=>fixtureState.set({connected:true}));
    await page.screenshot({path:path.join(output,'desktop.png'),animations:'disabled'});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:path.join(output,'mobile.png'),animations:'disabled'});
    hold=true;await page.locator('[data-refresh]').click();
    await page.evaluate(()=>{gallery.unmount();document.querySelector('#page').innerHTML='<p>Another page</p>';});
    if(typeof hold==='function')hold();hold=null;
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#page').innerText(),'Another page');
    assert.deepEqual(errors,[]);
    console.log('Lobby gallery: desktop/mobile, search, placement, screen intent, errors and unmount passed.');
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
