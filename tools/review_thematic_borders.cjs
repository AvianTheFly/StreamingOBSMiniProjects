// Finite exact-scope QA. Intercepted browser routes read local files only.
// No Hub, OBS, keyboard hooks, live event subscription or settings writes.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/thematic-borders');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const keys=['Z','T','t','1','!','2','@','3','#','4','$','%'];
const profile=JSON.parse(fs.readFileSync(path.join(root,'mini projects/soundboard/hotkeys_editor.json'))).profiles.default;
const stems=[...new Set(keys.flatMap(k=>profile.hotkeys[k]||[]))];
const contexts=JSON.parse(fs.readFileSync(path.join(out,'media-context.json')));
assert.deepEqual(contexts.map(x=>x.name),stems);assert.equal(stems.length,40);assert.equal(profile.hotkeys['@'],'hooray');assert.equal(profile.hotkeys['4'],undefined);
const catalog=JSON.parse(execFileSync('py',['-3.11','-c',"import json,runpy; m=runpy.run_path('mini projects/league_api/production/catalog.py'); s=json.load(open('mini projects/league_api/production.json',encoding='utf-8')); a=json.load(open('mini projects/league_api/alerts.json',encoding='utf-8')); print(json.dumps(m['manifest'](s,a['events'])))"],{cwd:root,windowsHide:true,encoding:'utf8'}));
assert.equal(catalog.filter(x=>!x.key.startsWith('custom_')).length,58);
const protectedFiles=['mini projects/soundboard/hotkeys_editor.json','mini projects/soundboard/browser_effects.json','mini projects/soundboard/phrases.json','mini projects/league_api/production.json','mini projects/league_api/alerts.json','mini projects/league_api/production/web/elements.js','mini projects/league_api/production/web/event-art.js','lib/browser_effects/web/rave.js','mini projects/league_api/production/web/event-relics.js'];
const fingerprints=Object.fromEntries(protectedFiles.map(f=>[f,hash(fs.readFileSync(path.join(root,f)))]));
const reuseAudio=process.argv.includes('--reuse-sound-playback'),priorAudio=reuseAudio?JSON.parse(fs.readFileSync(path.join(out,'original-audio-checks.json'))):null;
if(reuseAudio){assert(priorAudio.passed&&priorAudio.live,'Prior original-audio run must pass');assert.equal(priorAudio.fingerprints['lib/browser_effects/web/rave.js'],fingerprints['lib/browser_effects/web/rave.js'],'Sound drawing code changed: replay originals');assert.deepEqual(priorAudio.originalMedia,Object.fromEntries(contexts.map(r=>[r.name,r.sha256])),'Original media changed: replay originals');for(const f of protectedFiles.filter(f=>f.startsWith('mini projects/soundboard/')))assert.equal(priorAudio.fingerprints[f],fingerprints[f],'Sound data changed: replay originals');}
const beforeLeague=execFileSync('git',['show','HEAD:mini projects/league_api/production/web/event-relics.js'],{cwd:root,maxBuffer:30e6});
fs.mkdirSync(path.join(out,'frames'),{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],methods=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>methods.push(r.method()));
  await page.route('http://thematic.test/**',route=>{
   const parts=new URL(route.request().url()).pathname.split('/').filter(Boolean);
   if(!parts.length)return route.fulfill({contentType:'text/html',body:'<body style="margin:0;background:#182437;color:#eee;font:17px Segoe UI"></body>'});
   if(parts[0]==='audio'){const row=contexts[Number(parts[1])],body=fs.readFileSync(row.path),type=row.path.endsWith('.mp4')?'video/mp4':'audio/mpeg',range=route.request().headers().range;
    if(range){const [,lo,hi]=range.match(/bytes=(\d+)-(\d*)/)||[];const start=Number(lo),end=hi?Math.min(Number(hi),body.length-1):body.length-1;return route.fulfill({status:206,body:body.subarray(start,end+1),contentType:type,headers:{'accept-ranges':'bytes','content-range':`bytes ${start}-${end}/${body.length}`}});}
    return route.fulfill({body,contentType:type,headers:{'accept-ranges':'bytes'}});}
   const old=parts[0]==='before';if(old)parts.shift();
   const [family,name]=parts;if(parts.length!==2||!['sound','league'].includes(family)||!/^[\w.-]+$/.test(name))return route.fulfill({status:404});
   const file=name==='subtle.js'?path.join(root,'lib/browser_effects/web/subtle.js'):path.join(root,family==='sound'?'lib/browser_effects/web':'mini projects/league_api/production/web',name);
   return route.fulfill({body:old&&name==='event-relics.js'?beforeLeague:fs.readFileSync(file),contentType:name.endsWith('.png')?'image/png':'application/javascript'});
  });
  await page.goto('http://thematic.test/');
  await page.evaluate(async()=>{
   // Every frame is read back repeatedly, including ProductionScene's offscreen
   // canvas. Request one consistent CPU readback backend so GPU path-cache
   // antialiasing cannot make an identical rewind differ by 2 levels in 1 pixel.
   // The production drawing code is unchanged and pixel equality stays exact.
   const getContext=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(kind,options){return getContext.call(this,kind,kind==='2d'?{...options,willReadFrequently:true}:options);};
   const {makeRenderer}=await import('/sound/renderers.js'),R=await import('/sound/rave.js'),{ProductionScene}=await import('/league/scene.js'),L=await import('/league/event-relics.js');
   window.qa={makeRenderer,R,L,ProductionScene};
   const cv=document.createElement('canvas');cv.width=1920;cv.height=1080;qa.cv=cv;qa.c=cv.getContext('2d',{willReadFrequently:true});
   qa.stats=()=>{const pix=qa.c.getImageData(0,0,1920,1080).data;let painted=0,solid=0,translucent=0,bright=0,h=2166136261;for(let i=0;i<pix.length;i+=4){const a=pix[i+3];if(a>20)painted++;if(a>230)solid++;if(a>20&&a<180)translucent++;if(a>200&&pix[i]+pix[i+1]+pix[i+2]>720)bright++;h=Math.imul(h^pix[i]^pix[i+1]<<8^pix[i+2]<<16^pix[i+3]<<24,16777619);}return{painted,solid,translucent,bright,hash:h>>>0,center:qa.c.getImageData(240,170,1440,670).data.some((a,i)=>i%4===3&&a)};};
   qa.thumb=()=>{const cv=document.createElement('canvas');cv.width=640;cv.height=360;const c=cv.getContext('2d');c.fillStyle='#182437';c.fillRect(0,0,640,360);c.drawImage(qa.cv,0,0,640,360);return cv.toDataURL();};
   // Behavioral checks: growth precedes crushing; rubble and restored crystals stay settled.
   const grow=L.structureChoreography(.28),down=L.structureChoreography(.84),late=L.structureChoreography(.96);
   if(grow.grow!==1||grow.crush!==0||down.crush!==1||late.height!==down.height)throw Error('Structure phases are out of order or rubble regrows');
   if(L.structureChoreography(.95,true).spread!==0)throw Error('Restored crystal did not assemble');
   for(let j=0;j<4;j++){const a=L.spiritChoreography(.04,j),b=L.spiritChoreography(.96,j);if(a.wake!==0||b.wake!==1||b.lift!==28)throw Error('Spirit does not wake and rise '+j);}
  });
  const soundResults=[];
  for(let index=0;index<contexts.length;index++){
   const row=contexts[index];
   const result=await page.evaluate(async({row,index,live})=>{
    const show=qa.makeRenderer(qa.cv,row.effect);await show.ready;
    const a=new Audio('/audio/'+index);await new Promise((resolve,reject)=>{a.onloadedmetadata=resolve;a.onerror=()=>reject(Error('Original audio cannot decode: '+row.name));a.load();});
    const d=a.duration,key=row.effect.renderer==='hooray'?'hooray':row.effect.scene||row.effect.style||'muffins',story=key==='hooray'?'Smiling poppers cheer with a sparse perimeter paper shower.':qa.R.SOUND_CULTURE_STORIES[key]+(qa.R.SOUND_ENCORE_STORIES[key]?' '+qa.R.SOUND_ENCORE_STORIES[key]:'');
    if(!story)throw Error('Missing sound story '+key);
    const frames=[];for(const q of [.04,.12,.22,.34,.45,.55,.68,.81,.93]){show.draw(q*d,d,row.effect);frames.push({q,...qa.stats(),image:qa.thumb()});}
    show.draw(d*.45,d,row.effect);const first=qa.stats().hash;show.draw(d*.82,d,row.effect);show.draw(d*.45,d,row.effect);if(first!==qa.stats().hash)throw Error('Reverse seek changes '+row.name);
    const start=performance.now();for(let j=0;j<20;j++)show.draw((.35+j*.01)*d,d,row.effect);const frameMs=(performance.now()-start)/20;
    const samples=[];
    if(live){
     const monitor=document.createElement('canvas');monitor.width=192;monitor.height=108;const mc=monitor.getContext('2d',{willReadFrequently:true});
     await a.play();await new Promise((resolve,reject)=>{
      let ended=false;const timer=setTimeout(()=>{ended=true;a.pause();reject(Error('Audio timeout '+row.name+' at '+a.currentTime+'/'+d+' ready='+a.readyState+' network='+a.networkState));},(d+4)*1000);
      a.onended=()=>{ended=true;clearTimeout(timer);show.clear();resolve();};
      const tick=()=>{if(ended)return;show.draw(a.currentTime,d,row.effect);mc.clearRect(0,0,192,108);mc.drawImage(qa.cv,0,0,192,108);const pix=mc.getImageData(0,0,192,108).data;let h=2166136261;for(let j=0;j<pix.length;j+=4)h=Math.imul(h^pix[j]^pix[j+1]<<8^pix[j+2]<<16^pix[j+3]<<24,16777619);samples.push(h>>>0);requestAnimationFrame(tick);};tick();
     });
    }
    show.draw(d,d,row.effect);const ended=qa.stats().painted===0;show.draw(-.01,d,row.effect);const negativeClear=qa.stats().painted===0;show.clear();const cleared=qa.stats().painted===0;
    a.removeAttribute('src');a.load();return{name:row.name,key,story,duration:d,frameMs,frames,ended,negativeClear,cleared,liveFrames:samples.length,liveMoves:new Set(samples).size};
   },{row,index,live:!process.argv.includes('--static')&&!reuseAudio});
   if(reuseAudio){const old=priorAudio.sounds[index];assert.equal(result.name,old.name);assert.equal(result.key,old.key);assert.equal(result.duration,old.duration);assert.deepEqual(result.frames.map(f=>f.hash),old.frames.map(f=>f.hash),'Sound pixels changed: replay '+row.name);result.liveFrames=old.liveFrames;result.liveMoves=old.liveMoves;result.livePlaybackReused=true;}
   soundResults.push(result);console.log('Sound '+(index+1)+'/40: '+row.name+' · '+result.frameMs.toFixed(2)+' ms/frame');
  }
  const leagueResults=await page.evaluate(async catalog=>{
   const show=new qa.ProductionScene(qa.cv);await show.ready;const results=[];
   for(const e of catalog){const frames=[],draw=t=>show.draw({enabled:true,opacity:1,intensity:1.15,...(e.key==='death'?{death:{elapsed:t,remaining:25-t}}:{effect:{...e,elapsed:t}})});
    for(const q of [.04,.12,.22,.34,.45,.55,.68,.81,.93]){draw(e.key==='death'?1+q*17:q*e.duration);frames.push({q,...qa.stats(),image:qa.thumb()});}
    draw(e.duration*.45);const first=qa.stats().hash,firstPixels=qa.c.getImageData(0,0,1920,1080).data;draw(e.duration*.81);draw(e.duration*.45);if(first!==qa.stats().hash){const now=qa.c.getImageData(0,0,1920,1080).data;let n=0,max=0,x0=1920,y0=1080,x1=0,y1=0;for(let i=0;i<now.length;i+=4)if(now.slice(i,i+4).some((v,j)=>v!==firstPixels[i+j])){n++;const x=(i/4)%1920,y=Math.floor(i/4/1920);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);for(let j=0;j<4;j++)max=Math.max(max,Math.abs(now[i+j]-firstPixels[i+j]));}throw Error('League reverse seek '+e.key+' pixels='+n+' max='+max+' bounds='+[x0,y0,x1,y1]);}
    const start=performance.now();for(let j=0;j<20;j++)draw(e.duration*(.35+j*.01));const frameMs=(performance.now()-start)/20;
    if(e.key!=='death'){draw(0);if(qa.stats().painted)throw Error('League entrance not empty '+e.key);draw(e.duration);if(qa.stats().painted)throw Error('League extends past cutoff '+e.key);}
    show.clear();if(qa.stats().painted)throw Error('League cleanup '+e.key);
    results.push({name:e.key,key:e.key,story:qa.L.playfulStories[e.key]||(e.key==='dragon_hextech'?'Approved Hextech circuit show.':'Personal rule constellation.'),duration:e.duration,frameMs,frames});
   }
   for(const theme of ['earth','fire','water','air','chemtech','elder']){const states=[];for(const elapsed of [3,7,14]){show.draw({enabled:true,ambient:{theme,elapsed}});states.push(qa.stats());}if(new Set(states.map(x=>x.hash)).size!==3||states.some(x=>x.center))throw Error('Ambient dragon clock '+theme);}
   // Approved Hextech must retain exact pixels at entrance, middle and exit.
   const {ProductionScene:Old}=await import('/before/league/scene.js'),canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;const old=new Old(canvas);await old.ready;
   const e=catalog.find(x=>x.key==='dragon_hextech');for(const t of [.4,1.3,2.4]){const state={enabled:true,opacity:1,intensity:1.15,effect:{...e,elapsed:t}};show.draw(state);old.draw(state);if(qa.cv.toDataURL()!==canvas.toDataURL())throw Error('Approved Hextech changed at '+t);}
   return results;
  },catalog);
  for(const row of [...soundResults,...leagueResults]){
   assert(row.frames.every(f=>!f.center),row.name+' covers gameplay');assert(row.frames.slice(2,8).every(f=>f.painted>700),row.name+' is not readable');assert(new Set(row.frames.map(f=>f.hash)).size>=8,row.name+' lacks developing motion');
   assert(row.frames.every(f=>f.solid<240000&&f.bright<30000),row.name+' excessive coverage or glare');
   if(row.ended!==undefined){assert(row.ended&&row.negativeClear&&row.cleared,row.name+' cutoff/cleanup');if(!process.argv.includes('--static'))assert(row.liveFrames>=8&&row.liveMoves>=8,row.name+' does not animate with original audio');}
   fs.writeFileSync(path.join(out,'frames',row.key+'.png'),Buffer.from(row.frames[4].image.split(',')[1],'base64'));
  }
  assert.equal(new Set(leagueResults.map(r=>r.frames[4].hash)).size,leagueResults.length,'League compositions must be distinct');
  assert.deepEqual(errors,[]);assert(methods.every(x=>x==='GET'));for(const [f,h] of Object.entries(fingerprints))assert.equal(hash(fs.readFileSync(path.join(root,f))),h,f+' changed');for(const r of contexts)assert.equal(hash(fs.readFileSync(r.path)),r.sha256,r.name+' original media changed');
  const escape=s=>s.replace(/[&<>\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
  for(const [family,rows] of [['sounds',soundResults],['league',leagueResults]])for(let start=0;start<rows.length;start+=4){const group=rows.slice(start,start+4);await page.evaluate(rows=>{document.body.innerHTML=rows.map(r=>`<section style="margin:18px"><h2>${r.name}</h2><p>${r.story}</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">${[r.frames[1],r.frames[4],r.frames[7]].map(f=>`<img style="width:100%" src="${f.image}">`).join('')}</div></section>`).join('');},group);await page.screenshot({path:path.join(out,family+'-'+start+'.png'),fullPage:true});}
  const html='<!doctype html><meta charset="utf-8"><title>Thematic borders review</title><style>body{background:#182437;color:#e7ebee;font:17px Segoe UI;margin:30px}section{margin:28px 0}h2{margin:12px 0 4px}.strip{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}img{width:100%}</style><h1>Thematic borders</h1><p>40 sounds · all League events. Each strip shows setup, action and payoff. Key 4 is unbound and preserved. Original media and settings are unchanged. OBS was not opened.</p>'+[['Sounds',soundResults],['League events',leagueResults]].map(([family,rows])=>'<h1>'+family+'</h1>'+rows.map(r=>'<section><h2>'+escape(r.name)+'</h2><p>'+escape(r.story)+'</p><div class="strip">'+[r.frames[1],r.frames[4],r.frames[7]].map(f=>'<img src="'+f.image+'">').join('')+'</div></section>').join('')).join('');
  fs.writeFileSync(path.join(out,'review.html'),html);
  const report={passed:true,live:!process.argv.includes('--static'),livePlaybackReused:reuseAudio,keys,unbound:['4'],fingerprints,originalMedia:Object.fromEntries(contexts.map(r=>[r.name,r.sha256])),sounds:soundResults.map(({frames,...r})=>({...r,frames:frames.map(({image,...f})=>f)})),league:leagueResults.map(({frames,...r})=>({...r,frames:frames.map(({image,...f})=>f)}))};
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2));
  // A League-only artwork iteration may reuse proven original-audio playback
  // only with identical sound code/media/data and all nine identical sound frames.
  if(report.live&&!reuseAudio)fs.writeFileSync(path.join(out,'original-audio-checks.json'),JSON.stringify(report,null,2));
  console.log('PASS: 40 sounds, '+leagueResults.length+' League borders, original audio, 9 story moments, seek/cleanup, quiet alpha, exact Hextech, untouched settings/media.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
