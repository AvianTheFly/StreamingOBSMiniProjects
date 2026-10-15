// Disposable HTTP fixture: no OBS commands, game API calls or personal writes.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),feature=path.join(root,'mini projects/league_api'),web=path.join(feature,'stage_web');
const out=path.join(root,'output/loading-overlay');
async function main(){
  fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    let reads=0,icons=0,fail=false,state={loading:true,connected:true,roster:[],appearance:{image_url:'/stage/art/sanctuary'}};
    await page.addInitScript(()=>{
      window.loadingPaints=0;
      window.loadingDecoded=0;const bitmap=window.createImageBitmap;
      window.createImageBitmap=async(...args)=>{const image=await bitmap(...args);window.loadingDecoded++;return image;};
      const clear=CanvasRenderingContext2D.prototype.clearRect;
      CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas.id==='loadingEffects')window.loadingPaints++;return clear.apply(this,args);};
    });
    await page.route('http://loading.test/**',async route=>{
      const p=new URL(route.request().url()).pathname;
      if(p==='/stage/state'){reads++;return route.fulfill({status:fail?503:200,json:state});}
      let file;
      if(p.startsWith('/champ-select/icons/')){icons++;file=path.join(feature,'media/champions',p.split('/').at(-1));}
      else if(p.startsWith('/champ-select/portraits/'))file=path.join(feature,'media/champion-portraits',p.split('/').at(-1));
      else if(p.startsWith('/champ-select/vfx/'))file=path.join(feature,'media/champ-select/vfx',p.split('/').at(-1));
      else if(p.startsWith('/champ-select/fonts/'))file=path.join(feature,'champ_select_web/fonts',p.split('/').at(-1));
      else if(p.startsWith('/stage/art/')||p==='/match-art/game_start')file=path.join(feature,'media/match-screens/game-start.png');
      else if(p==='/shared/visible-poll.js')file=path.join(root,'lib/browser_effects/web/visible-poll.js');
      else if(p==='/shared/world-motion.js')file=path.join(root,'lib/browser_effects/web/world-motion.js');
      else file=path.join(web,p==='/stage/loading'?'index.html':p.split('/').at(-1));
      await route.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});
    });
    await page.goto('http://loading.test/stage/loading?demo=1');
    await page.waitForFunction(()=>document.querySelectorAll('.portrait img:not([hidden])').length===10);
    await page.waitForFunction(()=>window.loadingDecoded===4);
    await page.waitForTimeout(400);
    await page.screenshot({path:path.join(out,'loading-ceremony.png')});
    const first=await page.locator('#loadingEffects').evaluate(el=>el.toDataURL());
    await page.waitForTimeout(300);assert.notEqual(await page.locator('#loadingEffects').evaluate(el=>el.toDataURL()),first);
    const demoReads=reads;assert.equal(demoReads,0,'Rehearsal does not poll game state');
    await page.evaluate(()=>dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:false}})));
    await page.evaluate(async()=>{
      const {LoadingArt}=await import('/stage/loading-art.js');
      await new Promise(resolve=>{window.auditArt=new LoadingArt(()=>{if(Object.keys(window.auditArt.patches).length===4)resolve();});window.auditArt.load();});
    });
    for(const [name,time] of [['bear',6],['turtle',20],['ram',34],['phoenix',48]]){
      const motion=await page.evaluate(async({time,name})=>{
        const {paintLoading}=await import('/stage/loading-effects.js'),canvas=document.querySelector('#loadingEffects');
        const f=paintLoading(canvas,time,true,window.auditArt),first=canvas.toDataURL();
        paintLoading(canvas,time+1,true,window.auditArt);const changed=canvas.toDataURL()!==first;
        document.querySelector('#stage').style.setProperty('--spirit-color',f.color);document.querySelector('#spiritTitle').textContent=f.title;
        for(const el of document.querySelectorAll('[data-spirit]'))el.classList.toggle('active',el.dataset.spirit===name);
        return {changed,spirit:f.spirit,surfaces:Object.values(window.auditArt.patches).map(p=>[p.image.width,p.image.height])};
      },{time,name});
      assert(motion.changed);assert.equal(motion.spirit,name);assert(motion.surfaces.every(([w,h])=>w===512&&h===512));
      await page.screenshot({path:path.join(out,`ceremony-${name}.png`)});
    }
    await page.evaluate(()=>window.auditArt.dispose());
    await page.goto('http://loading.test/stage/loading');
    await page.waitForFunction(()=>!document.querySelector('#stage').hidden);
    const champs=[['Udyr',77],['Ahri',103],['Jinx',222],['Ornn',516],['Nami',267],['Lee Sin',64],['Lux',99],['Ashe',22],['Garen',86],['Braum',201]];
    state.roster=champs.map(([name,id],i)=>({name,championId:id,image:`/champ-select/icons/${id}.png`,slot:i%5,label:`Name ${i}`,role:'JUNGLE',team:i<5?'allies':'enemies'}));
    await page.waitForFunction(()=>document.querySelectorAll('.portrait img:not([hidden])').length===10);
    await page.evaluate(()=>{window.originalCards=[...document.querySelectorAll('.player')];window.originalImages=[...document.querySelectorAll('.portrait img')];});
    const iconBaseline=icons;
    for(let i=0;i<3;i++){
      state.roster[0].label=`Confirmed ${i}`;
      await page.waitForFunction(label=>document.querySelector('#allies .player span').textContent===label,state.roster[0].label);
      assert(await page.evaluate(()=>window.originalCards.every((el,i)=>el===document.querySelectorAll('.player')[i])&&window.originalImages.every((el,i)=>el===document.querySelectorAll('.portrait img')[i])));
      assert.equal(icons,iconBaseline,'Metadata never reloads known portraits');
    }
    fail=true;await page.waitForFunction(()=>document.querySelector('#loadingLabel').textContent==='RECONNECTING');
    assert.equal(await page.locator('.portrait img:not([hidden])').count(),10,'Transport failure retains complete cards');fail=false;
    state.playing=true;await page.waitForFunction(()=>document.querySelector('#loadingLabel').textContent==='MATCH READY');
    assert(await page.locator('#stage').isVisible(),'Hold remains painted after game admission');
    await page.evaluate(()=>dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:false}})));
    const hiddenReads=reads,hiddenPaints=await page.evaluate(()=>window.loadingPaints);
    await page.waitForTimeout(1100);assert.equal(reads,hiddenReads);assert.equal(await page.evaluate(()=>window.loadingPaints),hiddenPaints);
    await page.evaluate(()=>dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:true}})));
    await page.waitForFunction(count=>window.loadingPaints>count,hiddenPaints);
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);
    const still=await page.locator('#loadingEffects').evaluate(el=>el.toDataURL()),stillPaints=await page.evaluate(()=>window.loadingPaints);
    await page.waitForTimeout(400);assert.equal(await page.locator('#loadingEffects').evaluate(el=>el.toDataURL()),still);assert.equal(await page.evaluate(()=>window.loadingPaints),stillPaints);
    assert(await page.locator('.player').evaluateAll(rows=>rows.every(row=>row.scrollWidth<=row.clientWidth+1)));
    assert.equal(await page.locator('.player-info>small').first().textContent(),'JUNGLE');
    const layout=await page.evaluate(()=>{
      const boxes=selector=>[...document.querySelectorAll(selector)].map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
      return {cards:boxes('.player'),headline:boxes('.invocation')[0],footer:boxes('footer')[0]};
    });
    assert(layout.cards.every(b=>b.x>=0&&b.x+b.w<=1920&&b.y>=0&&b.y+b.h<layout.footer.y));
    assert(layout.cards.every(b=>b.x+b.w<layout.headline.x||b.x>layout.headline.x+layout.headline.w),'Readable center is separate from both team wings');
    await page.screenshot({path:path.join(out,'loading-confirmed.png')});
    await page.setViewportSize({width:960,height:540});assert.equal((await page.locator('#stage').boundingBox()).width,960);
    await page.screenshot({path:path.join(out,'loading-960.png')});
    await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false})));
    assert.equal(await page.locator('#loadingEffects').evaluate(el=>el.width),0,'Page exit releases its canvas');
    const endReads=reads;await page.waitForTimeout(700);assert.equal(reads,endReads);
    assert.deepEqual(errors,[]);console.log('Loading overlay: persistent cards, icons, motion, hidden/reduced state, held scene, scale and cleanup passed.');
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
