// Finite authored-story review. No Hub commands, OBS, microphone or timers in the artwork.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),web=path.join(root,'lib/browser_effects/web');
const out=path.join(root,'output/sound-culture');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://story.test/**',route=>{
   const name=new URL(route.request().url()).pathname.slice(1);
   if(!name)return route.fulfill({contentType:'text/html',body:'<body style="margin:0;background:#172133;color:#eee;font:16px Segoe UI"></body>'});
   if(!['rave.js','muffins.js','subtle.js'].includes(name))return route.fulfill({status:404});
   return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(web,name))});
  });
  await page.goto('http://story.test/');
  const data=await page.evaluate(async()=>{
   const {MuffinShow,muffinChoreography}=await import('/muffins.js');
   const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
   const c=canvas.getContext('2d',{willReadFrequently:true}),show=new MuffinShow(canvas);await show.ready;
   const d=6.687,cast=Array.from({length:8},(_,i)=>i),hash=()=>{let h=2166136261;for(const v of c.getImageData(0,0,1920,1080).data)h=Math.imul(h^v,16777619);return h>>>0;};
   if(cast.some(i=>muffinChoreography(6.239,d,i).dead))throw Error('Muffins die before the last lyric');
   if(cast.some(i=>!muffinChoreography(6.24,d,i).dead))throw Error('Not all eight muffins react together');
   for(let t=6.42;t<d;t+=.01)if(cast.some(i=>!muffinChoreography(t,d,i).dead||muffinChoreography(t,d,i).fall!==1))throw Error('A muffin revives or restarts dancing');
   const frames=[];
   for(const t of [1.6,2.75,4.3,6.1,6.3,6.52]){
    show.draw(t,d,{bpm:126});
    if(c.getImageData(240,170,1440,670).data.some((v,i)=>i%4===3&&v))throw Error('Muffin gag covers gameplay');
    const thumbnail=document.createElement('canvas');thumbnail.width=640;thumbnail.height=360;const tc=thumbnail.getContext('2d');tc.fillStyle='#172133';tc.fillRect(0,0,640,360);tc.drawImage(canvas,0,0,640,360);
    frames.push({t,image:thumbnail.toDataURL()});
   }
   show.draw(6.52,d,{bpm:126});const ending=hash();
   show.draw(2,d,{bpm:126});const alive=hash();
   show.draw(6.52,d,{bpm:126});if(hash()!==ending)throw Error('Final gag does not reconstruct after seeking');
   show.draw(2,d,{bpm:126});if(hash()!==alive)throw Error('Replay retains dead cast state');
   show.draw(d,d,{bpm:126});if(c.getImageData(0,0,1920,1080).data.some(v=>v))throw Error('Muffin art extends past the audio');
   return {cue:6.24,duration:d,cast:8,frames};
  });
  await page.evaluate(({frames})=>{document.body.innerHTML='<h1 style="margin:20px">Muffin Song · one performance, one punchline</h1><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:20px">'+frames.map(f=>`<section><p>${f.t.toFixed(2)} s</p><img style="width:100%" src="${f.image}"></section>`).join('')+'</div>';},data);
  await page.screenshot({path:path.join(out,'muffin-story.png'),fullPage:true});
  fs.writeFileSync(path.join(out,'muffin-final.png'),Buffer.from(data.frames.at(-1).image.split(',')[1],'base64'));
  fs.writeFileSync(path.join(out,'muffin-story.json'),JSON.stringify({...data,frames:data.frames.map(({image,...f})=>f)},null,2));
  assert.deepEqual(errors,[]);
  console.log('Muffin final lyric: eight simultaneous deaths, settled poses through the end, transparent gameplay, deterministic seeking/replay, and exact audio-end cleanup passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
