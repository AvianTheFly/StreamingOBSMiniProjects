// Full HTTP -> overlay review using fresh local snapshots and real item PNG/audio.
const {chromium}=require('playwright'),{spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/item-purchases');fs.mkdirSync(out,{recursive:true});
const child=spawn('py',['-3.11','-X','utf8','-u','tools/league_purchase_fixture.py'],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe']});
child.stderr.on('data',d=>process.stderr.write(d));
const ready=new Promise((resolve,reject)=>{let s='';const timer=setTimeout(()=>reject(Error('Fixture startup')),20000);child.stdout.on('data',d=>{s+=d;const line=s.split(/\r?\n/).find(l=>l.startsWith('{'));if(line){clearTimeout(timer);resolve('http://127.0.0.1:'+JSON.parse(line).port);}});child.on('exit',c=>{clearTimeout(timer);reject(Error('Fixture exited '+c));});});
(async()=>{let browser;try{
  const base=await ready;browser=await chromium.launch({headless:true,channel:'chrome',args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
  await page.route('**/hud-reference.png',r=>r.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(root,'output/league-hud-20261002/Test-after.png'))}));
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.chimes=[];const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.src.includes('ka-ching'))window.chimes.push({volume:this.volume,muted:this.muted});return original.call(this);};});
  const post=async(p,data)=>{const r=await fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});assert.equal(r.status,200,await r.text());};
  const data={gameData:{gameTime:100},activePlayer:{riotId:'Viewer#NA1',currentGold:5000,championStats:{currentHealth:1000,maxHealth:1000}},allPlayers:[{riotId:'Viewer#NA1',team:'ORDER',items:[],level:5,scores:{}}],events:{Events:[]}};
  await post('/fixture',data);await page.goto(base+'/overlay');await page.waitForFunction(()=>window.leaguePurchases);
  data.gameData.gameTime+=.5;data.activePlayer.currentGold=1350;data.allPlayers[0].items=[{itemID:3078,count:1,displayName:'Trinity Force',price:3333},{itemID:1001,count:1,displayName:'Boots',price:300}];
  await post('/fixture',data);await page.waitForFunction(()=>window.leaguePurchases.state?.item_id===3078);
  await page.waitForFunction(()=>{const s=window.leaguePurchases;return s.state?.elapsed>.85&&s.images.get(s.state.icon)?.naturalWidth>0;});
  await page.screenshot({path:path.join(out,'purchase-overlay.png'),omitBackground:true});
  const report=await page.evaluate(async()=>{
    const s=window.leaguePurchases,{purchasePose}=await import('/production/purchases.js');
    const before=purchasePose(0),hold=purchasePose(1),end=purchasePose(2.7);
    if(!(before.dy>hold.dy&&end.dy>hold.dy&&hold.angle===0&&hold.opacity===1))throw Error('Rise / readable hold / drop');
    const d=s.c.getImageData(0,0,1920,1080).data;let left=1920,right=0,top=1080,bottom=0;
    for(let y=0;y<1080;y++)for(let x=0;x<1920;x++)if(d[(y*1920+x)*4+3]>20){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    if(!(left>990&&right<1240&&bottom<990&&top>780))throw Error('Item does not fit above inventory');
    if(s.state.size!==96)throw Error('Must be three 32px HUD slots');
    return {bounds:{left,right,top,bottom},size:s.state.size,name:s.state.name,chimes:window.chimes};
  });
  assert.equal(report.chimes.length,1);assert.equal(report.chimes[0].volume,.16);assert.equal(report.chimes[0].muted,false);
  await page.waitForFunction(()=>window.leaguePurchases.state?.item_id===1001);
  await page.waitForFunction(()=>window.chimes.length===2);
  // Sale removes the active cue; undoing that sale must not replay its chime.
  data.gameData.gameTime+=.5;data.activePlayer.currentGold=1560;data.allPlayers[0].items=data.allPlayers[0].items.filter(i=>i.itemID!==1001);
  await post('/fixture',data);await page.waitForFunction(()=>!window.leaguePurchases.state);
  assert.equal(await page.evaluate(()=>window.leaguePurchases.audio.paused),true);
  data.gameData.gameTime+=.5;data.activePlayer.currentGold=1350;data.allPlayers[0].items.push({itemID:1001,count:1,displayName:'Boots',price:300});
  await post('/fixture',data);
  assert.equal((await(await fetch(base+'/state')).json()).purchase,null);
  // A genuine repurchase has a fresh identity; undoing it cancels immediately.
  data.gameData.gameTime+=.5;data.activePlayer.currentGold=1560;data.allPlayers[0].items=data.allPlayers[0].items.filter(i=>i.itemID!==1001);
  await post('/fixture',data);
  data.gameData.gameTime+=.5;data.activePlayer.currentGold=1260;data.allPlayers[0].items.push({itemID:1001,count:1,displayName:'Boots',price:300});
  await post('/fixture',data);await page.waitForFunction(()=>window.chimes.length===3);
  data.gameData.gameTime+=.5;data.activePlayer.currentGold=1560;data.allPlayers[0].items=data.allPlayers[0].items.filter(i=>i.itemID!==1001);
  await post('/fixture',data);await page.waitForFunction(()=>!window.leaguePurchases.state);
  report.returns={saleCancelled:true,undoSaleSilent:true,repurchaseChimes:await page.evaluate(()=>window.chimes.length),undoPurchaseCancelled:true};
  data.gameData.gameTime+=.5;data._paused=true;await post('/fixture',data);
  await page.waitForFunction(()=>!window.leaguePurchases.state);
  assert.equal(await page.evaluate(()=>window.leaguePurchases.audio.paused),true);
  // Decode the actual sound, verify it is brief and restrained at the chosen gain.
  report.sound=await page.evaluate(async()=>{const a=new AudioContext();try{const buffer=await a.decodeAudioData(await(await fetch('/purchase-assets/ka-ching.wav')).arrayBuffer());const samples=buffer.getChannelData(0);let peak=0,sum=0;for(const v of samples){peak=Math.max(peak,Math.abs(v));sum+=v*v;}return {seconds:buffer.duration,peakDb:20*Math.log10(peak*.16),rmsDb:20*Math.log10(Math.sqrt(sum/samples.length)*.16)};}finally{await a.close();}});
  assert(report.sound.seconds<1&&report.sound.peakDb<-24&&report.sound.peakDb>-40);
  // Offline deterministic contact sheet on the real saved HUD reference.
  await page.evaluate(async()=>{const s=window.leaguePurchases;window.reviewCue={id:'review',item_id:3078,icon:'/purchase-assets/3078.png',name:'Trinity Force',x:1120,y:880,size:96,elapsed:1,duration:2.8,volume:.16};s.clear();const bg=new Image();bg.src='/purchase-assets/3078.png';await bg.decode();s.images.set(window.reviewCue.icon,bg);});
  for(const [name,t] of [['rise',.28],['hold',1.3],['fall',2.45]]){await page.evaluate(t=>window.leaguePurchases.draw(window.reviewCue,t),t);await page.locator('#item-purchase').screenshot({path:path.join(out,name+'.png'),omitBackground:true});}
  await page.evaluate(()=>{document.body.style.background='url(/hud-reference.png) 0 0 / 1920px 1080px';window.leaguePurchases.draw(window.reviewCue,1.3);});
  await page.screenshot({path:path.join(out,'hud-placement.png'),clip:{x:850,y:780,width:430,height:300}});
  await page.evaluate(()=>{const s=window.leaguePurchases;s.update(window.reviewCue);window.dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:false}}));});
  assert.equal(await page.evaluate(()=>window.leaguePurchases.frame===0&&window.leaguePurchases.audio.paused),true);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser?.close();child.stdin.end();}})().catch(e=>{console.error(e);process.exitCode=1;});
