// Render the real catalog against light and dark gameplay-like backdrops.
// No Hub playback, OBS writes, audio or settings edits.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),web=path.join(root,'lib/browser_effects/web'),out=process.env.BORDER_REVIEW_ARTIFACT_DIR||path.join(root,'tmp_obs_debug');
const gameplayPath=path.join(out,'border-gameplay.png'),gameplay=fs.existsSync(gameplayPath)?'data:image/png;base64,'+fs.readFileSync(gameplayPath).toString('base64'):null;
const catalog=JSON.parse(fs.readFileSync(path.join(root,'mini projects/soundboard/browser_effects.json')));
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://materials.test/**',r=>{const n=new URL(r.request().url()).pathname.slice(1);if(!n)return r.fulfill({body:'<html><body></body></html>',contentType:'text/html'});if(!['subtle.js','muffins.js','borders.js','production.js','rave.js','mash-dance.png'].includes(n))return r.fulfill({status:404});return r.fulfill({body:fs.readFileSync(path.join(web,n)),contentType:n.endsWith('.js')?'application/javascript':'image/png'});});
 await page.goto('http://materials.test/');
 const result=await page.evaluate(async ({catalog,gameplay})=>{
  const game=new Image();if(gameplay){game.src=gameplay;await game.decode();}
  const {BorderShow}=await import('/borders.js'),{MuffinShow}=await import('/muffins.js'),{EdgeFinish}=await import('/subtle.js');
  const probe=document.createElement('canvas');probe.width=1920;probe.height=1080;const pc=probe.getContext('2d',{willReadFrequently:true});pc.fillStyle='#fff';pc.fillRect(0,0,1920,1080);new EdgeFinish().apply(pc,10);
  const alpha=(x,y)=>pc.getImageData(x,y,1,1).data[3];if(alpha(100,500)!==255||alpha(960,540)!==0||alpha(210,500)<=0||alpha(210,500)>=255)throw Error('Mask must retain solids and only feather the boundary');
  document.body.style.cssText='margin:0;background:#101924;color:#dbe9ef;font:15px Segoe UI;display:grid;grid-template-columns:repeat(3,1fr);gap:18px;padding:20px';window.cards=[];const checks=[];
  window.backdrop=(c,light=false)=>{if(gameplay){c.drawImage(game,0,0,1920,1080);return;}const g=c.createLinearGradient(0,0,1920,1080);g.addColorStop(0,light?'#94b5b7':'#172a30');g.addColorStop(.5,light?'#78955e':'#314128');g.addColorStop(1,light?'#41676c':'#1a3339');c.fillStyle=g;c.fillRect(0,0,1920,1080);c.strokeStyle=light?'#dad3a160':'#77987038';c.lineWidth=80;c.beginPath();c.moveTo(240,900);c.bezierCurveTo(420,620,1390,420,1680,180);c.stroke();for(let j=0;j<30;j++){c.fillStyle=light?'#365c4570':'#8bac6935';c.beginPath();c.ellipse(320+(j*311)%1300,200+(j*139)%630,40+j%3*15,29,0,0,Math.PI*2);c.fill();}};
  for(const [name,effect]of Object.entries(catalog)){
   const off=document.createElement('canvas');off.width=1920;off.height=1080;const c=off.getContext('2d',{willReadFrequently:true}),show=effect.renderer==='muffins'?new MuffinShow(off):new BorderShow(off);await show.ready;if(show.dancer)await show.dancer.decode();const frames=[];
   for(const t of [.75,2.5,4.8,7.1]){show.draw(t,8,{...effect,label:''});const pixels=c.getImageData(0,0,1920,1080).data;let solid=0,glass=0,painted=0,peak=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i]>20)painted++;peak=Math.max(peak,pixels[i]);if(pixels[i]>230)solid++;else if(pixels[i]>20&&pixels[i]<180)glass++;}const center=c.getImageData(240,170,1440,670).data.some((v,i)=>i%4===3&&v);frames.push({solid,glass,painted,peak,center,image:off.toDataURL()});}
   const card=document.createElement('section'),label=document.createElement('div');label.textContent=name.toUpperCase();label.style.marginBottom='8px';card.append(label);const composed=document.createElement('canvas');composed.width=1920;composed.height=1080;composed.style.cssText='width:100%;display:block';card.append(composed);document.body.append(card);show.draw(3.9,8,effect);const target=composed.getContext('2d');window.backdrop(target,window.cards.length%2===0);target.drawImage(off,0,0);window.cards.push({name,effect,card,show,composed});checks.push({name,frames});
  }return checks;
 },{catalog,gameplay});
 await page.screenshot({path:path.join(out,'sound-border-material-review.png'),fullPage:true});
 const single=await page.evaluate(()=>window.cards.find(c=>c.effect.style==='crabs').composed.toDataURL().split(',')[1]);fs.writeFileSync(path.join(out,'border-on-gameplay.png'),Buffer.from(single,'base64'));
 console.log(JSON.stringify(result.map(({name,frames})=>({name,solid:Math.max(...frames.map(f=>f.solid)),glass:Math.max(...frames.map(f=>f.glass))}))));
 // The user explicitly approved and requested preservation of the original
 // muffin/Cena artwork. Their reviewed footprint is larger than new treatments;
 // they retain their own finite budgets and the same clear-centre invariant.
 const approvedFootprints={'die die die':230000,'JOHN CENA':132000};
 const hashes=[];for(const {name,frames}of result){assert(frames.every(f=>!f.center),name+' covers gameplay');if(catalog[name].scene)assert(frames.some(f=>f.painted>750&&f.peak>=150),name+' must have visible optical detail');else assert(frames.some(f=>f.solid>300),name+' lacks readable solid details');assert(frames.every(f=>f.solid<(approvedFootprints[name]||125000)),name+' exceeds its reviewed opaque foreground budget');assert(frames.some(f=>f.glass>(catalog[name].scene?650:3000)),name+' needs readable translucent material');assert.equal(new Set(frames.map(f=>f.image)).size,4,name+' must develop through the clip');hashes.push(crypto.createHash('sha256').update(frames[2].image).digest('hex'));}
 assert.equal(new Set(hashes).size,result.length,'Catalog must have different artwork without relying on labels');
 const frames=await page.evaluate(()=>window.cards.map(({name,composed})=>({name,png:composed.toDataURL().split(',')[1]})));
 const frameDir=path.join(out,'frames');fs.mkdirSync(frameDir,{recursive:true});
 for(const {name,png}of frames)fs.writeFileSync(path.join(frameDir,name.replace(/[^a-z0-9]+/gi,'-')+'.png'),Buffer.from(png,'base64'));
 // Small review groups preserve enough scale to inspect the supporting props.
 for(let offset=0;offset<frames.length;offset+=6){const names=frames.slice(offset,offset+6).map(x=>x.name);
  await page.evaluate(names=>{document.body.style.gridTemplateColumns='repeat(2,1fr)';window.cards.forEach(x=>x.card.style.display=names.includes(x.name)?'':'none');},names);
  await page.screenshot({path:path.join(out,'review-'+String(offset/6+1).padStart(2,'0')+'.png'),fullPage:true});
 }
 await page.evaluate(()=>{document.body.style.gridTemplateColumns='repeat(3,1fr)';window.cards.forEach(x=>x.card.style.display='');});
 await page.screenshot({path:path.join(out,'sound-border-material-review.png'),fullPage:true});
 for(const [file,names]of [['sound-library-review.png',['among-us-role-reveal-sound','galaxy-meme','kaching-sound-fx','chill guy','zvuk-fotoapparata','Halo Respawn sound effect','rizz-sound-effect','yee-haw','that was smart']],['sound-cena-muffins.png',['JOHN CENA','die die die']],['sound-worlds-review.png',['dancing music','crab rave','rat dance','Pedro','Deja Vu','hype up music','anime-wow-sound-effect','dang it','im cooked']]]){
  await page.evaluate(names=>{document.body.style.gridTemplateColumns=names.length===2?'repeat(2,1fr)':'repeat(3,1fr)';window.cards.forEach(x=>x.card.style.display=names.includes(x.name)?'':'none');},names);await page.screenshot({path:path.join(out,file),fullPage:true});
 }
 fs.writeFileSync(path.join(out,'border-material-verification.json'),JSON.stringify({passed:true,soundEffects:result.length,checks:result.map(x=>({name:x.name,frames:x.frames.map(({image,...f})=>f)}))},null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,soundEffects:result.length,readableMaterials:true,centerClear:true}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
