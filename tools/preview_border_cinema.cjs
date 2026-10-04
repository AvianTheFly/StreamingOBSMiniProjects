// Finite visual review on an isolated fixture, with a local gameplay frame.
// Does not connect to OBS, consume live events, play audio, or write settings.
const {chromium}=require('playwright'),{spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=process.env.BORDER_REVIEW_ARTIFACT_DIR||path.join(root,'tmp_obs_debug'),web=path.join(root,'lib/browser_effects/web');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'mini projects/soundboard/browser_effects.json')));
const game='data:image/png;base64,'+fs.readFileSync(path.join(out,'border-gameplay.png')).toString('base64');
const fixture=spawn('py',['-3.11','-X','utf8','-u','tools/league_production_fixture.py'],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe']});
fixture.stderr.on('data',data=>process.stderr.write(data));
const endpoint=new Promise((resolve,reject)=>{let buffer='';const timer=setTimeout(()=>reject(Error('Fixture did not start')),10000);fixture.stdout.on('data',data=>{buffer+=data;const row=buffer.split(/\r?\n/).find(x=>x.startsWith('{'));if(row){clearTimeout(timer);resolve('http://127.0.0.1:'+JSON.parse(row).port);}});fixture.on('exit',code=>{clearTimeout(timer);reject(Error('Fixture exited '+code));});});
(async()=>{let browser;try{
 const base=await endpoint;browser=await chromium.launch({headless:true,channel:'chrome',args:['--mute-audio']});const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Preview page: '+e.message);});
 await page.route(base+'/review-sound/**',route=>{const name=new URL(route.request().url()).pathname.split('/').at(-1);if(!['borders.js','muffins.js','rave.js','production.js','subtle.js'].includes(name))return route.fulfill({status:404});route.fulfill({body:fs.readFileSync(path.join(web,name)),contentType:'application/javascript'});});
 await page.route(base+'/review-stage',r=>r.fulfill({body:'<html><body></body></html>',contentType:'text/html'}));
 await page.goto(base+'/review-stage');
 const events=(await(await fetch(base+'/production/settings')).json()).catalog;
 await page.evaluate(async({game,catalog,events,labels,seconds,hextechSequence})=>{
  const {BorderShow}=await import('/review-sound/borders.js'),{MuffinShow}=await import('/review-sound/muffins.js'),{ProductionScene}=await import('/production/scene.js');
  document.body.replaceChildren();document.body.style.cssText='margin:0;background:#111821;overflow:hidden';
  const cv=document.createElement('canvas');cv.width=1920;cv.height=1080;document.body.append(cv);const c=cv.getContext('2d'),bg=new Image();bg.src=game;await bg.decode();
  const layer=document.createElement('canvas');layer.width=1920;layer.height=1080;
  const sound=new BorderShow(layer),muffin=new MuffinShow(layer),league=new ProductionScene(layer);await Promise.all([sound.ready,muffin.ready,league.ready]);
  window.borderRender=(family,key,time)=>{
   c.drawImage(bg,0,0);let title;
   if(family==='sound'||family==='library'){const effect=catalog[key];(effect.renderer==='muffins'?muffin:sound).draw(time,seconds,effect);title=key;}
   else{const effect=events.find(e=>e.key===key);const state={enabled:true,opacity:.8,intensity:1.15,edge_width:56};if(key==='death'){state.death={elapsed:4+time,remaining:24-time};title='SOUL SANCTUARY';}else{state.effect={...effect,elapsed:time};title=effect.title;}league.draw(state);}
   if(hextechSequence&&family==='league'&&key==='dragon_hextech'){
    const effect=events.find(e=>e.key===key),elapsed=time-.35;
    league.draw({enabled:true,opacity:.8,intensity:1.15,edge_width:56,ambient:{theme:'hextech',elapsed:time+2},effect:elapsed>=0&&elapsed<effect.duration?{...effect,elapsed}:null});
   }
   c.drawImage(layer,0,0);if(!labels)return;c.save();c.font='600 17px Segoe UI';c.textAlign='center';const label=title.toUpperCase()+' / BORDER REVIEW',w=c.measureText(label).width+44;c.fillStyle='#0a1426ba';c.beginPath();c.roundRect(960-w/2,112,w,37,10);c.fill();c.fillStyle='#e1eaf5';c.fillText(label,960,137);c.restore();
  };
  window.film=async(family,keys)=>{const chunks=[],rec=new MediaRecorder(cv.captureStream(60),{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:6500000});rec.ondataavailable=e=>chunks.push(e.data);const stopped=new Promise(r=>rec.onstop=r);rec.start();const start=performance.now();await new Promise((resolve,reject)=>{const draw=now=>{try{const elapsed=Math.max(0,(now-start)/1000),index=Math.min(keys.length-1,Math.floor(elapsed/seconds));window.borderRender(family,keys[index],Math.min(seconds-.02,elapsed-index*seconds));if(elapsed<keys.length*seconds)requestAnimationFrame(draw);else resolve();}catch(error){reject(error);}};draw(performance.now());});rec.stop();await stopped;const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
 },{game,catalog,events,labels:process.env.BORDER_REVIEW_LABELS!=='0',seconds:Math.max(3,Math.min(20,Number(process.env.BORDER_REVIEW_SECONDS)||4)),hextechSequence:process.env.BORDER_HEXTECH_SEQUENCE==='1'});
 const selections=process.env.BORDER_SOUND_PREVIEWS?JSON.parse(process.env.BORDER_SOUND_PREVIEWS).map(key=>['sound',[key]]):process.env.BORDER_LEAGUE_PREVIEWS?JSON.parse(process.env.BORDER_LEAGUE_PREVIEWS).map(key=>['league',[key]]):process.env.BORDER_SOUND_PREVIEW?[['sound',[process.env.BORDER_SOUND_PREVIEW]]]:process.env.BORDER_LEGACY_TRIAL==='1'?[['sound',['JOHN CENA']],['league',['dragon_hextech']]]:[['library',['galaxy-meme','among-us-role-reveal-sound','kaching-sound-fx','Halo Respawn sound effect']],['sound',['crab rave','Deja Vu','coffin dnace','I shouldve seen that coming']],['league',['baron','dragon_hextech','death','victory']]];
 for(const [family,keys]of process.env.BORDER_HEXTECH_SEQUENCE==='1'?[['league',['dragon_hextech']]]:selections){
  for(const key of keys){await page.evaluate(({family,key,time})=>window.borderRender(family,key,time),{family,key,time:process.env.BORDER_HEXTECH_SEQUENCE==='1'?1.7:3.1});await page.screenshot({path:path.join(out,'cinema-'+family+'-'+key.replace(/[^a-z0-9]+/gi,'-')+'.png')});}
  if(process.env.BORDER_REVIEW_DETERMINISTIC==='1'){
   if(keys.length!==1)throw Error('Deterministic export requires one cue per selection');
   const seconds=Math.max(3,Math.min(20,Number(process.env.BORDER_REVIEW_SECONDS)||4));
   const frames=path.join(out,'frames-'+keys[0].replace(/[^a-z0-9]+/gi,'-'));fs.mkdirSync(frames,{recursive:true});
   for(let frame=0;frame<Math.ceil(seconds*60);frame++){
    const bytes=await page.evaluate(({family,key,time})=>{window.borderRender(family,key,time);return document.querySelector('canvas').toDataURL('image/jpeg',.88).split(',')[1];},{family,key:keys[0],time:Math.min(seconds-.001,frame/60)});
    fs.writeFileSync(path.join(frames,String(frame).padStart(5,'0')+'.jpg'),Buffer.from(bytes,'base64'));
   }
   console.log('Rendered '+keys[0]+' deterministic 60-fps frames.');continue;
  }
  let deadline;const movie=await Promise.race([page.evaluate(({family,keys})=>window.film(family,keys),{family,keys}),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Finite preview recording timed out')),45000);})]).finally(()=>clearTimeout(deadline));fs.writeFileSync(path.join(out,'border-'+family+(process.env.BORDER_SOUND_PREVIEWS||process.env.BORDER_LEAGUE_PREVIEWS?'-'+keys[0].replace(/[^a-z0-9]+/gi,'-'):'')+'-cinema.webm'),Buffer.from(movie,'base64'));console.log('Rendered '+family+' motion reel over gameplay.');
 }
 if(errors.length)throw Error(errors.join('\n'));
}finally{if(browser)await browser.close();fixture.stdin.end();}})().catch(e=>{console.error(e);process.exitCode=1;});
