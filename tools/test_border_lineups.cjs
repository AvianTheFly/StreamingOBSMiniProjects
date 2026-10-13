// Finite native contact/clock QA using the original-media witnesses. No Hub or OBS.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/border-lineup-audit'),web=path.join(root,'lib/browser_effects/web');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const media=JSON.parse(fs.readFileSync(path.join(root,'output/thematic-borders/media-context.json')));
const study=JSON.parse(fs.readFileSync(path.join(out,'original-timing-study.json')));
const speech=JSON.parse(fs.readFileSync(path.join(out,'speech-witnesses.json')));
const timing=JSON.parse(fs.readFileSync(path.join(root,'lib/browser_effects/art/culture-timing.json')));
for(const row of study)assert.equal(hash(fs.readFileSync(media.find(m=>m.name===row.name).path)),row.sha256,row.name);
for(const key of ['coffin','mash','balloons','raccoon','equalizer','nyan']){
 const f=study.find(r=>r.key===key).beat_fit;assert(f.supported&&f.new_rms_ms<f.old_rms_ms);
 assert.equal(timing[key].bpm,f.bpm);assert.equal(timing[key].offset,f.offset);
}
const cases=[
 ['approval',[.06,.13,.16267,.25,.46,.75],[0,310,230,310]],
 ['lizard',[.02,.08,.11267,.16,.25,.4],[0,225,230,255]],
 ['bonk',[.01,.035,.06,.12,.28267,.38],[0,195,230,305]],
 ['quack',[.04,.13,.17267,.22,.35,.55],[1725,550,195,230]],
 ['gary',[.01,.03,.06267,.2,.36,.43],[0,235,230,235]],
 ['sparkles',[.05,.18,.5,.8,1.01267,2.1],[0,285,215,235]],
 ['isolation',[.12,.48,.72,.76,1.05,1.48],[1710,440,210,220]],
 ['oops',[5.24,6.08,7.56,8.82,9.27,9.6],[1400,975,175,100]],
].map(([key,times,crop])=>({key,times,crop,...media.find(r=>(r.effect.scene||r.effect.style)===key)}));
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome',args:['--mute-audio']});try{
 const page=await browser.newPage({viewport:{width:1320,height:1050}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://lineups.test/**',r=>{const name=new URL(r.request().url()).pathname.slice(1);if(!name)return r.fulfill({contentType:'text/html',body:'<body style="margin:0;background:#182437;color:#e7ebef;font:18px Segoe UI"></body>'});assert(/^[\w.-]+$/.test(name));return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(web,name))});});
 await page.goto('http://lineups.test/');
 const report=await page.evaluate(async ({rows,witnesses,speech})=>{
  const context=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(kind,options){return context.call(this,kind,kind==='2d'?{...options,willReadFrequently:true}:options);};
  const R=await import('/rave.js'),{makeRenderer}=await import('/renderers.js');
  const check=(v,m)=>{if(!v)throw Error(m);},near=(a,b)=>Math.abs(a-b)<1e-6;
  // Independent original-media witnesses, not values derived from the drawing.
  const original=Object.fromEntries(witnesses.map(r=>[r.key,r]));
  for(const key of ['approval','lizard','quack'])check(Math.abs(R.SOUND_LINEUPS[key]-original[key].strongest_attack)<.015,'Original attack no longer matches '+key);
  check(near(R.SOUND_LINEUPS.bonk,original.bonk.pcm_energy_peak),'Bonk follows ringing rather than the first energy hit');
  check(near(R.SOUND_LINEUPS.garyOn,original.gary.first_audible)&&near(R.SOUND_LINEUPS.garyOff,original.gary.last_audible),'Gary mouth misses the measured meow');
  check(near(R.SOUND_LINEUPS.wowOn,original.sparkles.first_audible)&&near(R.SOUND_LINEUPS.wowFull,original.sparkles.strongest_attack),'Jaw misses original vocal onset/attack');
  const phrase=speech.find(r=>r.name==='leave me alone'),alone=phrase.segments.flatMap(s=>s.words).find(w=>w.word.trim().toLowerCase()==='alone!');
  check(alone.probability>.9&&R.SOUND_LINEUPS.mute>=alone.end&&R.SOUND_LINEUPS.mute-alone.end<=.08,'Mute does not answer the reliable completed phrase');
  const no=speech.find(r=>r.name==='oh no').segments.flatMap(s=>s.words).filter(w=>w.probability>.9&&w.word.trim().startsWith('no'));
  check(near(R.SOUND_LINEUPS.noLate,no[0].start)&&near(R.SOUND_LINEUPS.noFinal,no[1].start),'Acorn/caption timing differs from reliable later repetitions');
  for(const key of ['approval','lizard','bonk','quack']){
   const t=R.SOUND_LINEUPS[key],before=R.soundContactMotion(key,t-.001),at=R.soundContactMotion(key,t);
   check(!before.hit&&before.age<0&&before.approach<1,'Effect occurs before '+key+' contact');
   check(at.hit&&at.approach===1&&at.age===0,'Contact misses original attack: '+key);
  }
  for(let t=0;t<1;t+=.001){const m=R.stampLineupMotion(t);check(m.y+m.bottom<=m.paperTop+1e-6,'Stamp penetrates paper');}
  const stamp=R.stampLineupMotion(R.SOUND_LINEUPS.approval);
  check(near(stamp.y+stamp.bottom,stamp.paperTop),'Stamp hovers above paper');
  const click=R.quackLineupMotion(R.SOUND_LINEUPS.quack);
  check(near(click.cursor.x,click.target.x)&&near(click.cursor.y,click.target.y)&&click.close===0,'Quack window closes before actual pointer contact');
  for(let j=0;j<3;j++){const m=R.quackLineupMotion(R.SOUND_LINEUPS.quack+j*.03,j);check(m.escaped&&m.escape===0,'Duck teleports on birth');check(!R.quackLineupMotion(m.born-.001,j).escaped,'Duck escapes before birth');}
  const mute=R.cultureMuteMotion(R.SOUND_LINEUPS.mute/5.04);
  check(mute.clicked&&near(mute.cursor.x,mute.target.x)&&near(mute.cursor.y,mute.target.y)&&mute.release===0,'Mute relaxes before click');
  check(R.SOUND_LINEUPS.mute>=.72&&R.SOUND_LINEUPS.mute-.72<=.08,'Mute does not promptly answer the completed phrase');
  const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;const c=canvas.getContext('2d'),results=[];
  for(const row of rows){const show=makeRenderer(canvas,row.effect);await show.ready;const shots=[];
   for(const t of row.times){show.draw(t,row.duration,row.effect);check(!c.getImageData(240,170,1440,670).data.some((v,i)=>i%4===3&&v),'Gameplay covered by '+row.key+' at '+t);
    const pixels=c.getImageData(0,0,1920,1080).data.slice();show.draw(Math.min(row.duration-.01,t+.1),row.duration,row.effect);show.draw(t,row.duration,row.effect);
    check(c.getImageData(0,0,1920,1080).data.every((v,i)=>v===pixels[i]),'Backward seek differs at '+row.key+' '+t);
    const cv=document.createElement('canvas');cv.width=400;cv.height=225;const cc=cv.getContext('2d');cc.fillStyle='#182437';cc.fillRect(0,0,400,225);cc.drawImage(canvas,0,0,400,225);
    const detail=document.createElement('canvas');detail.width=400;detail.height=340;const dc=detail.getContext('2d');dc.fillStyle='#182437';dc.fillRect(0,0,400,340);const [x,y,w,h]=row.crop,s=Math.min(400/w,340/h);dc.drawImage(canvas,x,y,w,h,(400-w*s)/2,(340-h*s)/2,w*s,h*s);
    shots.push({t,image:cv.toDataURL(),detail:detail.toDataURL()});
   }
   show.clear();check(!c.getImageData(0,0,1920,1080).data.some((v,i)=>i%4===3&&v),'Cleanup failed '+row.key);results.push({key:row.key,name:row.name,shots});
  }return results;
 },{rows:cases,witnesses:study,speech});
 for(const row of report){await page.evaluate(row=>{document.body.innerHTML=`<h2 style="margin:20px">${row.name}: ORIGINAL audio seconds</h2><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:20px">${row.shots.map(s=>`<div><p>${s.t.toFixed(3)} s</p><img style="width:100%" src="${s.image}"><img style="width:100%" src="${s.detail}"></div>`).join('')}</div>`;},row);await page.screenshot({path:path.join(out,'contacts-'+row.key+'.png'),fullPage:true});}
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'contact-checks.json'),JSON.stringify({passed:true,frames:48,criticalCues:report.map(r=>({key:r.key,name:r.name,times:r.shots.map(s=>s.t)})),refinedDanceGrids:6,originalMedia:study.map(r=>({name:r.name,sha256:r.sha256})),fingerprints:{'lib/browser_effects/web/rave.js':hash(fs.readFileSync(path.join(web,'rave.js')))}},null,2));
 console.log('PASS: 48 native critical frames; stamp plane, button/bonk attacks, cursor-before-close, staggered duck births, phrase-before-mute, six measured dance grids, exact seeks and clear centers.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
