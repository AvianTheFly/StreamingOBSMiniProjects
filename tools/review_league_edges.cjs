// Finite isolated render QA. No OBS, live events, keyboard, audio or settings writes.
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const out=process.env.LEAGUE_EDGE_REVIEW_DIR||path.join(root,'output/league-edge-refresh');
fs.mkdirSync(out,{recursive:true});
const fixture=spawn('py',['-3.11','-X','utf8','-u','tools/league_production_fixture.py'],
 {cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe']});
fixture.stderr.on('data',d=>process.stderr.write(d));
const endpoint=new Promise((resolve,reject)=>{
 let buffer='';const timer=setTimeout(()=>reject(Error('Fixture timeout')),15000);
 fixture.stdout.on('data',d=>{buffer+=d;const row=buffer.split(/\r?\n/).find(x=>x.startsWith('{'));
  if(row){clearTimeout(timer);resolve('http://127.0.0.1:'+JSON.parse(row).port);}});
 fixture.on('exit',code=>{clearTimeout(timer);reject(Error('Fixture exited '+code));});
});
(async()=>{let browser;try{
 const base=await endpoint;
 browser=await chromium.launch({headless:true,channel:'chrome',args:['--mute-audio']});
 const page=await browser.newPage({viewport:{width:1500,height:980}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route(base+'/review',r=>r.fulfill({contentType:'text/html',body:'<body></body>'}));
 const baseline=path.join(out,'before-web');
 if(fs.existsSync(baseline))await page.route(base+'/baseline/**',r=>{
  const name=new URL(r.request().url()).pathname.split('/').at(-1);
  if(!/^[a-z-]+\.js$/.test(name))return r.fulfill({status:404});
  const file=name==='subtle.js'?path.join(root,'lib/browser_effects/web/subtle.js'):path.join(baseline,name);
  return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(file)});
 });
 await page.goto(base+'/review');
 const catalog=(await(await fetch(base+'/production/settings')).json()).catalog;
 assert.equal(catalog.length,58);
 const result=await page.evaluate(async({catalog,baseline})=>{
  const {ProductionScene}=await import('/production/scene.js');
  const {EVENT_DESIGNS}=await import('/production/event-art.js');
  const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
  const c=canvas.getContext('2d',{willReadFrequently:true}),scene=new ProductionScene(canvas);await scene.ready;
  const assert=(ok,label)=>{if(!ok)throw Error(label);};
  assert(catalog.every(e=>EVENT_DESIGNS[e.key]),'Full catalog has authored cues');
  const stats=()=>{
   const data=c.getImageData(0,0,1920,1080).data;let center=0,inside=0,painted=0,solid=0,max=0,hash=2166136261;
   for(let y=0;y<1080;y++)for(let x=0;x<1920;x++){
    const i=(y*1920+x)*4,a=data[i+3];max=Math.max(max,a);if(a>20)painted++;if(a>180)solid++;
    if(x>=240&&x<1680&&y>=170&&y<840)center+=a;
    if(x>=110&&x<1810&&y>=110&&y<970)inside+=a;
    hash=Math.imul(hash^data[i]^data[i+1]<<8^data[i+2]<<16^a<<24,16777619);
   }return {center,inside,painted,solid,max,hash:hash>>>0};
  };
  const rows=[],fingerprints=new Set();window.edgeCards=[];
  const custom={key:'custom_review',title:'Personal rule',duration:3,intensity:1};
  for(const effect of [...catalog,custom]){
   const frames=[];
   for(const fraction of [.18,.4,.62,.83]){
    scene.draw({enabled:true,opacity:.8,intensity:1.15,effect:{...effect,elapsed:effect.duration*fraction}});
    frames.push(stats());
   }
   assert(frames.every(f=>f.center===0),effect.key+' gameplay clear');
   assert(new Set(frames.map(f=>f.hash)).size===4,effect.key+' animated');
   assert(!fingerprints.has(frames[1].hash),effect.key+' distinct');fingerprints.add(frames[1].hash);
   if(effect.key!=='dragon_hextech'){
    assert(frames.every(f=>f.inside===0),effect.key+' stays in 110px edge band');
    assert(frames.every(f=>f.painted<45000&&f.solid<2500),effect.key+' no filled scenery '+JSON.stringify(frames));
    assert(frames.some(f=>f.painted>500&&f.max>45),effect.key+' visible light');
   }
   for(const elapsed of [0,effect.duration,effect.duration+.1]){
    scene.draw({enabled:true,effect:{...effect,elapsed}});assert(stats().painted===0,effect.key+' clears at endpoints');
   }
   scene.draw({enabled:true,opacity:.8,intensity:1.15,effect:{...effect,elapsed:effect.duration*.5}});
   window.edgeCards.push({key:effect.key,story:EVENT_DESIGNS[effect.key]||'Custom constellation',png:canvas.toDataURL()});
   rows.push({key:effect.key,frames});
  }
  for(const theme of ['earth','fire','water','air','chemtech','elder']){
   const frames=[];for(const elapsed of [2,7,23,120]){
    scene.draw({enabled:true,opacity:.8,ambient:{theme,elapsed}});frames.push(stats());
   }
   assert(frames.every(f=>f.center===0&&f.inside===0&&f.painted>250),theme+' sustained edge presence');
   assert(new Set(frames.map(f=>f.hash)).size===4,theme+' sustained motion');
   for(const elapsed of [.1,.4,.7]){
    scene.draw({enabled:true,opacity:.8,effect:{kind:'release',theme,elapsed,duration:.8}});
    const f=stats();assert(f.center===0&&f.inside===0&&f.solid<2500,theme+' exit never restores old scenery');
   }
  }
  for(const elapsed of [2,12,35,90]){
   scene.draw({enabled:true,opacity:.8,death:{elapsed,remaining:Math.max(0,40-elapsed)}});
   const f=stats();assert(f.center===0&&f.inside===0&&f.painted>250,'continuous death wisps');
  }
  scene.draw({enabled:false});assert(stats().max===0,'disabled cleanup');
  const hex=catalog.find(e=>e.key==='dragon_hextech');
  if(baseline){
   const Original=(await import('/baseline/scene.js')).ProductionScene;
   const oldCanvas=document.createElement('canvas');oldCanvas.width=1920;oldCanvas.height=1080;
   const original=new Original(oldCanvas);await original.ready;
   for(const elapsed of [.3,1.2,2.4])for(const mode of ['effect','ambient','combined']){
    const state={enabled:true,opacity:.8,intensity:1.15,
     ...(mode!=='ambient'?{effect:{...hex,elapsed}}:{}),
     ...(mode!=='effect'?{ambient:{theme:'hextech',elapsed:elapsed+4}}:{})};
    scene.draw(state);original.draw(state);
    assert(canvas.toDataURL()===oldCanvas.toDataURL(),'Hextech pixels preserved: '+mode+' '+elapsed);
   }
  }
  return {rows,hextechBaselineCompared:baseline};
 },{catalog,baseline:fs.existsSync(baseline)});
 assert.deepEqual(errors,[]);
 const cards=await page.evaluate(()=>window.edgeCards);
 fs.mkdirSync(path.join(out,'frames'),{recursive:true});
 for(const card of cards)fs.writeFileSync(path.join(out,'frames',card.key+'.png'),Buffer.from(card.png.split(',')[1],'base64'));
 for(let n=0;n<cards.length;n+=8){
  await page.evaluate(cards=>{
   document.body.style.cssText='margin:0;padding:24px;background:#10161b;color:#c5d5dd;font:14px Segoe UI;display:grid;grid-template-columns:1fr 1fr;gap:20px';
   document.body.replaceChildren();for(const card of cards){
    const item=document.createElement('section'),title=document.createElement('div'),img=new Image();
    title.textContent=card.key+' — '+card.story;title.style.cssText='min-height:40px;font-size:13px';
    img.src=card.png;img.style.cssText='width:100%;background:radial-gradient(ellipse at center,#233a37,#111d27);outline:1px solid #33414c';
    item.append(title,img);document.body.append(item);
   }
  },cards.slice(n,n+8));
  await page.screenshot({path:path.join(out,'contact-'+(n/8+1)+'.png'),fullPage:true});
 }
 fs.writeFileSync(path.join(out,'edge-checks.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({passed:true,events:result.rows.length,hextechBaselineCompared:result.hextechBaselineCompared}));
}finally{if(browser)await browser.close();fixture.stdin.end();}})().catch(e=>{console.error(e);process.exitCode=1;});
