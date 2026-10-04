// Finite render-cost study. No live playback, OBS settings or competing workers.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const p=await b.newPage({viewport:{width:800,height:600}}),web=path.resolve(process.env.SPOTIFY_DEPTH_WEB||'mini projects/spotify/web');
  await p.route('http://depth.test/**',r=>{const u=new URL(r.request().url());if(u.pathname==='/api/state')return r.fulfill({json:{playing:false}});
   const file=u.pathname==='/overlay'?'overlay.html':u.pathname.slice(1);
   return r.fulfill({body:fs.readFileSync(path.join(web,file)),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});});
  await p.goto('http://depth.test/overlay');await p.waitForFunction(()=>typeof journey==='object');
  const start=Number(process.env.SPOTIFY_DEPTH_START||50)*30;
  const fixtures=JSON.parse(fs.readFileSync(process.env.SPOTIFY_DEPTH_DATA||'output/spotify/audio-study.json','utf8')).slice(start,start+240);
  const result=await p.evaluate(signals=>{
   window.fetch=()=>new Promise(()=>{});cancelAnimationFrame(frame);frame=0;widget.hidden=false;
   const stats=a=>{a.sort((x,y)=>x-y);return {median:a[a.length>>1],p90:a[Math.floor(a.length*.9)],max:a.at(-1)};};
   let depthMs=0,morphMs=0;const depth=VisualDepth.render,morph=VisualMorph.render;
   VisualDepth.render=(...args)=>{const t=performance.now();try{return depth(...args)}finally{depthMs+=performance.now()-t}};
   VisualMorph.render=(...args)=>{const t=performance.now();try{return morph(...args)}finally{morphMs+=performance.now()-t}};
   const results=[];
   const cases=[0,6,9,10,13,16].map(stage=>({stage}));cases.push({stage:6,next:9,mix:.5});
   for(const study of cases){
    journey.stage=study.stage;journey.transitioning=study.next!==undefined;
    if(journey.transitioning){journey.next=study.next;journey.mix=study.mix;}
    journey.age=0;journey.exposure=0;
    const paints=[],depths=[],morphs=[];
    for(let i=0;i<150;i++){
     const signal=signals[i];world.step(signal,1/60);journey.step(world,1/60,signal);
     depthMs=morphMs=0;clear();const t=performance.now();present();const cost=performance.now()-t;
     if(i>=30){paints.push(cost);depths.push(depthMs);morphs.push(morphMs);}
    }
    results.push({stage:journey.name,destination:journey.transitioning?VisualJourney.names[journey.next]:null,
     paintMs:stats(paints),counterpointMs:stats(depths),sculptureMs:stats(morphs),vertices:radiance.count});
   }
   const info=radiance.gl.getExtension('WEBGL_debug_renderer_info');
   return {results,renderer:info?radiance.gl.getParameter(info.UNMASKED_RENDERER_WEBGL):'unavailable',resources:radiance.resources.length};
  },fixtures);
  if(process.env.SPOTIFY_DEPTH_REPORT)fs.writeFileSync(process.env.SPOTIFY_DEPTH_REPORT,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
