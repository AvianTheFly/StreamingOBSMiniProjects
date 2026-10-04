// Browser interaction regressions against an isolated personal-data fixture.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),app=path.join(root,'hub_ui/app'),out=process.env.STARTING_SOON_OUTPUT_DIR||path.join(root,'output/starting-soon-v2');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:'chrome'});
 const saved=[],actions=[],errors=[];
 const config={title:'STREAM STARTING SOON',subtitle:'Gather by the fire.',revision:0,rotation_seconds:35,rotate_artwork:true,highlights_enabled:true,transition_style:'dissolve',motion:'still',saved_looks:[],
  artwork:['fjord.png','lantern-tide.png'],available_artwork:fs.readdirSync(path.join(root,'mini projects/starting_soon/art')).filter(n=>n.endsWith('.png')),
  playlist:['C:/clips/1.mp4'],playlists:[{id:'main',name:'Favorites',paths:['C:/clips/1.mp4']}],active_playlist_id:'main',loop:true,shuffle:false,gap_seconds:5,
  layout:'preserve',custom_box:{x:690,y:320,width:1144},clip_layouts:{},ready:true,active:true,playing:false,
  session_queue:{busy:false,upcoming:[],history:[]},artwork_index:0,clip_box:[690,320,1144,643.5],
  layout_catalog:{right:{box:[690,320,1144,643.5]},left:{box:[86,320,1144,643.5]},cinema:{box:[280,230,1360,765]},corner:{box:[1020,530,800,450]}}};
 config.artwork_catalog=config.available_artwork.map(file=>({file,title:file.replace('.png',''),mood:'Spirit world',recommended_layout:file==='lantern-tide.png'?'left':'right'}));
 const clips=Array.from({length:61},(_,i)=>({path:'C:/clips/'+i+'.mp4',title:'Moment '+String(i).padStart(2,'0'),name:i+'.mp4',saved_at:1000+i,favorite:i%4===0,scope:i%3===0?'highlight reel':'saved',game:'Game '+(i%3),tag:'win'}));
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1200}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://desk.test/**',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<html><head><link rel="stylesheet" href="/css/base.css"></head><body style="margin:24px;background:#10171d;font-family:Arial;color:white"><div id="page"></div><div id="toasts"></div><script type="module">import {mount} from "/js/pages/starting-soon.js";mount(document.getElementById("page"));</script></body></html>'});
   if(u.pathname==='/api/starting-soon')return route.fulfill({json:config});
   if(u.pathname==='/api/starting-soon/settings'){const body=req.postDataJSON();saved.push(body);Object.assign(config,body,{revision:config.revision+1});return route.fulfill({json:config});}
   if(u.pathname.startsWith('/api/starting-soon/')){actions.push({action:u.pathname.split('/').pop(),body:req.postDataJSON()});return route.fulfill({json:{ok:true}});}
   if(u.pathname==='/api/projects/instant_replay/clips')return route.fulfill({json:{clips,groups:[{id:'high',name:'Best moments',paths:['C:/clips/2.mp4','C:/clips/3.mp4']}]}});
   if(u.pathname==='/api/projects/instant_replay/preview'){return route.fulfill({json:{status:'ready'}});}
   if(u.pathname==='/api/projects/instant_replay/preview-media')return route.fulfill({status:204});
   const file=u.pathname.startsWith('/starting-soon/art/')?path.join(root,'mini projects/starting_soon/art',path.basename(u.pathname)):path.join(app,u.pathname);
   if(!fs.existsSync(file))return route.fulfill({status:404});
   return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':'text/html'});
  });
  await page.goto('http://desk.test/');await page.locator('#ssLibrary li').first().waitFor();
  assert.equal(await page.locator('#ssLibrary li').count(),25);
  await page.locator('#ssNextPage').click();assert.equal(await page.locator('#ssPage').textContent(),'2 / 3');
  await page.locator('#ssFilter').selectOption('favorite');assert.equal(await page.locator('#ssLibrary li').count(),16);
  await page.locator('#ssSelectPage').click();await page.locator('#ssAddSelected').click();assert.equal(await page.locator('#ssPlaylist li').count(),17);
  await page.locator('#ssSavePlaylist').click();await page.waitForFunction(()=>document.querySelector('#ssUnsaved').textContent==='All changes saved');assert.equal(saved.at(-1).playlists[0].paths.length,17);
  page.once('dialog',d=>d.accept('Late-night highlights'));await page.locator('#ssListDuplicate').click();
  await page.locator('#ssSavePlaylist').click();await page.waitForTimeout(100);assert.equal(saved.at(-1).playlists.length,2);
  await page.locator('#ssGroup').selectOption('high');await page.locator('#ssAddGroup').click();
  await page.locator('#ssPlay').click();await page.waitForTimeout(100);assert.equal(actions.at(-1).action,'play');assert.equal(actions.at(-1).body.paths.length,19);
  config.session_queue={busy:true,paused:false,loop:true,shuffle:false,upcoming:[{entry_id:'a',title:'Next highlight'}],history:[]};config.playing=true;config.clip_title='Current clip';config.position_ms=12500;config.duration_ms=30000;
  await page.waitForFunction(()=>document.querySelector('#ssNowTitle').textContent==='Current clip');
  assert.equal(await page.locator('#ssElapsed').textContent(),'0:12');await page.locator('#ssQueue').getByText('Next',{exact:true}).click();assert.equal(actions.at(-1).action,'queue-first');
  await page.locator('#ssPause').click();assert.equal(actions.at(-1).action,'pause');
  await page.locator('#ssLibrary').getByText('Preview',{exact:true}).first().click();await page.waitForFunction(()=>!!document.querySelector('#ssClipVideo').getAttribute('src'));
  assert.equal(await page.locator('#ssClipVideo').evaluate(e=>e.muted),true);
  await page.locator('#ssClipPlacement select').selectOption('left');await page.getByText('Save this clip’s placement',{exact:true}).click();await page.waitForTimeout(100);assert(Object.values(saved.at(-1).clip_layouts).some(v=>v.layout==='left'));
  await page.locator('#ssClosePreview').click();assert.equal(await page.locator('#ssClipVideo').getAttribute('src'),null);
  await page.screenshot({path:path.join(out,'desk-playlists.png'),fullPage:true});
  await page.locator('#ssArtTab').click();assert.equal(await page.locator('#ssArtGrid article').count(),config.available_artwork.length);
  await page.locator('#ssTitle').fill('BE RIGHT BACK');
  await page.locator('#ssMessageToggle').click();await page.waitForTimeout(100);
  assert.equal(saved.at(-1).show_message,false);assert.equal(saved.at(-1).title,undefined,'quick visibility must not publish unsaved wording');
  assert.equal(await page.locator('#ssShowMessage').isChecked(),false);assert.equal(await page.locator('#ssTitle').inputValue(),'BE RIGHT BACK');
  await page.locator('#ssShowMessage').check();await page.locator('#ssShowFooter').uncheck();
  assert.equal(await page.locator('#ssArtGrid a').count(),config.available_artwork.length);
  assert.equal(await page.locator('#ssLayerLinks input').count(),3);
  assert((await page.locator('#ssLayerLinks input').nth(1).inputValue()).includes('layer=message'));
  assert((await page.locator('#ssLayerLinks input').last().inputValue()).includes('layer=frame'));
  await page.locator('#ssAllArt').click();await page.locator('#ssDefaultPlacement select').selectOption('cinema');
  await page.locator('#ssTransitionStyle').selectOption('portal');await page.locator('#ssWorldMotion').selectOption('drift');
  await page.locator('#ssSaveAppearance').click();await page.waitForTimeout(100);assert.equal(saved.at(-1).layout,'cinema');assert.equal(saved.at(-1).artwork.length,config.available_artwork.length);
  assert.equal(saved.at(-1).title,'BE RIGHT BACK');assert.equal(saved.at(-1).show_message,true);assert.equal(saved.at(-1).show_footer,false);
  assert.equal(saved.at(-1).transition_style,'portal');assert.equal(saved.at(-1).motion,'drift');
  const actionsBefore=actions.length,clipsBefore=structuredClone(config.playlists),placementBefore=structuredClone(config.clip_layouts);
  page.once('dialog',d=>d.accept('Midnight break'));await page.locator('#ssLookSave').click();
  await page.waitForFunction(()=>document.querySelector('#ssLookSelect').value.startsWith('look-'));
  assert.equal(saved.at(-1).saved_looks[0].settings.title,'BE RIGHT BACK');
  assert.equal(saved.at(-1).saved_looks[0].settings.playlist,undefined);
  await page.locator('#ssSceneryOnly').click();await page.waitForFunction(()=>!document.querySelector('#ssHighlightSwitch').checked);
  assert.equal(config.highlights_enabled,false);assert.equal(config.show_message,false);
  await page.locator('#ssPreviewMode').click();
  await page.frameLocator('#ssStage').locator('#clip-frame').waitFor({state:'visible'});
  await page.locator('#ssPreviewMode').click();
  const saveCount=saved.length;await page.locator('#ssClipsTab').click();await page.locator('#ssPlay').click();await page.waitForTimeout(100);
  assert.equal(saved.length,saveCount,'disabled highlights reject play before saving a playlist');assert.equal(actions.length,actionsBefore);
  await page.locator('#ssLookPreview').click();assert.equal(config.show_message,false,'preview look stays private');
  await page.locator('#ssLookApply').click();await page.waitForFunction(()=>document.querySelector('#ssHighlightSwitch').checked);
  assert.equal(config.title,'BE RIGHT BACK');assert.equal(config.show_message,true);assert.equal(config.transition_style,'portal');
  assert.deepEqual(config.playlists,clipsBefore);assert.deepEqual(config.clip_layouts,placementBefore);assert.equal(actions.length,actionsBefore,'applying a design never starts playback');
  await page.locator('#ssArtTab').click();
  await page.screenshot({path:path.join(out,'desk-artwork.png'),fullPage:true});
  await page.setViewportSize({width:800,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);console.log('Desk: named playlists, pagination, filters, bulk selection, private preview, per-clip layout, live queue, progress and responsive controls verified');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
