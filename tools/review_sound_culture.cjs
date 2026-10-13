// Exact-hotkey review with original sound playback, deterministic seeking and alpha.
const {chromium}=require('playwright'),{spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.SOUND_REVIEW_OUT||path.join(root,'output/sound-culture');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const contextRows=JSON.parse(fs.readFileSync(path.join(out,'media-context.json')));
const profile=JSON.parse(fs.readFileSync(path.join(root,'mini projects/soundboard/hotkeys_editor.json'))).profiles.default.hotkeys;
const full=process.argv.includes('--full');
const keys=full?'! 1 2 @ # 3 4 $ 5 % 6 ^ z Z h H c C t T'.split(' '):['!','2','#','Z','T','t','h','H'];
const stems=[...new Set(keys.flatMap(k=>Array.isArray(profile[k])?profile[k]:[profile[k]]))];
assert(stems.every(Boolean),'Requested hotkey is unbound');assert.deepEqual(contextRows.map(r=>r.name),stems);
const requested=process.argv.slice(2).filter(v=>v!=='--full'),reviewNames=requested.length?requested:stems;
assert(reviewNames.every(name=>stems.includes(name)),'Unknown sound requested');
const prefix=requested.length?'targeted-':'';
const files=['mini projects/soundboard/hotkeys_editor.json','mini projects/soundboard/browser_effects.json','mini projects/soundboard/phrases.json','mini projects/league_api/production/web/elements.js','mini projects/league_api/production/web/event-relics.js'];
const fingerprints=Object.fromEntries(files.map(name=>[name,hash(fs.readFileSync(path.join(root,name)))]));
const fixture=spawn('py',['-3.11','-X','utf8','-u','-c',"from lib.paths import ensure_import_paths,load_project_env;ensure_import_paths();load_project_env();from hub_ui.server import _Handler;from http.server import ThreadingHTTPServer;s=ThreadingHTTPServer(('127.0.0.1',0),_Handler);s._editor_port=8765;print(s.server_port,flush=True);s.serve_forever()"],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
let browser;
(async()=>{try{
 const port=await new Promise((resolve,reject)=>{fixture.stdout.once('data',data=>resolve(Number(String(data).trim())));fixture.once('exit',code=>reject(Error('Fixture exited '+code)));});const base='http://127.0.0.1:'+port;
 browser=await chromium.launch({headless:true,channel:'chrome',args:['--mute-audio','--disable-gpu']});const page=await browser.newPage({viewport:{width:1600,height:960}}),errors=[],methods=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>methods.push(r.method()));
 await page.route(base+'/culture-review',r=>r.fulfill({contentType:'text/html',body:'<html><body style="margin:0;background:#142033;color:#e8e8e8;font:16px Segoe UI"></body></html>'}));await page.goto(base+'/culture-review');
 const catalog=(await(await fetch(base+'/api/effects-gallery')).json()).items,rows=reviewNames.map(name=>catalog.find(r=>r.name===name));assert(rows.every(Boolean));
 const result=await page.evaluate(async({rows,contexts})=>{
  const {makeRenderer}=await import('/effects/art/sound/renderers.js'),{SOUND_CULTURE_STORIES,cultureRescueMotion,SOUND_ENERGY,soundEnergyMoment}=await import('/effects/art/sound/rave.js');
  const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;const c=canvas.getContext('2d',{willReadFrequently:true});document.body.append(canvas);
  const stats=()=>{const pix=c.getImageData(0,0,1920,1080).data;let painted=0,h=2166136261;for(let i=0;i<pix.length;i+=4){if(pix[i+3]>20)painted++;h=Math.imul(h^pix[i]^pix[i+1]<<8^pix[i+2]<<16^pix[i+3]<<24,16777619);}return{painted,hash:h>>>0,center:c.getImageData(240,170,1440,670).data.some((v,i)=>i%4===3&&v>0)};};
  const results=[];
  // Full-resolution pixels are checked at every authored story sample. A tiny
  // live monitor avoids forcing multi-megabyte synchronous GPU reads per frame.
  const monitor=document.createElement('canvas');monitor.width=192;monitor.height=108;const mc=monitor.getContext('2d',{willReadFrequently:true});
  const liveStats=()=>{mc.clearRect(0,0,192,108);mc.drawImage(canvas,0,0,192,108);const pix=mc.getImageData(0,0,192,108).data;let h=2166136261;for(let i=0;i<pix.length;i+=4)h=Math.imul(h^pix[i]^pix[i+1]<<8^pix[i+2]<<16^pix[i+3]<<24,16777619);return{hash:h>>>0,center:mc.getImageData(25,18,142,65).data.some((v,i)=>i%4===3&&v>0)};};
  for(const row of rows){const show=makeRenderer(canvas,row.effect);await show.ready;const audio=new Audio(row.audio);await new Promise((resolve,reject)=>{audio.onloadedmetadata=resolve;audio.onerror=()=>reject(Error('Audio missing: '+row.name));audio.load();});const d=audio.duration,key=row.effect.scene||row.effect.style||row.effect.renderer,energy=SOUND_ENERGY[key],story=SOUND_CULTURE_STORIES[key]||(energy?energy[1]+' → '+energy[2]:null);if(!story||!energy)throw Error('Missing contextual story/energy: '+row.name);const samples=[];
   // Observe actual text drawing around the contact. The payoff must never
   // appear early, and seeking back must restore the setup without stale text.
   const hit=soundEnergyMoment(key,0,d,row.effect).hit,drawText=c.fillText,texts=[];
   c.fillText=function(value,...args){texts.push(value);return drawText.call(this,value,...args);};
   show.draw(Math.max(.001,hit-.001),d,row.effect);
   if(texts.includes(energy[2]))throw Error('Early punchline: '+row.name);
   texts.length=0;show.draw(Math.min(d-.001,hit+.06),d,row.effect);
   if(!texts.includes(energy[2]))throw Error('Missing punchline: '+row.name);
   c.fillText=drawText;
   // Nine story moments, plus reverse seeking back to precisely the same frame.
   for(const q of [.04,.12,.22,.34,.45,.55,.68,.81,.93]){show.draw(q*d,d,row.effect);const test=stats();const thumb=document.createElement('canvas');thumb.width=640;thumb.height=360;const tc=thumb.getContext('2d');tc.fillStyle='#142033';tc.fillRect(0,0,640,360);tc.drawImage(canvas,0,0,640,360);samples.push({q,...test,image:thumb.toDataURL()});}
   show.draw(.45*d,d,row.effect);const first=stats().hash;show.draw(.81*d,d,row.effect);show.draw(.45*d,d,row.effect);if(first!==stats().hash)throw Error('Non-deterministic seek: '+row.name);
   // Exercise each original sound using that element's currentTime as sole clock.
   audio.muted=true;await audio.play();const live=[];
   await new Promise((resolve,reject)=>{let ended=false;const timer=setTimeout(()=>{audio.pause();reject(Error('Playback timeout: '+row.name));},(d+4)*1000);audio.onended=()=>{ended=true;clearTimeout(timer);show.clear();resolve();};const tick=()=>{if(ended)return;show.draw(audio.currentTime,d,row.effect);if(audio.currentTime>0)live.push({t:audio.currentTime,...liveStats()});requestAnimationFrame(tick);};tick();});
   const cleared=stats().painted===0;
   audio.removeAttribute('src');audio.load();results.push({name:row.name,key,story,prop:energy[0],setup:energy[1],payoff:energy[2],punchlineSeconds:hit,duration:d,pcmDuration:contexts.find(v=>v.name===row.name).duration,samples,liveFrames:live.length,liveCenterClear:live.every(v=>!v.center),liveMoves:new Set(live.map(v=>v.hash)).size,cleared});
  }
  const catchFrames=[.56,.7,.9].map(p=>cultureRescueMotion(p));
  if(catchFrames.some(r=>Math.abs(r.ally.x-r.support.x)>1e-7||Math.abs(r.ally.y+37*.7-r.support.y)>1e-7))throw Error('Rescued feet do not meet supporting hand');
  return results;
 },{rows,contexts:contextRows});
 const comps=new Set();for(const row of result){assert(row.samples.every(f=>!f.center),row.name+' blocks gameplay');assert(row.samples.slice(1,-1).every(f=>f.painted>700),row.name+' invisible');assert(new Set(row.samples.map(f=>f.hash)).size===9,row.name+' does not develop');assert(!comps.has(row.samples[4].hash),row.name+' reuses composition');comps.add(row.samples[4].hash);assert(row.liveCenterClear&&row.cleared&&row.liveFrames>=10&&row.liveMoves>=10,row.name+' real-audio animation failed');assert(Math.abs(row.duration-row.pcmDuration)<.065,row.name+' duration was stretched');}
 for(let start=0;start<result.length;start+=4){const group=result.slice(start,start+4);await page.evaluate(rows=>{document.body.innerHTML=rows.map(r=>`<section style="margin:14px"><h2 style="margin:10px 0">${r.name}</h2><p style="margin:4px 0 10px">${r.story}</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px">${[r.samples[1],r.samples[4],r.samples[7]].map(s=>`<img style="width:100%;border:1px solid #456" src="${s.image}">`).join('')}</div></section>`).join('');},group);await page.screenshot({path:path.join(out,prefix+'motion-'+(start+1)+'.png'),fullPage:true});}
 for(const row of result){const index=stems.indexOf(row.name);fs.writeFileSync(path.join(out,'border-'+index+'.png'),Buffer.from(row.samples[4].image.split(',')[1],'base64'));}
 assert.deepEqual(errors,[]);assert(methods.every(m=>m==='GET'));for(const file of files)assert.equal(hash(fs.readFileSync(path.join(root,file))),fingerprints[file]);for(const row of contextRows)assert.equal(hash(fs.readFileSync(row.path)),row.sha256,row.name+' media changed');
 fs.writeFileSync(path.join(out,prefix+'review.json'),JSON.stringify({keys,fingerprints,results:result.map(r=>({...r,samples:r.samples.map(({image,...s})=>s)}))},null,2));
 console.log(result.length+' exact-hotkey borders: 9 story moments, original-sound playback, reverse seek, unique compositions, alpha, catch alignment, cleanup and original-media/settings preservation passed.');
}finally{await browser?.close();fixture.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
