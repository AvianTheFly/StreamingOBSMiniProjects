/* Actual artists: text-free output, visible placement, background rhythm, cleanup,
   and complete personal aperture protection across every authored living lobby. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const out=path.resolve('output/lobby-background-refresh');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[],report=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:7420/lobby-motion/index.html?world=arcade&preview=1&paused=1&auto=0');
  await page.locator('canvas[data-ready=true]').waitFor();
  const ids=await page.evaluate(async()=>{const {worlds}=await import('./worlds.js');return worlds.map(w=>w.id);});
  for(const id of ids){
   const result=await page.evaluate(async id=>{
    const {loadWorld}=await import('./worlds.js'),{AmbientClock}=await import('./shared/world-motion.js');
    const world=await loadWorld(id),art=await world.createMotion().load();
    const make=(w=1920,h=1080)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;return cv;};
    const cv=make(),c=cv.getContext('2d',{willReadFrequently:true}),sheet=make(1920,Math.ceil(world.cues.length/4)*300),sc=sheet.getContext('2d');
    const text=[];c.fillText=(...args)=>text.push(args[0]);c.strokeText=(...args)=>text.push(args[0]);
    const results=[];
    for(const [index,spec] of world.cues.entries()){
     let rendered=0,visible=0,motion=0,previous=null,bounds=null;
     for(const age of [1,5,9]){
      c.clearRect(0,0,1920,1080);c.save();world.clip?.(c,spec);world.artists[spec.id](c,age,{...spec,seed:71,started:0},art);c.restore();
      const raw=c.getImageData(0,0,1920,1080).data;let total=0;for(let i=3;i<raw.length;i+=4)if(raw[i]>10)total++;
      for(const hole of world.scene.holes)c.clearRect(...hole);
      const pixels=c.getImageData(0,0,1920,1080).data;let count=0,x0=1920,y0=1080,x1=0,y1=0;
      for(let p=0;p<1920*1080;p++){if(pixels[p*4+3]>10){count++;x0=Math.min(x0,p%1920);y0=Math.min(y0,Math.floor(p/1920));x1=Math.max(x1,p%1920);y1=Math.max(y1,Math.floor(p/1920));}if(previous&&Math.abs(previous[p*4]-pixels[p*4])+Math.abs(previous[p*4+1]-pixels[p*4+1])+Math.abs(previous[p*4+2]-pixels[p*4+2])+Math.abs(previous[p*4+3]-pixels[p*4+3])>10)motion++;}
      previous=pixels;rendered+=total;visible+=count;
      if(age===5){bounds=[x0,y0,x1,y1];const tx=index%4*480,ty=Math.floor(index/4)*300;sc.drawImage(art.base,tx,ty,480,270);sc.drawImage(cv,tx,ty,480,270);sc.fillStyle='#111';sc.fillRect(tx,ty+270,480,30);sc.fillStyle='#ddd';sc.font='14px sans-serif';sc.fillText(spec.id+' / '+spec.depth,tx+10,ty+290);}
     }
     results.push({cue:spec.id,rendered,visible,ratio:visible/Math.max(1,rendered),motion,bounds});
    }
    c.clearRect(0,0,1920,1080);art.residents?.draw(c,30,[]);
    const clock=new AmbientClock(world.cues,71);let bg=0,all=0;for(let w=0;w<30;w++)for(const e of clock.plan(w)){all++;bg+=e.depth==='background';}clock.dispose();
    const image=sheet.toDataURL();art.dispose();return {id,text,results,backgroundRatio:bg/all,released:art.base.width===1,image};
   },id);
   fs.writeFileSync(path.join(out,'after-'+id+'.png'),Buffer.from(result.image.split(',')[1],'base64'));delete result.image;report.push(result);
   console.log(JSON.stringify(result));
  }
  fs.writeFileSync(path.join(out,'placement-qa.json'),JSON.stringify({report,errors},null,2));
  assert.deepEqual(errors,[]);
  for(const world of report){assert.deepEqual(world.text,[],world.id+' drew captions');assert(world.released);assert(world.backgroundRatio>.6,world.id+' foreground dominated scheduling');for(const cue of world.results){assert(cue.visible>120,world.id+'/'+cue.cue+' is not visible');assert(cue.ratio>.55,world.id+'/'+cue.cue+' is mostly hidden by live areas');assert(cue.motion>40,world.id+'/'+cue.cue+' has no visual action');}}
  // Exercise the real stage with custom apertures; no cue may paint into them.
  const holes=[[600,140,800,370],[20,290,450,510],[1500,350,300,520]];
  for(const id of ids){await page.goto('http://127.0.0.1:7420/lobby-motion/index.html?paused=1&at=35&world='+id+'&holes='+encodeURIComponent(JSON.stringify(holes)));await page.locator('canvas[data-ready=true]').waitFor();const alpha=await page.evaluate(holes=>{const c=document.querySelector('canvas').getContext('2d');return holes.map(h=>{const p=c.getImageData(...h).data;let max=0;for(let i=3;i<p.length;i+=4)max=Math.max(max,p[i]);return max;});},holes);assert.deepEqual(alpha,[0,0,0],id+' covered saved apertures');}
  console.log('All eleven lobbies: captions absent, visible environmental staging, background-weighted scheduling, motion, disposal and custom apertures passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
