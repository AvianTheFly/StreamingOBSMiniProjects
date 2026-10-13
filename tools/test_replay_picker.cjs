// Disposable browser contracts: never send commands to the live Hub.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const app=path.resolve(__dirname,'../hub_ui/app');
const output=path.resolve(__dirname,'../output/minimal-stream-desk');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:960}}),writes=[],errors=[];
  let stage={active:false,pending:false},ready=true,fail=false,hold=false,release,reads=0;
  let queueState={supported:true,active:false,revision:0,session:'fixture',upcoming:[]};
  const clips=Array.from({length:22},(_,i)=>({id:'clip'+i,title:i?'Moment '+i:'A good escape',path:`C:/fixture/${i}.mp4`,purpose:i===1?'review_later':'highlight',saved_at:1791550000}));
  const groups=[{id:'intro',name:'Favorite moments',paths:[clips[0].path,clips[1].path]},{id:'missing',name:'Missing footage',paths:['C:/fixture/gone.mp4']}];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://picker.test/**',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(req.method()==='POST'){
    writes.push({path:url.pathname,body:req.postDataJSON()});
    await new Promise(r=>setTimeout(r,90));
    if(fail)return route.fulfill({status:409,json:{error:'Please try again'}});
    if(url.pathname.endsWith('/play')){
      stage={active:true,title:'A good escape',paused:false};
      const body=req.postDataJSON(),paths=body.random?clips.slice(0,7).map(c=>c.path):body.paths||[body.path||clips[0].path];
      queueState={supported:true,active:true,revision:queueState.revision+1,session:'session-'+queueState.revision,random:!!body.random,current:{id:'current',path:paths[0]},upcoming:paths.slice(1).map((p,i)=>({id:'upcoming-'+i,path:p}))};
    }
    if(url.pathname.endsWith('/pause'))stage={...stage,paused:true};
    if(url.pathname.endsWith('/resume'))stage={...stage,paused:false};
    if(url.pathname.endsWith('/revert')){stage={active:false};queueState={...queueState,active:false,upcoming:[],revision:queueState.revision+1};}
    if(url.pathname.endsWith('/queue')){
      const body=req.postDataJSON();assert.equal(body.session,queueState.session);assert.equal(body.revision,queueState.revision);
      if(body.action==='add'){const index=queueState.upcoming.findIndex(e=>e.id===body.before);queueState.upcoming.splice(index<0?queueState.upcoming.length:index,0,...body.paths.map((p,i)=>({id:'added-'+queueState.revision+'-'+i,path:p})));}
      if(body.action==='remove')queueState.upcoming=queueState.upcoming.filter(e=>e.id!==body.id);
      if(body.action==='move'){const index=queueState.upcoming.findIndex(e=>e.id===body.id),[entry]=queueState.upcoming.splice(index,1),before=queueState.upcoming.findIndex(e=>e.id===body.before);queueState.upcoming.splice(before<0?queueState.upcoming.length:before,0,entry);}
      if(body.action==='clear'){queueState.upcoming=[];queueState.random=false;}
      queueState.revision++;return route.fulfill({json:queueState});
    }
    return route.fulfill({json:{ok:true}});
   }
   if(url.pathname==='/fixture')return route.fulfill({contentType:'text/html',body:`<link rel="stylesheet" href="/css/main.css"><link rel="stylesheet" href="/css/replay-picker.css"><main id="host" style="padding:24px"></main><div id="toasts"></div><script type="module">import {mountReplayPicker} from '/js/pages/replay-picker.js'; const picker=mountReplayPicker(document.querySelector('#host'),()=>{});window.fixtureUpdate=(stage,connected=true,replayQueue=null)=>picker.update({connected,projects:[],replayStage:stage,replayQueue});window.fixtureDispose=()=>picker.dispose();fixtureUpdate({active:false});</script>`});
   if(url.pathname.endsWith('/queue'))return route.fulfill({json:queueState});
   if(url.pathname.endsWith('/clips')){reads++;if(hold)await new Promise(r=>release=r);return route.fulfill({json:{ready,clips,groups}});}
   if(url.pathname.endsWith('/stage'))return route.fulfill({json:stage});
   if(url.pathname.endsWith('/poster'))return route.fulfill({json:{status:'ready',duration:30}});
   if(url.pathname.endsWith('/poster-media'))return route.fulfill({body:fs.readFileSync(path.join(app,'assets/loading-mastery.jpg')),contentType:'image/jpeg'});
   const file=path.resolve(app,'.'+url.pathname);
   if(!file.startsWith(app+path.sep)||!fs.existsSync(file))return route.fulfill({status:404});
   return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('http://picker.test/fixture');await page.locator('.replay-play-card:not([disabled])').first().waitFor();
  assert.equal(writes.length,0);assert.equal(await page.locator('.replay-play-card').count(),18);
  await page.getByRole('button',{name:'Add A good escape to queue',exact:true}).click();
  await page.getByRole('button',{name:'Add Moment 1 to queue',exact:true}).click();
  assert.equal(writes.length,0,'Draft preparation stays off stream');
  await page.getByRole('button',{name:'Move clip 2 up',exact:true}).click();
  assert.match(await page.locator('.replay-queue-row').first().textContent(),/Moment 1/);
  await page.locator('.replay-card-wrap[data-item=clip2]').dragTo(page.locator('#replayQueueRows'));
  assert.equal(await page.locator('.replay-queue-row').count(),3,'Library drag adds a clip');
  await page.locator('.replay-queue-row').first().dragTo(page.locator('#replayPickerGrid'));
  assert.equal(await page.locator('.replay-queue-row').count(),2,'Dropping back in library removes a queued clip');
  await page.locator('#replayStartQueue').click();await page.locator('#replayPlaying').waitFor({state:'visible'});
  assert.deepEqual(writes.at(-1).body,{paths:[clips[0].path,clips[2].path],mode:'showcase'});
  await page.getByRole('button',{name:'Add Moment 3 to queue',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.replay-queue-row').length===2);
  assert.equal(writes.at(-1).body.action,'add');
  await page.getByRole('button',{name:'Move clip 2 up',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.replay-queue-row')?.textContent.includes('Moment 3'));
  await page.getByRole('button',{name:'Remove clip 1 from queue',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.replay-queue-row').length===1);
  await page.locator('#replayStop').click();await page.waitForFunction(()=>!document.querySelector('#replayStop').hasAttribute('aria-busy'));await page.evaluate(({stage,queue})=>fixtureUpdate(stage,true,queue),{stage,queue:queueState});
  await page.locator('#replayRandom').click();await page.locator('#replayPlaying').waitFor({state:'visible'});
  assert.deepEqual(writes.at(-1).body,{random:true,mode:'showcase'});
  assert.equal(await page.locator('.replay-queue-row').count(),6);
  await page.locator('#replayStop').click();await page.waitForFunction(()=>!document.querySelector('#replayStop').hasAttribute('aria-busy'));await page.evaluate(({stage,queue})=>fixtureUpdate(stage,true,queue),{stage,queue:queueState});
  assert(await page.locator('#replayPlaying').isHidden());
  assert.equal(await page.locator('#irNotes,#irTrim,input[type=checkbox],iframe').count(),0);
  await page.locator('#replayMore').click();assert.equal(await page.locator('.replay-play-card').count(),4);
  await page.locator('#replayFind').fill('escape');assert.equal(await page.locator('.replay-play-card').count(),1);
  await page.locator('.replay-play-card').press('Enter');
  await page.locator('#replayPlaying').waitFor({state:'visible'});
  assert.deepEqual(writes.at(-1),{path:'/api/projects/instant_replay/play',body:{path:clips[0].path,mode:'showcase'}});
  assert(await page.locator('.replay-play-card').isDisabled());
  await page.locator('#replayPause').click();await page.waitForFunction(()=>!document.querySelector('#replayPause').hasAttribute('aria-busy'));await page.evaluate(stage=>fixtureUpdate(stage),stage);
  await page.locator('#replayResume').waitFor({state:'visible'});
  await page.locator('#replayResume').click();await page.waitForFunction(()=>!document.querySelector('#replayResume').hasAttribute('aria-busy'));await page.evaluate(stage=>fixtureUpdate(stage),stage);
  await page.locator('#replayStop').click();await page.waitForFunction(()=>!document.querySelector('#replayStop').hasAttribute('aria-busy'));await page.evaluate(stage=>fixtureUpdate(stage),stage);
  await page.locator('#replayPlaying').waitFor({state:'hidden'});
  await page.locator('#replayFind').fill('');await page.locator('[data-replay-kind=montages]').click();
  assert.equal(await page.locator('.replay-play-card').count(),2);
  assert(await page.getByRole('button',{name:'Play Missing footage on stream',exact:true}).isDisabled());
  await page.getByRole('button',{name:'Play Favorite moments on stream',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('[data-replay-id=intro]').hasAttribute('aria-busy')&&document.querySelector('#replayPlaying').hidden===false);
  assert.deepEqual(writes.at(-1),{path:'/api/projects/instant_replay/play',body:{group_id:'intro',mode:'showcase'}});
  stage={active:false};await page.evaluate(stage=>fixtureUpdate(stage),stage);
  fail=true;await page.getByRole('button',{name:'Play Favorite moments on stream',exact:true}).click();
  await page.getByText('Please try again',{exact:true}).waitFor();
  assert(await page.getByRole('button',{name:'Play Favorite moments on stream',exact:true}).isEnabled());
  await page.evaluate(()=>fixtureUpdate({active:false},false));assert(await page.locator('.replay-play-card').first().isDisabled());
  await page.evaluate(()=>fixtureUpdate({active:false}));await page.locator('[data-replay-kind=clips]').click();
  fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,'minimal-clips.png')});
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(output,'minimal-clips-mobile.png')});
  hold=true;await page.reload();while(!release)await new Promise(r=>setTimeout(r,10));
  await page.evaluate(()=>fixtureDispose());hold=false;release();await page.waitForTimeout(150);
  assert.equal(await page.locator('#host').textContent(),'','Late catalogue cannot recreate disposed UI');
  const lastReads=reads;await page.waitForTimeout(200);assert.equal(reads,lastReads);
  assert.deepEqual(errors,[]);console.log('Replay picker: clips, montages, random playback, draft/live queue, drag/drop, reorder/remove, keyboard, search, errors, mobile and teardown passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
