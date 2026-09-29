// Isolated Chromium fixture: no Twitch requests, OBS writes or desktop input.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../hub_ui');
const effects=[['bear','pop',1000,'botlaneBear-chat.png'],['oops','oops',1000,'botlaneOops-chat.png'],
 ['cannon','cannon',1000,'botlaneOops-chat.png'],['calculated','calculated',1000,'botlaneBear-chat.png'],
 ['fear','fear',1500,'botlaneBear-chat.png'],['party','party',2000,'botlaneBear-chat.png']].map(([key,style,duration,image])=>
 ({key,style,duration,image,title:key,cost:10,label:key.toUpperCase(),color:'#d97706',enabled:true,installed:true}));
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[],acks=[],saves=[];
  let pending=null;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://rewards.test/**',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.pathname==='/api/next'){if(url.searchParams.get('active')==='0')return route.fulfill({json:null});const effect=pending;pending=null;return route.fulfill({json:effect});}
   if(url.pathname==='/api/ack'){acks.push({body:request.postDataJSON(),time:Date.now()});return route.fulfill({json:{ok:true}});}
   if(url.pathname==='/api/configure'){saves.push(request.postDataJSON());return route.fulfill({json:{ok:true}});}
   if(url.pathname==='/api/status')return route.fulfill({json:{connected:true,overlay_ready:true,enabled:true,message:'Connected',installed:6,effects,recent:[]}});
   const file=url.pathname.startsWith('/web/')?path.join(root,'viewer_rewards',url.pathname.slice(5)):
    url.pathname.startsWith('/assets/')?path.join(root,'viewer_assets',url.pathname.slice(8)):path.join(root,'viewer_rewards.html');
   const body=file.endsWith('.html')?fs.readFileSync(file,'utf8').replace('__CSRF__','fixture'):fs.readFileSync(file);
   return route.fulfill({body,contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});
  });
  await page.goto('http://rewards.test/overlay?key=fixture');
  const painted=()=>page.evaluate(()=>document.getElementById('stage').getContext('2d').getImageData(0,0,1920,1080).data.some((v,i)=>i%4===3&&v));
  assert.equal(await painted(),false,'idle overlay must be transparent');
  for(const effect of effects){
   const start=Date.now(),id='test-'+effect.key;pending={...effect,id};
   await page.waitForFunction(()=>document.getElementById('stage').getContext('2d').getImageData(0,0,1920,1080).data.some((v,i)=>i%4===3&&v));
   assert.equal(acks.some(a=>a.body.id===id),false,'must not acknowledge at the beginning');
   const central=await page.evaluate(()=>document.getElementById('stage').getContext('2d').getImageData(240,170,1440,670).data.some((v,i)=>i%4===3&&v));
   assert.equal(central,false,effect.key+' must leave gameplay center clear');
   while(!acks.some(a=>a.body.id==='test-'+effect.key))await page.waitForTimeout(50);
   const ack=acks.find(a=>a.body.id==='test-'+effect.key);
   assert.equal(ack.body.status,'played');assert(ack.time-start>=effect.duration,'ack only after animation completes');
   assert.equal(await painted(),false,'completed effect must clear');
  }
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('obsSourceActiveChanged',{detail:{active:false}})));
  pending={...effects[0],id:'hidden',duration:600};await page.waitForTimeout(500);
  assert.equal(pending.id,'hidden','inactive source cannot consume a redemption');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('obsSourceActiveChanged',{detail:{active:true}})));
  while(!acks.some(a=>a.body.id==='hidden'))await page.waitForTimeout(50);
  pending={...effects[5],id:'interrupted'};
  await page.waitForFunction(()=>document.getElementById('stage').getContext('2d').getImageData(0,0,1920,1080).data.some((v,i)=>i%4===3&&v));
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('obsSourceActiveChanged',{detail:{active:false}})));
  while(!acks.some(a=>a.body.id==='interrupted'))await page.waitForTimeout(50);
  assert.equal(acks.find(a=>a.body.id==='interrupted').body.status,'error','scene change must leave interrupted effect refundable');
  assert.equal(await painted(),false);
  await page.goto('http://rewards.test/');await page.locator('.card').first().waitFor();
  assert.equal(await page.locator('.card').count(),6);
  const first=page.locator('.card').first();await first.locator('input[type=number]').fill('0.6');
  await first.getByRole('button',{name:'Save',exact:true}).click();
  await page.waitForTimeout(100);assert.equal(saves[0].settings.duration,600);assert.equal(saves[0].key,'bear');
  const output=process.env.REDEMPTION_PREVIEW_PATH;
  if(output){fs.mkdirSync(path.dirname(output),{recursive:true});await page.screenshot({path:output});}
  assert.deepEqual(errors,[]);console.log('Six quick redemption animations, transparent center, completion acknowledgements and configuration UI passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
