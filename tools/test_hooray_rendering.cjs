// Isolated actual-Chromium foil/alpha/seek regression and optional art preview.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const web=path.resolve(__dirname,'../lib/browser_effects/web');
const output=process.env.HOORAY_PREVIEW_DIR;
const duration=2.809002;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://hooray.test/**',route=>{
   const name=new URL(route.request().url()).pathname.slice(1);
   if(!name)return route.fulfill({contentType:'text/html',body:'<style>html,body{margin:0;background:transparent}canvas{display:block}</style><canvas width="1920" height="1080"></canvas>'});
   if(!['renderers.js','rave.js','borders.js','muffins.js','subtle.js','production.js'].includes(name))return route.fulfill({status:404});
   return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(web,name))});
  });
  await page.goto('http://hooray.test/');
  const results=await page.evaluate(async duration=>{
   const {makeRenderer}=await import('/renderers.js');
   const canvas=document.querySelector('canvas'),c=canvas.getContext('2d',{willReadFrequently:true});
   const show=makeRenderer(canvas,{renderer:'hooray'});await show.ready;window.show=show;
   const frames=[];
   for(const fraction of [.08,.22,.42,.65,.82,.97]){
    show.draw(fraction*duration,duration,{});
    const first=canvas.toDataURL(),data=c.getImageData(0,0,1920,1080).data;
    let painted=0,central=0,green=0,edge=0,solid=0;
    for(let i=0;i<data.length;i+=4){
     if(!data[i+3])continue;painted++;if(data[i+3]>230)solid++;
     const x=(i/4)%1920,y=Math.floor(i/4/1920);
     if(x>400&&x<1520&&y>220&&y<820)central++;
     if(x<55||x>1865||y<55||y>1025)edge++;
     // RGB at nearly zero alpha has coarse premultiplication rounding; measure
     // visible fringe colors, where browser compositing retains hue accurately.
     if(data[i+3]>32&&data[i+1]>data[i]+20&&data[i+1]>data[i+2]+20)green++;
    }
    show.draw(fraction*duration,duration,{});
    frames.push({fraction,painted,central,green,edge,solid,deterministic:first===canvas.toDataURL(),image:first});
   }
   show.draw(.42*duration,duration);const rewind=canvas.toDataURL()===frames[2].image;
   const cleared=[-1,0,duration,duration+1,NaN].every(t=>{show.draw(t,duration);return !c.getImageData(0,0,1920,1080).data.some((v,i)=>i%4===3&&v);});
   show.draw(.5*duration,duration);show.clear();const cancelled=!c.getImageData(0,0,1920,1080).data.some((v,i)=>i%4===3&&v);
   const start=performance.now();for(let i=0;i<90;i++)show.draw(i/90*duration,duration);
   return {frames,rewind,cleared,cancelled,msPerFrame:(performance.now()-start)/90};
  },duration);
  for(const frame of results.frames){
   assert(frame.painted>500,'foil must remain visible during the performance');
   assert(frame.painted<1920*1080*.12,'native alpha must leave at least 88% of the view completely clear');
   assert(frame.central<1120*600*.055,'central confetti must stay sparse');
   assert(frame.edge>800,'matching border accents must be visible');
   assert.equal(frame.green,0,'no green matte or green fringe');
   assert(frame.deterministic,'pause must reconstruct exactly the same frame');
  }
  assert(results.frames.some(f=>f.central>500),'confetti must reach across the picture');
  assert(results.frames.some(f=>f.solid>10000),'foil must include crisp solid pieces');
  assert.equal(new Set(results.frames.map(f=>f.image)).size,6,'performance must evolve');
  assert(results.frames.at(-1).painted<results.frames[2].painted,'ending must fade out');
  assert(results.rewind&&results.cleared&&results.cancelled,'seek, end and cancellation must preserve transparency');
  assert(results.msPerFrame<33,'bounded paint must fit the 30 FPS budget');
  if(output){
   fs.mkdirSync(output,{recursive:true});
   await page.evaluate(d=>window.show.draw(d*.42,d),duration);
   await page.screenshot({path:path.join(output,'hooray-transparent.png'),omitBackground:true});
   await page.evaluate(()=>document.body.style.background='#101827');
   await page.screenshot({path:path.join(output,'hooray-dark.png')});
   await page.evaluate(()=>document.body.style.background='#edf1f5');
   await page.screenshot({path:path.join(output,'hooray-light.png')});
   if(process.argv.includes('--frames')){
    const frames=path.join(output,'frames');fs.mkdirSync(frames,{recursive:true});
    await page.evaluate(()=>document.body.style.background='#101827');
    for(let i=0;i<Math.ceil(duration*30);i++){
     await page.evaluate(({t,duration})=>window.show.draw(t,duration),{t:i/30,duration});
     await page.screenshot({path:path.join(frames,String(i).padStart(3,'0')+'.png')});
    }
   }
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({frames:results.frames.map(({image,...frame})=>frame),rewind:results.rewind,cleared:results.cleared,cancelled:results.cancelled,msPerFrame:results.msPerFrame}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
