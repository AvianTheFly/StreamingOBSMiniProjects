// Finite authored-art review against the real feature routes, never live alerts.
const {chromium}=require('playwright'),{spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=process.env.BORDER_REVIEW_ARTIFACT_DIR;
if(!out)throw Error('Set BORDER_REVIEW_ARTIFACT_DIR to a review directory');
fs.mkdirSync(path.join(out,'frames'),{recursive:true});
const fixture=spawn('py',['-3.11','-X','utf8','-u','tools/celebration_fixture.py'],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe']});fixture.stderr.on('data',d=>process.stderr.write(d));
const endpoint=new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('Fixture timeout')),10000);fixture.stdout.on('data',d=>{text+=d;const row=text.split(/\r?\n/).find(s=>s.startsWith('{'));if(row){clearTimeout(timer);resolve('http://127.0.0.1:'+JSON.parse(row).port);}});fixture.on('exit',c=>{clearTimeout(timer);reject(Error('Fixture exited '+c));});});
(async()=>{let browser;try{
 const base=await endpoint;browser=await chromium.launch({headless:true,channel:'chrome',args:['--mute-audio']});
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/overlay?preview');
 const game='data:image/png;base64,'+fs.readFileSync(path.join(out,'border-gameplay.png')).toString('base64');
 await page.evaluate(async game=>{
  const {SupporterShow,artReady}=await import('/supporter_show.js'),{RaidArt}=await import('/raid_art.js'),{CheerShow}=await import('/cheer_show.js');await artReady;
  document.body.style.background=`url(${game}) center/cover`;window.reviewStage=document.getElementById('stage');reviewStage.style.cssText='opacity:1;transition:none';
  const cv=document.createElement('canvas');cv.width=1920;cv.height=1080;cv.style.cssText='position:absolute;inset:0;width:100%;height:100%';
  const raid=new RaidArt(cv),supporter=new SupporterShow(reviewStage),cheer=new CheerShow(reviewStage);
  window.paintCelebration=(kind,theme,t)=>{
   window.reviewShow?.stop?.();window.reviewShow?.clear?.();cv.remove();reviewStage.className='on';reviewStage.dataset.supportPhase='honor';
   const item={id:'review-'+kind+'-'+theme,kind,theme,name:'MoonlitMischief',count:kind==='gift'?5:2645,duration:kind==='raid'?8:kind==='cheer'?7:3.8,details:{tier:'2000',months:7,renewal:kind==='subscribe'}};
   if(kind==='raid'){reviewStage.classList.add('raid');reviewStage.append(cv);raid.start(item);raid.draw(t);window.reviewShow=raid;document.getElementById('banner').style.display='';document.getElementById('name').textContent=item.name;document.getElementById('kicker').textContent='YOUR CREW HAS LANDED';document.getElementById('detail').textContent='2,645 lovely humans';}
   else if(kind==='cheer'){document.getElementById('banner').style.display='';document.getElementById('name').textContent=item.name;cheer.start(item,{custom:{}});cheer.update(t);window.reviewShow=cheer;}
   else{document.getElementById('banner').style.display='none';supporter.start(item,{custom:{}});supporter.update(t);window.reviewShow=supporter;}
   return {canvas:kind==='raid'?cv:window.reviewShow.canvas,duration:item.duration};
  };
 },game);
 const report=[],fingerprints=[];
 for(const kind of ['subscribe','gift','raid','cheer'])for(const theme of ['crab','dragon','cat','frog']){
  const check=await page.evaluate(({kind,theme})=>{
   const {canvas,duration}=paintCelebration(kind,theme,0),art=reviewShow,c=canvas.getContext('2d'),frames=[];
   const render=t=>kind==='raid'?art.draw(t):art.update(t);
   for(const q of [.15,.32,.55,.8]){render(duration*q);const bytes=c.getImageData(0,0,1920,1080).data;let painted=0,glass=0,opaque=0,peak=0;for(let z=3;z<bytes.length;z+=4){const a=bytes[z];if(a){painted++;peak=Math.max(peak,a);if(a>10&&a<210)glass++;if(a>235)opaque++;}}
    const center=c.getImageData(240,170,1440,670).data.some((v,z)=>z%4===3&&v);frames.push({q,painted,glass,opaque,peak,center,image:canvas.toDataURL()});}
   render(0);const begins=c.getImageData(0,0,1920,1080).data.some((v,z)=>z%4===3&&v);render(duration);const ends=c.getImageData(0,0,1920,1080).data.some((v,z)=>z%4===3&&v);render(duration*.47);
   const start=performance.now();for(let z=0;z<45;z++)render(duration*(.3+z/100));const ms=(performance.now()-start)/45;render(duration*.47);
   return {frames,begins,ends,ms,duration,image:canvas.toDataURL()};
  },{kind,theme});
  assert(!check.begins&&!check.ends,'Clean entrance and exit');assert(check.frames.every(f=>!f.center),'Protected gameplay center');
  assert(check.frames.every(f=>f.painted>2000&&f.glass>2000&&f.opaque<125000),'Readable subjects with glass support, bounded footprint');
  assert(check.frames.some(f=>f.peak>230),'Foreground remains readable');assert.equal(new Set(check.frames.map(f=>f.image)).size,4,'Choreography evolves');assert(check.ms<30,'30fps frame budget');
  fingerprints.push(crypto.createHash('sha256').update(check.image).digest('hex'));report.push({kind,theme,duration:check.duration,frameMs:check.ms,frames:check.frames.map(({image,...f})=>f)});
  await page.screenshot({path:path.join(out,'frames',kind+'-'+theme+'.png')});
 }
 assert.equal(new Set(fingerprints).size,16,'All subscriber/gift/raid/cheer acts have distinct unlabeled art');
 for(const kind of ['subscribe','gift','raid','cheer']){
  const frames=['crab','dragon','cat','frog'].map(theme=>({theme,image:'data:image/png;base64,'+fs.readFileSync(path.join(out,'frames',kind+'-'+theme+'.png')).toString('base64')}));
  await page.evaluate(async({kind,frames})=>{document.body.style.cssText='margin:0;background:#111d29;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;height:1080px;gap:8px';document.body.replaceChildren();for(const f of frames){const tile=document.createElement('div');tile.style.cssText='position:relative;min-height:0';const im=new Image();im.src=f.image;await im.decode();im.style.cssText='display:block;width:100%;height:100%;object-fit:contain';tile.append(im);const label=document.createElement('span');label.textContent=kind+' / '+f.theme;label.style.cssText='position:absolute;bottom:3px;left:12px;color:#d8f6ff;background:#0d182ac9;font:14px Arial;padding:4px 8px';tile.append(label);document.body.append(tile);}}, {kind,frames});
  await page.screenshot({path:path.join(out,kind+'-contact.png')});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'celebration-material-checks.json'),JSON.stringify({passed:true,performances:report},null,2));console.log(JSON.stringify({passed:true,performances:16,maxFrameMs:Math.max(...report.map(r=>r.frameMs))}));
 }finally{if(browser)await browser.close();fixture.stdin.end();}
})().catch(e=>{console.error(e);process.exitCode=1;});
