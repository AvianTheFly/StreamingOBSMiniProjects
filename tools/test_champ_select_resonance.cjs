// Spatial, lifecycle and cache checks against the production canvas primitives.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {draftFixture}=require('./champ_select_fixture.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage();await draftFixture(page,{});
  await page.goto('http://draft.test/champ-select?demo=1');
  await page.emulateMedia({reducedMotion:'reduce'});
  const result=await page.evaluate(async()=>{
   const {paintResonance,resonance,waveArrival}=await import('/champ-select/team-resonance.js');
   const {bindLights}=await import('/champ-select/vfx-lights.js');
   const {light}=await import('/champ-select/scene-map.js');
   const {cueResponse,LOCK}=await import('/champ-select/vfx-timing.js');
   const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
   const c=canvas.getContext('2d',{willReadFrequently:true}),tiles=[],original=document.createElement.bind(document);
   document.createElement=(tag,...args)=>{const el=original(tag,...args);if(tag==='canvas')tiles.push(el);return el;};
   const release=bindLights(c),count=(x,w)=>{const pixels=c.getImageData(x,0,w,1080).data;let n=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])n++;return n;};
   const rows=[];
   for(const theme of ['bear','turtle','ram','phoenix'])for(const enemy of [false,true]){
    const cue={kind:'lock',key:enemy?'enemies':'allies',index:2,enemy,at:0};
    c.clearRect(0,0,1920,1080);paintResonance(c,.1,theme,cue);const before=count(0,1920);
    c.clearRect(0,0,1920,1080);paintResonance(c,.6,theme,cue);
    const own=count(enemy?1178:20,722),opposite=count(enemy?20:1178,722),center=count(743,434);
    const r=resonance(theme,cue,.6),near=waveArrival(r.origin,[r.origin[0]+142,r.origin[1]]),far=waveArrival(r.origin,[r.origin[0]+284,r.origin[1]]);
    c.clearRect(0,0,1920,1080);paintResonance(c,4.3,theme,cue);
    rows.push({theme,enemy,before,own,opposite,center,expired:count(0,1920),ordered:far>near&&near>0});
   }
   for(let i=0;i<70;i++)light(c,20,20,10,10,`rgb(${i},30,40)`,.5);
   const bounded=tiles.length===32;
   const warm=tiles.length;for(let i=0;i<100;i++)light(c,20,20,10,10,'#ffdb86',.5);
   const reused=tiles.length===warm;release();
   const released=tiles.every(tile=>tile.width===1&&tile.height===1);
   document.createElement=original;
   return {rows,bounded,reused,released,immediate:cueResponse({kind:'lock'},0).hit,peak:cueResponse({kind:'lock'},LOCK.impact).hit,future:cueResponse({kind:'lock'},-.1).hit};
  });
  for(const r of result.rows){assert.equal(r.before,0);assert.ok(r.own>500);assert.equal(r.opposite,0);assert.equal(r.center,0);assert.equal(r.expired,0);assert.ok(r.ordered);}
  for(const key of ['bounded','reused','released'])assert.equal(result[key],true,key);
  assert.ok(result.immediate>0);assert.equal(result.peak,1);assert.equal(result.future,0);
  console.log('All four themes: immediate response, ordered team-only waves, expiry and bounded/released light cache passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
