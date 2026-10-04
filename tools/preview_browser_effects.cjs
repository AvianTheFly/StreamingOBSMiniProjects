// Silent, isolated art review. Never triggers the Hub or changes the OBS scene.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const web=path.resolve(__dirname,'../lib/browser_effects/web');
const output=path.resolve(__dirname,'../tmp_obs_debug');
const catalog=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../mini projects/soundboard/browser_effects.json')));
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const context=await browser.newContext({viewport:{width:1920,height:1080}});
  const page=await context.newPage();
  await page.route('http://art.test/**',route=>{
   const name=new URL(route.request().url()).pathname.slice(1);
   if(!name)return route.fulfill({contentType:'text/html',body:'<html><body></body></html>'});
   if(!['production.js','rave.js','subtle.js','borders.js','muffins.js','renderers.js','mash-dance.png'].includes(name))return route.fulfill({status:404});
   return route.fulfill({body:fs.readFileSync(path.join(web,name)),contentType:name.endsWith('.js')?'application/javascript':'image/png'});
  });
  await page.goto('http://art.test/');
  const entries=Object.entries(catalog);
  await page.evaluate(async entries=>{
   const {makeRenderer}=await import('/renderers.js');
   window.cards=[];
   document.body.style.cssText='margin:0;padding:20px;background:#101522;color:#dce5f5;font-family:Bahnschrift,sans-serif;display:grid;grid-template-columns:repeat(2,1fr);gap:18px';
   for(const [name,effect]of entries){
    const card=document.createElement('section'),label=document.createElement('div');label.textContent=name.toUpperCase();label.style.cssText='font-size:15px;letter-spacing:3px;margin-bottom:8px';card.appendChild(label);
    const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;canvas.style.cssText='width:100%;display:block;background:#070c18;border-radius:12px';card.appendChild(canvas);document.body.appendChild(card);
    const show=makeRenderer(canvas,effect);if(show.dancer)await show.dancer.decode();
    show.draw(4.6,8,effect);window.cards.push({show,effect,card});
   }
  },entries);
  await page.screenshot({path:path.join(output,'all-production-borders.png'),fullPage:true});
  await page.evaluate(()=>{
   const stories=['tantrum','kitchen','meltdown','rewind','violin','spill','heartbreak','arcade','approval'];
   document.body.style.gridTemplateColumns='repeat(3,1fr)';
   window.cards.forEach(({effect,card})=>{card.style.display=stories.includes(effect.style)?'':'none';});
  });
  await page.screenshot({path:path.join(output,'unique-border-designs.png'),fullPage:true});
  // Time only draw calls, separately from screenshots and readbacks.
  const timing=await page.evaluate(()=>window.cards.map(({show,effect})=>{
   const start=performance.now();for(let i=0;i<30;i++)show.draw(2+i/30,8,effect);
   return {style:effect.style||effect.renderer,msPerFrame:Number(((performance.now()-start)/30).toFixed(2))};
  }));
  console.log(JSON.stringify(timing));
  const movie=await page.evaluate(async()=>{
   const featured=['kitchen','rewind','violin','arcade'];
   const cards=featured.map(style=>window.cards.find(x=>x.effect.style===style));
   const film=document.createElement('canvas');film.width=1920;film.height=1080;const c=film.getContext('2d');
   const chunks=[],recorder=new MediaRecorder(film.captureStream(24),{mimeType:'video/webm'});
   recorder.ondataavailable=e=>chunks.push(e.data);
   const finished=new Promise(resolve=>recorder.onstop=resolve),start=performance.now();recorder.start();
   await new Promise(resolve=>{
    function draw(now){
     const t=(now-start)/1000;c.fillStyle='#101522';c.fillRect(0,0,1920,1080);
     cards.forEach(({show,effect},i)=>{
      show.draw(Math.min(t,7.95),8,effect);const x=(i%2)*960,y=Math.floor(i/2)*540;
      c.fillStyle='#edf3ff';c.font='700 17px Bahnschrift';c.fillText(effect.label,x+22,y+27);
      c.fillStyle='#070c18';c.fillRect(x+18,y+40,924,480);c.drawImage(show.canvas,x+18,y+40,924,480);
     });
     if(t<8)requestAnimationFrame(draw);else resolve();
    }requestAnimationFrame(draw);
   });
   recorder.stop();await finished;const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());
   let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);
  });
  fs.writeFileSync(path.join(output,'unique-border-motion.webm'),Buffer.from(movie,'base64'));await context.close();
  console.log('Art review: '+path.join(output,'all-production-borders.png'));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
