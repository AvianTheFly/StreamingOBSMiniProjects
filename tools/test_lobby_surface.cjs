// Read-only real-art comparison. Optional reference stage enables exact before/after QA.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const {chromium}=require('playwright');
const base='http://127.0.0.1:7420/lobby-motion/';
const current=fs.readFileSync(path.join(__dirname,'../mini projects/scene_voice_switcher/web/stage.js'));
const reference=process.env.LOBBY_REFERENCE_STAGE?fs.readFileSync(process.env.LOBBY_REFERENCE_STAGE):null;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],results=[];
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});page.on('pageerror',e=>errors.push(e.message));
  let script=current;
  await page.route(base+'stage.js',route=>route.fulfill({body:script,contentType:'text/javascript'}));
  await page.addInitScript(()=>{
   window.fullCopies=0;const draw=CanvasRenderingContext2D.prototype.drawImage;
   CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
    if(image instanceof HTMLCanvasElement&&image.width===1920&&image.height===1080)window.fullCopies++;
    return draw.call(this,image,...args);
   };
   // The fixture reads artwork only; it does not subscribe to live commands.
   window.EventSource=class{addEventListener(){} close(){}};
  });
  await page.goto(base+'index.html?paused=1&auto=0&at=12');await page.locator('canvas[data-ready=true]').waitFor();
  const catalog=await page.evaluate(async()=>{const {worlds,loadWorld}=await import('./worlds.js');return Promise.all(worlds.map(async w=>({id:w.id,cue:(await loadWorld(w.id)).cues[0].id})));});
  const holes=[[600,140,800,370],[20,290,450,510],[1500,350,300,520]];
  for(const world of catalog){
   for(const preview of [false,...(['reef','sky-harbor'].includes(world.id)?[true]:[])]){
    const render=async source=>{
     script=source;
     await page.goto(base+`index.html?world=${world.id}&paused=1&auto=0&at=12&cue=${world.cue}&age=5${preview?'&preview=1':''}&holes=`+encodeURIComponent(JSON.stringify(holes)));
     await page.locator('canvas[data-ready=true]').waitFor();
     const copies=await page.evaluate(async()=>{
      fullCopies=0;postMessage({type:'living-lobby',automatic:false},location.origin);
      await new Promise(resolve=>setTimeout(resolve,20));return fullCopies;
     });
     if(!preview){
      const alpha=await page.evaluate(holes=>holes.map(rect=>{const a=document.querySelector('canvas').getContext('2d').getImageData(...rect).data;let max=0;for(let i=3;i<a.length;i+=4)max=Math.max(max,a[i]);return max;}),holes);
      assert(alpha.every(value=>value===0),world.id+' must preserve every transparent live area');
     }
     const pixels=await sharp(await page.locator('canvas').screenshot({omitBackground:true})).ensureAlpha().raw().toBuffer();
     await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
     return {copies,pixels};
    };
    const before=reference?await render(reference):null,after=await render(current);
    if(before){
     assert(before.pixels.equals(after.pixels),world.id+' pixels changed (preview='+preview+')');
     assert.equal(after.copies,before.copies-(preview?0:1));
    }
    results.push({world:world.id,preview,identical:before?true:null,oldCopies:before?.copies,copies:after.copies});
   }
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,results}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
