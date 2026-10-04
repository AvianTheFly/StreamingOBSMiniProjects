// Every authored stage must remain visible through side, overhead and combined
// XYZ views. Exercise actual WebGL pixels, projection uniforms and face lighting.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];
  const web=path.resolve('mini projects/spotify/web');
  await page.route('http://camera.test/**',route=>{
   const u=new URL(route.request().url());if(u.pathname==='/api/state')return route.fulfill({json:{playing:false}});
   const file=u.pathname==='/overlay'?'overlay.html':u.pathname.slice(1);
   return route.fulfill({body:fs.readFileSync(path.join(web,file)),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});
  });
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://camera.test/overlay');await page.waitForFunction(()=>typeof journey==='object');
  const signal={playing:true,energy:.4,loudness:.3,beat:0,bass:.3,treble:.12,width:.5,tonality:.7,
   voice_levels:Array(8).fill(.15),bands:Array.from({length:48},(_,i)=>.04+.35*Math.sin(i*.27)**2),
   waveform:Array.from({length:128},(_,i)=>Math.sin(i*.2)*.3)};
  const results=await page.evaluate(signal=>{
   window.fetch=()=>new Promise(()=>{});cancelAnimationFrame(frame);frame=0;
   for(let i=0;i<180;i++){world.step(signal,1/60);journey.step(world,1/60,signal);}
   data=signal;widget.hidden=false;
   const probe=document.createElement('canvas');probe.width=400;probe.height=220;const pc=probe.getContext('2d');
   const poses=[[0,0,0],[.65,0,0],[0,.4,0],[.65,.35,.15],[-.65,-.35,-.15]];
   const rows=[];
   for(let stage=0;stage<VisualJourney.names.length;stage++){
    journey.stage=stage;journey.transitioning=false;let baseline;
    for(let n=0;n<poses.length;n++){
     [journey.space.yaw,journey.space.tilt,journey.space.roll]=poses[n];
     clear();present();pc.clearRect(0,0,400,220);pc.drawImage(canvas,0,0,400,220);
     const p=pc.getImageData(0,0,400,220).data;let visible=0,mass=0,difference=0;
     for(let i=0;i<p.length;i+=4){mass+=p[i+3];if(p[i+3]>12&&Math.max(p[i],p[i+1],p[i+2])>30)visible++;
      if(baseline)difference+=Math.abs(p[i+3]-baseline.p[i+3]);}
     if(n===0)baseline={p,mass};
     rows.push({stage,pose:n,visible,coverage:mass/baseline.mass,difference:difference/(400*220),
      lens:VisualDepth.camera(journey).lens,glError:radiance.gl.getError()});
    }
   }
   return {rows,resources:radiance.status().resources};
  },signal);
  assert.deepEqual(errors,[]);assert.equal(results.resources,3);
  for(const r of results.rows){
   assert.equal(r.glError,0);assert(r.visible>200&&r.coverage>.18,'3D view lost its sculpture: '+JSON.stringify(r));
   if(r.pose)assert(r.difference>.2,'real viewing angles must change visible geometry: '+JSON.stringify(r));
  }
  if(process.env.SPOTIFY_STILL_OUTPUT){
   const out=process.env.SPOTIFY_STILL_OUTPUT;fs.mkdirSync(out,{recursive:true});
   await page.addStyleTag({content:'body{background:#080d17}'});
   for(const stage of [6,9,13,16])for(const [pose,angles] of [['front',[0,0,0]],['spatial',[.6,.32,.12]]]){
    const pixels=await page.evaluate(({stage,angles})=>{
     journey.stage=stage;[journey.space.yaw,journey.space.tilt,journey.space.roll]=angles;
     widget.hidden=false;clear();present();
     // Preserve the freshly painted direct-GL pixels in this finite study;
     // screenshot timing must not require a preserved production framebuffer.
     const capture=document.createElement('canvas');capture.width=canvas.width;capture.height=canvas.height;
     const c=capture.getContext('2d');c.fillStyle='#080d17';c.fillRect(0,0,capture.width,capture.height);c.drawImage(canvas,0,0);
     return capture.toDataURL();
    },{stage,angles});
    fs.writeFileSync(path.join(out,`${stage}-${pose}.png`),Buffer.from(pixels.split(',')[1],'base64'));
   }
   fs.writeFileSync(path.join(out,'camera-gpu.json'),JSON.stringify(results,null,2));
  }
  console.log(JSON.stringify({passed:true,scenes:17,views:results.rows.length,minimumCoverage:Math.min(...results.rows.map(r=>r.coverage)),
   minimumVisiblePixels:Math.min(...results.rows.map(r=>r.visible)),resources:results.resources}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
