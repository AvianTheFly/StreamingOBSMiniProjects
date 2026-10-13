// Finite regression audit for the reported animation resets. Fixture server only.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),web=path.join(root,'mini projects/league_api/stage_web'),out=path.join(root,'output/queue-continuity');
async function main(){
  fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:1244,height:344}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('http://queue.test/**',r=>{const p=new URL(r.request().url()).pathname,file=p==='/shared/visible-poll.js'?path.join(root,'lib/browser_effects/web/visible-poll.js'):path.join(web,p==='/stage/queue'?'queue.html':p.split('/').at(-1));return r.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':'text/html'});});
    await page.goto('http://queue.test/stage/queue?demo=1');await page.waitForFunction(()=>document.querySelector('#queueAtmosphere').dataset.artCount==='4');
    const report=await page.evaluate(async()=>{
      dispatchEvent(new PageTransitionEvent('pagehide'));
      const {themeFrame,blendCues}=await import('/stage/queue-theme.js'),{sampleWorldPose}=await import('/stage/queue-performances.js'),{paintBackground}=await import('/stage/queue-background.js');
      const canvas=document.querySelector('#queueAtmosphere'),c=canvas.getContext('2d'),themes=['bear','turtle','ram','phoenix'];
      const pixels=(theme,time,mode='normal')=>{
        const frame=mode==='selected'?{from:theme,to:theme,mix:1,cues:[{id:9,weight:1,phase:(time%45)/45,amount:Math.sin(time%45/45*Math.PI)**2}]}:themeFrame({theme,theme_mode:mode==='shuffle'?'rotate':theme,visual_seed:42},time);
        paintBackground(canvas,frame,time,true,{});return c.getImageData(760,0,448,308).data;
      };
      const difference=(a,b)=>{let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return sum/a.length/255;};
      const joins=[];
      for(const theme of themes)for(const mode of ['normal','selected','shuffle'])for(const time of [13,15,19,26,30,34,39,45,49,60,90]){
        const before=pixels(theme,time-.01,mode),after=pixels(theme,time+.01,mode);joins.push({theme,mode,time,change:difference(before,after)});
      }
      const evolving=themes.map(theme=>({theme,change:difference(pixels(theme,7,'selected'),pixels(theme,10,'selected'))}));
      const poses=Array.from({length:101},(_,i)=>sampleWorldPose(blendCues([{id:8,phase:.7,weight:1,amount:1}],[{id:11,phase:.2,weight:1,amount:1}],i/100)));
      // A run of rapid preview choices remains a bounded twelve-entry blend.
      let bounded=[];for(let i=0;i<1000;i++)bounded=blendCues(bounded,[{id:i%12,phase:.4,amount:1,weight:1}],.2);
      return {joins,evolving,poses,maxBlendEntries:bounded.length};
    });
    for(const join of report.joins)assert(join.change<.018,`Visible discontinuity at ${JSON.stringify(join)}`);
    for(const row of report.evolving)assert(row.change>.007,`${row.theme} must move substantially between moments`);
    for(let i=0;i<report.poses.length;i++){assert(Math.abs(report.poses[i][0]-(1-i/100))<1e-9);assert(Math.abs(report.poses[i][3]-i/100)<1e-9);}
    assert(report.maxBlendEntries<=12);
    // Four final art frames together, at native badge size.
    await page.evaluate(async()=>{
      const {paintBackground}=await import('/stage/queue-background.js'),{paintSpirit,paintTrack}=await import('/stage/queue-art.js');
      const original=document.querySelector('#queueCard');document.querySelector('.queue-explorer').remove();
      for(const [i,theme] of ['bear','turtle','ram','phoenix'].entries()){
        const card=i?original.cloneNode(true):original;if(i)document.body.append(card);card.dataset.theme=theme;card.style.left=(12+i%2*616)+'px';card.style.top=(12+Math.floor(i/2)*166)+'px';
        const cue={id:9,phase:.5,amount:1,weight:1},frame={from:theme,to:theme,mix:1,cues:[cue],cue};
        paintBackground(card.querySelector('#queueAtmosphere'),frame,17,true,{});paintSpirit(card.querySelector('#spirit'),theme,17,true,1,cue);paintTrack(card.querySelector('#queueTrack'),frame,17,true);
      }
    });
    await page.screenshot({path:path.join(out,'four-worlds.png'),animations:'disabled'});
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'continuity-audit.json'),JSON.stringify(report,null,2));
    console.log(`Continuity: ${report.joins.length} boundaries passed; no 13s/45s selected-act reset; continuous geometry morphs and bounded rapid selections.`);
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
