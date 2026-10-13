// Isolated visual/causal review of the complete event catalog. No live commands.
const {chromium}=require('playwright'),{spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=process.env.LEAGUE_ENERGY_REVIEW_DIR||path.join(root,'output/league-event-energy-20261012');
fs.mkdirSync(out,{recursive:true});
const sources=['mini projects/league_api/production/web/event-relics.js','mini projects/league_api/production/web/event-art.js','mini projects/league_api/production/web/scene.js'];
const fingerprint=()=>Object.fromEntries(sources.map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex')]));
const fingerprints=fingerprint();
const fixture=spawn('py',['-3.11','-X','utf8','-u','tools/league_production_fixture.py'],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe']});
fixture.stderr.on('data',d=>process.stderr.write(d));
const endpoint=new Promise((resolve,reject)=>{let buffer='';const timer=setTimeout(()=>reject(Error('Fixture timeout')),15000);fixture.stdout.on('data',d=>{buffer+=d;const row=buffer.split(/\r?\n/).find(x=>x.startsWith('{'));if(row){clearTimeout(timer);resolve('http://127.0.0.1:'+JSON.parse(row).port);}});fixture.on('exit',code=>{clearTimeout(timer);reject(Error('Fixture exited '+code));});});
(async()=>{let browser;try{
 const base=await endpoint;browser=await chromium.launch({headless:true,channel:'chrome',args:['--mute-audio']});
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.text().startsWith('Reviewed '))console.log(m.text());});
 await page.route(base+'/review',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0;background:#101b2c;color:#f7e8cf;font:16px Segoe UI"></body>'}));
 await page.goto(base+'/review');const catalog=(await(await fetch(base+'/production/settings')).json()).catalog;
 const report=await page.evaluate(async catalog=>{
  const {ProductionScene}=await import('/production/scene.js'),L=await import('/production/event-relics.js');
  const check=(v,label)=>{if(!v)throw Error(label);};
  check(catalog.every(e=>L.leagueScore(e.key)), 'Every catalog event needs a contact score');
  check(Object.keys(L.LEAGUE_SCORES).length===catalog.length,'Score and catalog cannot drift');
  // Physical contact is independently checked against the drawn target surface.
  for(let p=0;p<=1;p+=.001){const m=L.killContactMotion(p);check(m.tipX<=m.targetFace,'Blade penetrates target');if(m.star>0)check(m.contact,'Target celebrates before contact');}
  const contact=L.killContactMotion(.43);check(contact.contact&&contact.tipX===contact.targetFace&&contact.star===0,'Blade does not touch on the impact beat');
  for(let p=.59;p<=1;p+=.001){const m=L.theaterClimbMotion(p,.59);check(m.landed&&Math.abs(m.y+m.foot-m.support)<1e-6,'Supporting climber misses top step');}
  for(const e of catalog){const beat=L.leagueScore(e.key)[3],before=L.leagueStageMotion(e.key,beat-.001),hit=L.leagueStageMotion(e.key,beat);check(!before.contact&&before.impact===0&&before.follow===0,e.key+' reacts early');check(hit.contact&&hit.approach===1&&hit.follow===0,e.key+' approach misses impact');check(L.leaguePunchlineBeat(e.key)>=beat,e.key+' caption precedes cause');
   const fullCaptionTime=(L.leaguePunchlineBeat(e.key)+.075)*.74*2;
   check(2-fullCaptionTime>=.65,e.key+' shortest duration leaves no readable payoff hold');
   for(let j=0;j<16;j++){let births=0,on=false;for(let p=0;p<=1.1;p+=.005){const s=L.theaterShardMotion(p,beat,j);if(s.visible&&!on)births++;on=s.visible;}check(births===1,e.key+' extra particle birth');}
  }
  const cv=document.createElement('canvas');cv.width=1920;cv.height=1080;const c=cv.getContext('2d',{willReadFrequently:true}),show=new ProductionScene(cv);await show.ready;
  const clean=()=>!c.getImageData(0,0,1920,1080).data.some((v,i)=>i%4===3&&v);
  const hash=()=>{const d=c.getImageData(0,0,1920,1080).data;let h=2166136261,painted=0;for(let i=0;i<d.length;i+=4){h=Math.imul(h^d[i]^d[i+1]<<8^d[i+2]<<16^d[i+3]<<24,16777619);if(d[i+3]>20)painted++;}return {h:h>>>0,painted};};
  window.reviewRows=[];const results=[];
  for(const e of [...catalog,{key:'custom_review',title:'PERSONAL CONSTELLATION',duration:3}]){
   const beat=L.leagueScore(e.key)[3],frames=[];
   const draw=(p,d=e.duration,opacity=.8)=>show.draw({enabled:true,opacity,intensity:1.15,effect:{...e,duration:d,elapsed:p*d}});
   for(const p of [.13,.28,beat*.74,Math.min(.82,(beat+.09)*.74),.70,.86]){
    draw(p);check(!c.getImageData(240,170,1440,670).data.some((v,i)=>i%4===3&&v),e.key+' gameplay covered at '+p);
    const stats=hash();check(stats.painted>500,e.key+' invisible at '+p);frames.push({...stats,p});
   }
   for(const d of [2,3,5]){
    draw(.71,d);const witness=cv.toDataURL();draw(.27,d);draw(.71,d);check(cv.toDataURL()===witness,e.key+' seeking accumulates state');
    for(const p of [0,1,1.1]){draw(p,d);check(clean(),e.key+' dirty endpoint');}
   }
   check(new Set(frames.map(f=>f.h)).size>=4,e.key+' fails to develop');
   draw(.71,e.duration,1);const full=hash();draw(.71,e.duration,.25);const low=c.getImageData(0,0,1920,1080).data;check(low.every((v,i)=>i%4!==3||v<=64),e.key+' violates strength ceiling');
   draw(.72);const png=cv.toDataURL();
   const detail=document.createElement('canvas');detail.width=660;detail.height=320;const dc=detail.getContext('2d');dc.fillStyle='#101b2c';dc.fillRect(0,0,660,320);dc.drawImage(cv,760,855,640,225,0,20,660,232);
   const start=performance.now();for(let n=0;n<20;n++)draw(.39+n*.006);const ms=(performance.now()-start)/20;
   check(ms<33.34,e.key+' exceeds 30fps draw budget: '+ms);
   results.push({key:e.key,beat,punchline:L.leaguePunchlineBeat(e.key),frameMs:ms,frames,fullPainted:full.painted});window.reviewRows.push({key:e.key,title:e.title,png,detail:detail.toDataURL()});
   if(results.length%10===0)console.log('Reviewed '+results.length+' League performances');
  }
  for(const theme of ['earth','fire','water','air','hextech','chemtech','elder']){const hashes=[];for(const elapsed of [3,7,23]){show.draw({enabled:true,opacity:.8,ambient:{theme,elapsed}});check(!c.getImageData(240,170,1440,670).data.some((v,i)=>i%4===3&&v),theme+' ambient center');hashes.push(hash().h);}check(new Set(hashes).size===3,theme+' ambient frozen');}
  const deathHashes=[];for(const elapsed of [0,4,17,60]){show.draw({enabled:true,opacity:.8,death:{elapsed,remaining:65-elapsed}});if(elapsed===0)check(clean(),'Death flashes on entrance');else{check(hash().painted>1000,'Death stops before respawn');deathHashes.push(hash().h);}}check(new Set(deathHashes).size===3,'Death hammock frozen');show.draw({enabled:true});check(clean(),'Death remains after respawn');
  return {results,contacts:['blade tip meets target before reward','all 58 impact scores reject early reactions','secondary caption after cause','single birth for each transient shard','repeatable backward/forward seeks at 2, 3 and 5 seconds']};
 },catalog);
 assert.deepEqual(errors,[]);
 const rows=await page.evaluate(()=>window.reviewRows);fs.mkdirSync(path.join(out,'frames'),{recursive:true});
 for(const row of rows){fs.writeFileSync(path.join(out,'frames',row.key+'.png'),Buffer.from(row.png.split(',')[1],'base64'));}
 for(let i=0;i<rows.length;i+=6){await page.evaluate(rows=>{document.body.innerHTML='<div style="padding:22px;font-size:24px;font-weight:800">RIFT THEATRE · EVENT PERFORMANCES</div><main style="display:grid;grid-template-columns:repeat(2,1fr);gap:18px;padding:0 22px 22px">'+rows.map(r=>`<section style="border:1px solid #375067;border-radius:14px;overflow:hidden;background:#15273a"><div style="padding:12px 18px;color:#7ee2de">${r.title} · ${r.key}</div><img style="width:100%;display:block" src="${r.png}"><img style="width:70%;display:block;margin:auto" src="${r.detail}"></section>`).join('')+'</main>';},rows.slice(i,i+6));await page.screenshot({path:path.join(out,'catalog-'+(i/6+1)+'.png'),fullPage:true});}
 assert.deepEqual(fingerprint(),fingerprints,'Renderer changed during the review; rerun against the final build');
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({passed:true,fingerprints,catalogEvents:catalog.length,customRules:1,...report},null,2));
 console.log(JSON.stringify({passed:true,events:catalog.length,customRules:1,maxFrameMs:Math.max(...report.results.map(r=>r.frameMs)),contacts:report.contacts,artifacts:out}));
}finally{if(browser)await browser.close();fixture.stdin.end();}})().catch(e=>{console.error(e);process.exitCode=1;});
