const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:400,height:300}}),errors=[];
  let state={playing:false,title:'',artist:'',bands:Array(48).fill(0)},offline=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://spotify.test/**',route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api/state')return offline?route.abort():route.fulfill({json:state});
   const file=url.pathname==='/overlay'?'overlay.html':url.pathname.slice(1);
   return route.fulfill({body:fs.readFileSync(path.resolve(__dirname,'../mini projects/spotify/web',file)),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('http://spotify.test/overlay');
  await page.waitForTimeout(200);assert(await page.locator('#widget').isHidden());
  state={playing:true,title:'Midnight Frequency',artist:'Spotify • live on your PC',bands:Array.from({length:48},(_,i)=>.8*Math.sin(i*.17)**6),waveform:Array.from({length:128},(_,i)=>.7*Math.sin(i*.24)+.2*Math.sin(i*.61)),energy:.75,bass:.65,treble:.3,beat:.6};
  await page.waitForFunction(()=>!document.getElementById('widget').hidden);
  await page.waitForTimeout(300);
  fs.mkdirSync(path.resolve(__dirname,'../output/spotify'),{recursive:true});
  await page.screenshot({path:path.resolve(__dirname,'../output/spotify/preview.png'),omitBackground:true});
  assert.equal(await page.locator('#title').textContent(),'Midnight Frequency');
  assert.equal(await page.locator('#disc,.note,.label').count(),0,'fixed icon and now playing must be removed');
  // The installed surface is direct WebGL with a discardable drawing buffer.
  // Inspect a fresh paint in the same task; never request a second context type.
  await page.evaluate(()=>{window.readVisualPixels=()=>{
   clear();if(world.active&&!widget.hidden)present();const probe=document.createElement('canvas');probe.width=canvas.width;probe.height=canvas.height;
   const pc=probe.getContext('2d');pc.drawImage(canvas,0,0);return pc;
  };});
  const initial=await page.evaluate(()=>readVisualPixels().canvas.toDataURL());
  state={...state,bass:.03,treble:.8,energy:.18,beat:0,waveform:Array.from({length:128},(_,i)=>.1*Math.sin(i*1.1))};
  await page.waitForTimeout(400);
  assert.notEqual(await page.evaluate(()=>readVisualPixels().canvas.toDataURL()),initial,'different music must deform the geometry');
  const pixels=await page.evaluate(()=>{
   const c=readVisualPixels();
   return {inside:c.getImageData(450,165,300,360).data.filter((x,i)=>i%4===3&&x>20).length,
    corners:c.getImageData(0,0,12,660).data.some((x,i)=>i%4===3&&x)};
  });
  assert(pixels.inside>30,'interior must contain visible geometry or light particles');assert.equal(pixels.corners,false,'outside stays transparent');
  state={...state,energy:.6,bass:.35,treble:.3,beat:.25};
  const sceneCount=await page.evaluate(()=>VisualJourney.names.length);
  for(let theme=0;theme<sceneCount;theme++){
   await page.evaluate(index=>{
    journey.stage=index;journey.next=(index+1)%VisualJourney.names.length;journey.mix=0;journey.transitioning=false;journey.age=0;journey.exposure=0;
    for(let i=0;i<100;i++)world.step({...data,beat:i%15===0?.7:0,bands:data.bands.map((v,j)=>v*(i%15<3?1:.35))},1/30);
   },theme);
   await page.waitForTimeout(180);
   assert.equal(await page.locator('#widget').getAttribute('data-theme'),await page.evaluate(i=>VisualJourney.names[i],theme));
   await page.screenshot({path:path.resolve(__dirname,`../output/spotify/theme-${theme}.png`),omitBackground:true});
   const coverage=await page.evaluate(()=>readVisualPixels().getImageData(450,165,300,330).data.filter((x,i)=>i%4===3&&x>15).length);
   assert(coverage>30,`theme ${theme} needs visible interior content`);
  }
  await page.evaluate(()=>{journey.stage=0;journey.next=1;journey.mix=.8;journey.transitioning=true;});await page.waitForTimeout(100);
  assert.equal(await page.locator('#widget').getAttribute('data-theme'),'Prism drive');
  assert(Number(await page.locator('#widget').getAttribute('data-morph'))>.5,'musical activity must smoothly morph the shared shape');
  await page.screenshot({path:path.resolve(__dirname,'../output/spotify/silk-to-bloom.png'),omitBackground:true});
  const logical=await page.locator('#title').boundingBox();
  await page.setViewportSize({width:1200,height:900});
  const native=await page.locator('#title').boundingBox();
  assert(Math.abs(native.width-logical.width*3)<1,'native-resolution viewport preserves text layout');
  assert(Math.abs(native.y-logical.y*3)<1,'native-resolution viewport preserves composition');
  assert.equal(await page.locator('#visualizer').evaluate(c=>c.width===c.getBoundingClientRect().width),true,'native viewport uses one canvas pixel per screen pixel');
  await page.setViewportSize({width:400,height:300});
  state={...state,energy:0,bass:0,treble:0,beat:0,bands:Array(48).fill(0),waveform:Array(128).fill(0)};
  await page.waitForTimeout(1800);
  const held=await page.evaluate(()=>({state:world.snapshot(),pixels:readVisualPixels().canvas.toDataURL()}));
  await page.waitForTimeout(250);
  assert.deepEqual(await page.evaluate(()=>world.snapshot()),held.state,'silence holds musical history');
  assert.equal(await page.evaluate(()=>readVisualPixels().canvas.toDataURL())===held.pixels,true,'silent playback must not run a decorative animation');
  assert.equal(await page.evaluate(()=>readVisualPixels().getImageData(0,0,1200,660).data.some((v,i)=>i%4===3&&v)),false,'no captured audio means no invented visual activity');
  state={...state,energy:.6,bass:.3,treble:.2,bands:Array(48).fill(.25),waveform:Array.from({length:128},(_,i)=>Math.sin(i*.15)*.4)};
  state={...state,title:'Glow',artist:'Ari'};await page.waitForFunction(()=>document.getElementById('title').textContent==='Glow');
  assert(await page.locator('#title').evaluate(el=>el.getBoundingClientRect().width)<110,'short song pill must fit its text');
  assert(await page.locator('#artist').evaluate(el=>el.getBoundingClientRect().width)<80,'artist pill must independently fit its text');
  state={...state,title:'A very long song title that extends well beyond the available overlay width',artist:'An equally long artist name with many featured performers and collaborators'};
  await page.waitForFunction(()=>document.getElementById('title').textContent.startsWith('A very long'));
  for(const selector of ['#title','#artist']){
   const box=await page.locator(selector).evaluate(el=>({width:el.getBoundingClientRect().width,overflow:el.scrollWidth>el.clientWidth}));
   assert(box.width<=376&&box.overflow,'long metadata must stay bounded with ellipsis');
  }
  const costs=await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=400;c.height=220;const context=c.getContext('2d');context.translate(200,110);
   return ReactiveWorld.names.map((_,stage)=>{
    const simulation=new ReactiveWorld();simulation.stage=stage;simulation.next=(stage+1)%ReactiveWorld.names.length;simulation.morph=.6;simulation.transitioning=true;
    for(let i=0;i<60;i++)simulation.step(data,1/30);
    const start=performance.now();for(let i=0;i<30;i++){simulation.step(data,1/30);context.clearRect(-200,-110,400,220);simulation.paint(context);}
    return (performance.now()-start)/30;
   });
  });
  assert(Math.max(...costs)<20,'center simulation and paint must fit comfortably within a 30-fps frame');
  console.log('Center CPU ms/frame by form:',costs.map(x=>x.toFixed(2)).join(', '));
  const sweep=await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=400;c.height=220;
   const context=c.getContext('2d'),w=new ReactiveWorld();w.stage=0;
   const signal={energy:.6,bass:.2,treble:.15,pitch:.4,tonality:.8,
    bands:Array.from({length:48},(_,i)=>i<5?.65:.03),waveform:Array(128).fill(0)};
   for(let i=0;i<30;i++)w.step(signal,1/30);
   const geometry=w.strands.map(line=>line.map(p=>p.slice()));w.particles=[];
   function brightest(){
    context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,400,220);context.translate(200,110);w.paint(context);
    const pixels=context.getImageData(0,0,400,220).data,rank=[];
    for(let i=0;i<pixels.length;i+=4){
     const score=(pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722)*pixels[i+3]/255;
     if(score>1)rank.push({x:(i/4)%400,y:Math.floor(i/4/400),score});
    }
    rank.sort((a,b)=>b.score-a.score);const hot=rank.slice(0,100),total=hot.reduce((s,p)=>s+p.score,0);
    return [hot.reduce((s,p)=>s+p.x*p.score,0)/total,hot.reduce((s,p)=>s+p.y*p.score,0)/total];
   }
   const before=brightest();
   // Hold geometry still so this measures painted light transport itself,
   // independent of the shape moving or the entire canvas pulsing.
   for(let i=0;i<75;i++){w.step(signal,1/30);}
   w.strands.forEach((line,r)=>line.forEach((p,i)=>p.splice(0,3,...geometry[r][i])));
   const after=brightest();return Math.hypot(after[0]-before[0],after[1]-before[1]);
  });
  assert(sweep>10,'rendered bright region must travel across fixed geometry');
  console.log('Painted bright-region travel:',sweep.toFixed(1),'px');
  const readOnly=await page.evaluate(()=>{
   const before=JSON.stringify(world.snapshot());
   const c=document.createElement('canvas').getContext('2d');
   VisualStageRenderer.fallback(c,world,journey);
   return before===JSON.stringify(world.snapshot());
  });
  assert(readOnly,'multiple presentations must not advance or alter musical history');
  state={...state,title:'New Song',artist:'New Artist'};
  await page.waitForFunction(()=>document.getElementById('title').textContent==='New Song');
  state={...state,playing:false};await page.waitForFunction(()=>document.getElementById('widget').hidden);
  assert.equal(await page.evaluate(()=>readVisualPixels().getImageData(0,0,1200,660).data.some((x,i)=>i%4===3&&x)),false);
  state={...state,playing:true};await page.waitForFunction(()=>!document.getElementById('widget').hidden);
  offline=true;await page.waitForFunction(()=>document.getElementById('widget').hidden);
  offline=false;await page.waitForFunction(()=>!document.getElementById('widget').hidden);
  assert.deepEqual(errors,[]);console.log('PASS: transparency, title/artist changes, pause, resume, offline hide/reconnect');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
