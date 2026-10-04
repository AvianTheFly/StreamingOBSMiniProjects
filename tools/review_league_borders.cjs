// Finite rendered QA against local gameplay; no Hub, OBS, settings or live events.
const {chromium}=require('playwright'),{spawn,spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=process.env.BORDER_REVIEW_ARTIFACT_DIR;
if(!out)throw Error('Set BORDER_REVIEW_ARTIFACT_DIR to a review directory');
fs.mkdirSync(out,{recursive:true});
const gameplay='data:image/png;base64,'+fs.readFileSync(path.join(out,'border-gameplay.png')).toString('base64');
const selected=process.env.BORDER_LEAGUE_REVIEW_KEYS?JSON.parse(process.env.BORDER_LEAGUE_REVIEW_KEYS):null;
const fixture=spawn('py',['-3.11','-X','utf8','-u',path.join(__dirname,'league_production_fixture.py')],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe']});
fixture.stderr.on('data',x=>process.stderr.write(x));
const endpoint=new Promise((resolve,reject)=>{let s='';const timer=setTimeout(()=>reject(Error('Fixture startup timed out')),10000);fixture.stdout.on('data',x=>{s+=x;const row=s.split(/\r?\n/).find(x=>x.startsWith('{'));if(row){clearTimeout(timer);resolve('http://127.0.0.1:'+JSON.parse(row).port);}});fixture.on('exit',code=>{clearTimeout(timer);reject(Error('Fixture exited '+code));});});
(async()=>{let browser;try{
 const base=await endpoint;browser=await chromium.launch({headless:true,channel:'chrome',args:['--mute-audio']});const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/production');
 const catalog=(await(await fetch(base+'/production/settings')).json()).catalog;
 const customProbe=spawnSync('py',['-3.11','-c',"import json,runpy; m=runpy.run_path('mini projects/league_api/production/catalog.py'); s=json.load(open('mini projects/league_api/production.json',encoding='utf-8')); a=json.load(open('mini projects/league_api/alerts.json',encoding='utf-8')); print(json.dumps([x for x in m['manifest'](s,a['events']) if x['key'].startswith('custom_')]))"],{cwd:root,windowsHide:true,encoding:'utf8',timeout:10000});
 if(customProbe.status!==0)throw Error('Custom-rule art inventory failed: '+customProbe.stderr);
 catalog.push(...JSON.parse(customProbe.stdout));
 const keys=selected||catalog.map(x=>x.key);
 const checks=await page.evaluate(async({keys,catalog,gameplay})=>{
  const {ProductionScene}=await import('/production/scene.js');const bg=new Image();bg.src=gameplay;await bg.decode();
  document.body.replaceChildren();document.body.style.cssText='margin:0;background:#13202b;color:#e8f2f7;font:16px Segoe UI;display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:15px';
  window.reviewCards=[];const results=[],cv=document.createElement('canvas');cv.width=1920;cv.height=1080;
  const c=cv.getContext('2d',{willReadFrequently:true}),show=new ProductionScene(cv);await show.ready;
  show.artContext.fillText=()=>{}; // Retain context while excluding captions from art QA.
  const composite=document.createElement('canvas');composite.width=1920;composite.height=1080;const target=composite.getContext('2d');
  for(const key of keys){
   const effect=catalog.find(x=>x.key===key),frames=[];
   const render=(elapsed,opacity=1)=>show.draw({enabled:true,opacity,intensity:1.15,edge_width:56,...(key==='death'?{death:{elapsed,remaining:28-elapsed}}:{effect:{...effect,elapsed}})});
   for(const frac of [.15,.35,.63,.84]){
    const elapsed=key==='death'?1+frac*16:effect.duration*frac;render(elapsed);
    const data=c.getImageData(0,0,1920,1080).data;let center=0,solid=0,glass=0,painted=0,peak=0;
    for(let y=0;y<1080;y++)for(let x=0;x<1920;x++){const a=data[(y*1920+x)*4+3];peak=Math.max(peak,a);if(a>20)painted++;if(a>230)solid++;if(a>20&&a<180)glass++;if(x>=240&&x<1680&&y>=170&&y<840)center+=a;}
    frames.push({elapsed,center,solid,glass,painted,peak,image:cv.toDataURL()});
   }
   const start=performance.now();for(let n=0;n<12;n++)render(key==='death'?4+n/60:effect.duration*.5+n/60);const frameMs=(performance.now()-start)/12;
   if(key!=='death'){render(0);const cleanEntrance=!c.getImageData(0,0,1920,1080).data.some((a,i)=>i%4===3&&a);render(effect.duration);const cleanExit=!c.getImageData(0,0,1920,1080).data.some((a,i)=>i%4===3&&a);assertion(cleanEntrance&&cleanExit,key+' finite endpoints');}
   render(key==='death'?6:effect.duration*.53,.8);
   target.drawImage(bg,0,0);target.drawImage(cv,0,0);window.reviewCards.push({key,png:composite.toDataURL()});results.push({key,frameMs,frames});
  }
  // All six renewed sustained element scenes remain animated on their own clock.
  for(const key of keys.filter(k=>k.startsWith('dragon_'))){const images=[];for(const elapsed of [3,7,14]){show.draw({enabled:true,opacity:1,ambient:{theme:key.slice(7),elapsed}});images.push(cv.toDataURL());}assertion(new Set(images).size===3,key+' sustained motion');}
  function assertion(value,message){if(!value)throw Error(message);}
  return results;
 },{keys,catalog,gameplay});
 const hashes=[];for(const {key,frames,frameMs}of checks){assert(frames.every(f=>f.center===0),key+' protected gameplay');assert(frames.every(f=>f.solid<125000),key+' foreground budget');assert(frames.some(f=>f.painted>2000&&f.peak>150),key+' readable presence');assert(frames.some(f=>f.glass>2000),key+' translucent detail');assert.equal(new Set(frames.map(f=>f.image)).size,4,key+' developing motion');hashes.push(crypto.createHash('sha256').update(frames[2].image).digest('hex'));console.log(JSON.stringify({key,frameMs,solid:Math.max(...frames.map(f=>f.solid)),glass:Math.max(...frames.map(f=>f.glass))}));}
 assert.equal(new Set(hashes).size,keys.length,'Distinct unlabeled compositions');assert.deepEqual(errors,[]);
 const dir=path.join(out,'frames');fs.mkdirSync(dir,{recursive:true});for(const item of await page.evaluate(()=>window.reviewCards.map(({key,png})=>({key,png}))))fs.writeFileSync(path.join(dir,item.key+'.png'),Buffer.from(item.png.split(',')[1],'base64'));
 for(let index=0;index<keys.length;index+=6){await page.evaluate(async keys=>{document.body.replaceChildren();for(const {key,png}of window.reviewCards.filter(x=>keys.includes(x.key))){const card=document.createElement('section'),label=document.createElement('div'),image=new Image();label.textContent=key;label.style.marginBottom='6px';image.style.width='100%';image.src=png;card.append(label,image);document.body.append(card);await image.decode();}},keys.slice(index,index+6));await page.screenshot({path:path.join(out,'league-review-'+(index/6+1)+'.png'),fullPage:true});}
 fs.writeFileSync(path.join(out,'league-material-checks.json'),JSON.stringify({passed:true,checks:checks.map(({key,frameMs,frames})=>({key,frameMs,frames:frames.map(({image,...f})=>f)}))},null,2));
 console.log(JSON.stringify({passed:true,reviewed:keys.length,maxFrameMs:Math.max(...checks.map(x=>x.frameMs))}));
}finally{if(browser)await browser.close();fixture.stdin.end();}})().catch(e=>{console.error(e);process.exitCode=1;});
