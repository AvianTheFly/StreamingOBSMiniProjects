// Finite actual-stage frame pacing measurement; never connects to OBS or League.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const {draftFixture,root,feature}=require('./champ_select_fixture.cjs');
const before=process.argv.includes('--before'),output=path.resolve(root,process.argv.find(arg=>arg.startsWith('--output='))?.slice(9)||'output/champ-select-epic-v2');
const percentile=(rows,p)=>[...rows].sort((a,b)=>a-b)[Math.min(rows.length-1,Math.floor(rows.length*p))]||0;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'}),results=[];
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  await page.addInitScript(()=>{
   window.frameAudit={enabled:false,paints:0,durations:[],intervals:[],last:0};
   const clear=CanvasRenderingContext2D.prototype.clearRect;
   CanvasRenderingContext2D.prototype.clearRect=function(...args){
    if(this.canvas.classList.contains('world-motion')&&args[2]===1920)window.frameAudit.paints++;
    return clear.apply(this,args);
   };
   const raf=requestAnimationFrame;
   window.requestAnimationFrame=callback=>raf(now=>{
    const a=window.frameAudit,before=a.paints,start=performance.now();callback(now);
    if(a.enabled&&a.paints>before&&a.durations.length<1200){
     a.durations.push(performance.now()-start);if(a.last)a.intervals.push(now-a.last);a.last=now;
    }
   });
  });
  await draftFixture(page,{},before?{webRoot:path.join(output,'before-web')}:{});
  for(const theme of ['bear','turtle','ram','phoenix']){
   await page.goto(`http://draft.test/champ-select?demo=1&theme=${theme}`);
   await page.locator('#stage.art-ready').waitFor();await page.evaluate(()=>document.fonts.ready);
   await page.waitForTimeout(600);
   await page.evaluate(()=>Object.assign(window.frameAudit,{enabled:true,durations:[],intervals:[],last:0}));
   await page.waitForTimeout(1200);
   await page.getByRole('button',{name:'Lock pick',exact:true}).click();
   await page.waitForTimeout(400);
   await page.getByRole('button',{name:'Lock pick',exact:true}).click();
   await page.waitForTimeout(3600);
   const sample=await page.evaluate(()=>{window.frameAudit.enabled=false;return window.frameAudit;});
   results.push({theme,frames:sample.durations.length,paintFps:1000/(sample.intervals.reduce((a,b)=>a+b,0)/sample.intervals.length),
    callbackMeanMs:sample.durations.reduce((a,b)=>a+b,0)/sample.durations.length,
    callbackP95Ms:percentile(sample.durations,.95),intervalP95Ms:percentile(sample.intervals,.95)});
  }
  fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,before?'before-performance.json':'after-performance.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
