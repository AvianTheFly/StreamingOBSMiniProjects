// Finite enlarged review reel, using the actual artists and room assets.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const out=path.resolve('output/lobby-goal-audit');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:800},recordVideo:{dir:path.join(out,'video'),size:{width:1280,height:800}}});
 try{
  const page=await context.newPage();await page.goto('http://127.0.0.1:7420/lobby-motion/index.html?world=forge&preview=1&paused=1&auto=0');await page.locator('canvas[data-ready=true]').waitFor();
  await page.evaluate(async()=>{
   const {loadWorld}=await import('./worlds.js'),{guestPlaces}=await import('./game-guests.js');
   const picks=[['aurora-camp','goose','Knife goose'],['forge','climber','Getting Over It'],['sanctuary','hornet','Hornet'],['aurora-camp','kirby','Kirby'],['future','crewmate','Crewmate'],['sanctuary','boo','Boo'],['aurora-camp','creeper','Creeper'],['arcade','salvager','Salvage robot']];
   const loaded=await Promise.all(picks.map(async([id,kind,label])=>{const world=await loadWorld(id),art=await world.createMotion().load();return {world,art,kind,label,place:guestPlaces[id].find(p=>p.character===kind)};}));
   document.body.innerHTML='';document.body.style.cssText='margin:0;background:#101722;overflow:hidden';
   const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=800;canvas.style.cssText='width:1280px;height:800px';document.body.append(canvas);const c=canvas.getContext('2d');
   const base=document.createElement('canvas'),layer=document.createElement('canvas');base.width=layer.width=1920;base.height=layer.height=1080;const bc=base.getContext('2d'),lc=layer.getContext('2d');
   let stopped=false,frame=0,last=-1,start=performance.now();
   function draw(now){if(stopped)return;const elapsed=(now-start)/1000;if(elapsed>25){stopped=true;for(const row of loaded)row.art.dispose();canvas.dataset.done='true';return;}
    if(now-last>1000/24){last=now;const group=elapsed<12.5?0:1,age=elapsed%12.5;c.fillStyle='#101722';c.fillRect(0,0,1280,800);
     for(let i=0;i<4;i++){const {world,art,kind,label,place}=loaded[group*4+i];bc.clearRect(0,0,1920,1080);bc.drawImage(art.base,0,0);lc.clearRect(0,0,1920,1080);art.draw(lc,30+age,[],world.scene.holes);world.artists['game-'+kind](lc,Math.min(age,11.99),{seed:71},art);for(const hole of world.scene.holes)lc.clearRect(...hole);bc.drawImage(layer,0,0);
      const sx=Math.max(0,Math.min(1420,place.x-230)),sy=Math.max(0,Math.min(798,place.y-200)),x=i%2*640,y=Math.floor(i/2)*400;
      c.drawImage(base,sx,sy,500,281,x,y,640,360);c.fillStyle='#f0eadc';c.font='18px Segoe UI';c.fillText(label+' · '+world.label,x+16,y+386);
     }
    }frame=requestAnimationFrame(draw);
   }
   window.addEventListener('pagehide',()=>{stopped=true;cancelAnimationFrame(frame);for(const row of loaded)row.art.dispose();},{once:true});frame=requestAnimationFrame(draw);
  });
  await page.locator('canvas[data-done=true]').waitFor({timeout:35000});const video=page.video();await context.close();await video.saveAs(path.join(out,'cameo-review.webm'));console.log('Saved enlarged 25-second review of eight character performances.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
