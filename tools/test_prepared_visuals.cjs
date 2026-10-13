// Exact-source rendering, invalidation, memory and preparation benchmarks.
// A disposable page reads local art; it never commands OBS or acknowledges audio.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://127.0.0.1:7420/prepared-test/**',route=>{
   const name=new URL(route.request().url()).pathname.slice('/prepared-test/'.length);
   if(!name)return route.fulfill({contentType:'text/html',body:'<body></body>'});
   let file;
   if(name==='old-frame.js')file=path.join(root,'tools/display_frame_reference.mjs');
   else if(name==='display-frame.js'||name==='subtle.js')file=path.join(root,'lib/browser_effects/web',name);
   else if(name.startsWith('shared/'))file=path.join(root,'lib/browser_effects/web',name.slice(7));
   else file=path.join(root,'mini projects/scene_voice_switcher/web',name);
   return route.fulfill({body:fs.readFileSync(file),contentType:/\.m?js$/.test(file)?'application/javascript':'image/png'});
  });
  await page.goto('http://127.0.0.1:7420/prepared-test/');
  const report=await page.evaluate(async()=>{
   const old=await import('./old-frame.js'),fresh=await import('./display-frame.js');
   const canvas=()=>{const a=document.createElement('canvas');a.width=1920;a.height=1080;return a;};
   const a=canvas(),b=canvas(),ca=a.getContext('2d',{willReadFrequently:true}),cb=b.getContext('2d',{willReadFrequently:true});
   const compare=()=>{const x=ca.getImageData(0,0,1920,1080).data,y=cb.getImageData(0,0,1920,1080).data;let max=0,different=0,alphaMax=0,premultipliedMax=0,worst=null;for(let i=0;i<x.length;i+=4){alphaMax=Math.max(alphaMax,Math.abs(x[i+3]-y[i+3]));for(let j=0;j<4;j++){const d=Math.abs(x[i+j]-y[i+j]);max=Math.max(max,d);different+=d!==0;if(j<3){const z=Math.abs(x[i+j]*x[i+3]/255-y[i+j]*y[i+3]/255);if(z>premultipliedMax){premultipliedMax=z;worst={pixel:[(i/4)%1920,Math.floor(i/4/1920)],before:[...x.slice(i,i+4)],after:[...y.slice(i,i+4)]};}}}}return {max,different,alphaMax,premultipliedMax,worst};};
   const furniture=[];
   for(const rect of [[60,180,896,504],[600,140,800,370],[.5,64.25,500.5,300.75]]){
    for(const backdrop of ['transparent','#64737b']){
     for(const alpha of [1,.6]){
      for(const c of [ca,cb]){c.clearRect(0,0,1920,1080);if(backdrop!=='transparent'){c.fillStyle=backdrop;c.fillRect(0,0,1920,1080);}c.globalAlpha=alpha;}
      old.drawDisplayFrame(ca,rect);fresh.drawDisplayFrame(cb,rect);
      const result=compare();if(result.alphaMax>1||result.premultipliedMax>1)throw Error('Furniture changed '+JSON.stringify({rect,backdrop,alpha,...result}));
      furniture.push({rect,backdrop,alpha,...result});ca.globalAlpha=cb.globalAlpha=1;
     }
    }
   }
   const rect=[60,180,896,504],measure=draw=>{const start=performance.now();for(let i=0;i<80;i++){cb.clearRect(0,0,1920,1080);draw(cb,rect);cb.getImageData(48,168,1,1);}return performance.now()-start;};
   const before=[],after=[];measure(old.drawDisplayFrame);measure(fresh.drawDisplayFrame);
   for(let i=0;i<5;i++){if(i%2){after.push(measure(fresh.drawDisplayFrame));before.push(measure(old.drawDisplayFrame));}else{before.push(measure(old.drawDisplayFrame));after.push(measure(fresh.drawDisplayFrame));}}
   const median=v=>v.sort((a,b)=>a-b)[Math.floor(v.length/2)];
   const frameMs={before:median(before),after:median(after),framesPerSample:80};
   // LRU pressure retains a fixed pixel budget and discards derived resources.
   for(let i=0;i<40;i++)fresh.drawDisplayFrame(cb,[60,180,896+i,504]);
   const bounded=fresh.displayFrameCacheStatus();if(bounded.bytes>bounded.budget||bounded.entries>32)throw Error('Furniture cache unbounded');
   fresh.clearDisplayFrameCache();if(fresh.displayFrameCacheStatus().bytes)throw Error('Furniture cache retained');
   const hardware=[];
   const ga=canvas(),gb=canvas(),gca=ga.getContext('2d'),gcb=gb.getContext('2d');
   for(const recipe of [{},{dark:'#231a16',metal:'#a27334',light:'#ffd282',accent:'#57d8ef'}]){
    old.drawDisplayFrame(gca,rect,recipe);fresh.drawDisplayFrame(gcb,rect,recipe);
    const aa=gca.getImageData(0,0,1920,1080).data,bb=gcb.getImageData(0,0,1920,1080).data;
    let max=0;for(let i=0;i<aa.length;i++)max=Math.max(max,Math.abs(aa[i]-bb[i]));
    if(max>1)throw Error('GPU furniture pixels changed '+max);hardware.push({max});gca.clearRect(0,0,1920,1080);gcb.clearRect(0,0,1920,1080);
   }
   const {ScenicLayers}=await import('./subtle.js');
   const im=document.createElement('canvas');im.width=90;im.height=60;const q=im.getContext('2d');q.fillStyle='#fed8';q.fillRect(0,0,90,60);
   const scenic=new ScenicLayers({test:im.toDataURL()});await scenic.ready;
   scenic.draw(cb,'test',[{source:[0,0,1,1],target:[10,10,80,40],alpha:.3}],0);
   scenic.draw(cb,'test',[{source:[0,0,1,1],target:[110,110,80,40],alpha:1,drift:1}],1);
   if(scenic.crops.size!==1)throw Error('Placement duplicated prepared crop');
   scenic.draw(cb,'test',[{source:[0,0,1,1],target:[10,10,81,40]}],0);
   if(scenic.crops.size!==2)throw Error('Size change did not prepare new crop');
   for(let i=0;i<300;i++)scenic.draw(cb,'test',[{source:[0,0,1,1],target:[10,10,100+i,100]}],0);
   if(scenic.crops.size>256||scenic.crops.bytes>scenic.crops.budget)throw Error('Scenic surfaces unbounded');
   scenic.crops.clear();if(scenic.crops.bytes)throw Error('Scenic surfaces retained');
   const {LobbyResidents}=await import('./lobby-residents.js'),casts=[];
   for(const id of ['arcade','tavern','forge','future','sky-harbor']){
    const legacy=new LobbyResidents(id),prepared=new LobbyResidents(id);
    let start=performance.now();await legacy.load({prepared:false});const legacyMs=performance.now()-start;
    start=performance.now();await prepared.load();const preparedMs=performance.now()-start;
    for(let i=0;i<3;i++){
     const x=legacy.sprites[i],y=prepared.sprites[i];
     if(JSON.stringify(legacy.bounds[i])!==JSON.stringify(prepared.bounds[i]))throw Error('Cast bounds changed');
     const aa=x.getContext('2d').getImageData(0,0,x.width,x.height).data,bb=y.getContext('2d').getImageData(0,0,y.width,y.height).data;
     if(!aa.every((v,j)=>v===bb[j]))throw Error('Cast pixels changed '+id+' '+i);
    }
    casts.push({id,legacyMs,preparedMs,identicalParts:3});legacy.dispose();prepared.dispose();
   }
   // Failed derived data must preserve the real extraction, including late close.
   const {preparedResidents}=await import('./resident-parts.js');
   const saved=preparedResidents.arcade.sha256;preparedResidents.arcade.sha256='stale';
   const stale=new LobbyResidents('arcade');await stale.load();if(stale.sprites.length!==3)throw Error('Stale cache lost original cast');stale.dispose();preparedResidents.arcade.sha256=saved;
   const late=new LobbyResidents('arcade'),pending=late.load();late.dispose();await pending;if(late.sprites.length)throw Error('Late prepared sprites retained');
   return {furniture,hardware,frameMs,bounded,castPreparation:casts,staleFallback:true,lateCleanup:true};
  });
  assert.deepEqual(errors,[]);console.log(JSON.stringify(report,null,2));
  if(process.env.PREPARED_VISUAL_REPORT)fs.writeFileSync(process.env.PREPARED_VISUAL_REPORT,JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
