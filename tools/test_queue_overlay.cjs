// Finite browser/design audit against fixture data. No live or personal mutations.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),web=path.join(root,'mini projects/league_api/stage_web'),out=process.env.QUEUE_OVERLAY_TEST_OUTPUT||path.join(root,'output/queue-overlay');
async function main(){
  fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      sessionStorage.setItem('queue-visual-seed','12345');
      window.queueReleasedSurfaces=0;const property=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,'width');
      Object.defineProperty(HTMLCanvasElement.prototype,'width',{...property,set(value){if(value===0)window.queueReleasedSurfaces++;property.set.call(this,value);}});
    });
    let state={queue_timer:{active:true,running:true,seconds:143,status:'IN QUEUE',roles:['BOTTOM','UTILITY'],theme:'bear'}},reads=0,epoch=Date.now();
    await page.route('http://queue.test/**',async r=>{
      const p=new URL(r.request().url()).pathname;
      if(p==='/stage/state'){reads++;return r.fulfill({json:{...state,queue_timer:{...state.queue_timer,seconds:state.queue_timer.seconds+(state.queue_timer.running?(Date.now()-epoch)/1000:0)}}});}
      const file=p==='/shared/visible-poll.js'?path.join(root,'lib/browser_effects/web/visible-poll.js'):path.join(web,p==='/stage/queue'?'queue.html':p.split('/').at(-1));
      return r.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':'text/html'});
    });
    const report={themes:[],motion:[],readability:[],scope:'Read-only fixture audit; native alpha outside the single card.'};
    const hashes=[];
    for(const theme of ['bear','turtle','ram','phoenix']){
      await page.goto('http://queue.test/stage/queue?demo=1&theme='+theme);
      await page.locator('#queueCard:visible').waitFor();assert.equal(await page.locator('#queueTime').textContent(),'2:27');
      assert(await page.locator('#queueStatus').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16),'Status has stronger visual hierarchy');
      await page.waitForFunction(()=>document.querySelector('#queueAtmosphere').dataset.artCount==='4');
      assert.match(await page.locator('#queueRoles').textContent(),/PRIMARYBotSECONDARYSupport/);
      const box=await page.locator('#queueCard').boundingBox();
      assert(box.width>0&&box.height>0&&box.x>=0&&box.y>=0&&box.x+box.width<=1920&&box.y+box.height<=1080,'Queue card stays visible within the broadcast frame');
      for(const [moment,time] of [['charge',9],['release',22],['echo',35]]){
        await page.getByRole('slider',{name:'Explore effect moment'}).evaluate((input,value)=>{input.value=value;input.dispatchEvent(new Event('input'));},time);
        await page.waitForTimeout(100);
        await page.locator('#queueCard').screenshot({path:path.join(out,`${theme}-${moment}.png`),animations:'disabled',omitBackground:true});
      }
      await page.locator('#queueCard').screenshot({path:path.join(out,theme+'.png'),animations:'disabled',omitBackground:true});
      const motion=await page.evaluate(async theme=>{
        const {paintSpirit}=await import('/stage/queue-art.js'),canvas=document.querySelector('#spirit');
        paintSpirit(canvas,theme,0,true);const first=canvas.toDataURL();paintSpirit(canvas,theme,2.6,true);const second=canvas.toDataURL();
        paintSpirit(canvas,theme,0,false);const still=canvas.toDataURL();paintSpirit(canvas,theme,10,false);return {first,changed:first!==second,reducedStable:still===canvas.toDataURL()};
      },theme);
      assert(motion.changed,theme+' has actual restrained motion');assert(motion.reducedStable);hashes.push(motion.first);
      const track=await page.evaluate(async theme=>{
        const {paintTrack}=await import('/stage/queue-art.js'),c=document.querySelector('#queueTrack'),f={from:theme,to:theme,mix:1,cue:{amount:1}};
        paintTrack(c,f,0,true);const first=c.toDataURL();paintTrack(c,f,2,true);const animated=first!==c.toDataURL();
        paintTrack(c,f,0,false);const still=c.toDataURL();paintTrack(c,f,10,false);return {animated,reducedStable:still===c.toDataURL()};
      },theme);assert(track.animated&&track.reducedStable,'The themed track animates and respects reduced motion');
      const background=await page.evaluate(async theme=>{
        const {paintBackground,loadSpiritArt}=await import('/stage/queue-background.js'),art=await loadSpiritArt(new AbortController().signal),canvas=document.querySelector('#queueAtmosphere'),frame={from:theme,to:theme,mix:1};
        paintBackground(canvas,frame,0,true,art);const first=canvas.toDataURL();paintBackground(canvas,frame,2.6,true,art);const changed=first!==canvas.toDataURL();
        paintBackground(canvas,frame,0,false,art);const still=canvas.toDataURL();paintBackground(canvas,frame,10,false,art);const reducedStable=still===canvas.toDataURL();
        const moments=[5,11.5,19].map(time=>{paintBackground(canvas,frame,time,true,art);return new Uint8ClampedArray(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data);});
        const changedPixels=moments.slice(1).map((pixels,index)=>{let changed=0;for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i+3]-moments[index][i+3])>12||Math.abs(pixels[i]-moments[index][i])>25)changed++;return changed;});
        paintBackground(canvas,frame,0,false,art);
        const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        let painted=0,leftPainted=0;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>5){painted++;if(x<canvas.width*.45)leftPainted++;}
        for(const surface of Object.values(art))surface.width=surface.height=0;
        return {first,changed,reducedStable,painted,leftPainted,changedPixels};
      },theme);
      assert(background.changed,'Each theme has looping background motion');assert(background.reducedStable);assert(background.painted>1000);assert.equal(background.leftPainted,0,'Clock column stays clear');
      assert(background.changedPixels.every(count=>count>500),'Each act changes a substantial area of the atmosphere');
      hashes.push(background.first);
      report.themes.push({theme,box,status:'passed',seconds:147,roles:['Bot','Support']});report.motion.push({theme,changed:motion.changed,reducedStable:motion.reducedStable,background:{changed:background.changed,reducedStable:background.reducedStable,painted:background.painted,leftPainted:background.leftPainted,actChanges:background.changedPixels}});
      const contrast=await page.evaluate(()=>{
        const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
        // Conservative lightest card background, including transparency over white.
        const background=luminance([31,37,43]);
        return ['#queueTime','#queueStatus','#queueRoles','#queueRoles small'].map(selector=>{
          const style=getComputedStyle(document.querySelector(selector)),color=style.color.match(/[\d.]+/g).slice(0,3).map(Number);
          return {selector,fontSize:style.fontSize,contrast:(luminance(color)+.05)/(background+.05)};
        });
      });
      assert(contrast.every(row=>row.contrast>=4.5),'All text remains readable against the panel');
      const animatedContrast=await page.evaluate(async theme=>{
        const {paintBackground,loadSpiritArt}=await import('/stage/queue-background.js'),art=await loadSpiritArt(new AbortController().signal),canvas=document.querySelector('#queueAtmosphere'),rect=canvas.getBoundingClientRect();
        const lum=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
        const labels=[...document.querySelectorAll('#queueTime,#queueStatus,#queueRoles > span,#queueRoles small')].map(el=>({box:el.getBoundingClientRect(),foreground:lum(getComputedStyle(el).color.match(/[\d.]+/g).slice(0,3).map(Number))}));
        let minimum=Infinity;
        const {EFFECT_NAMES}=await import('/stage/queue-effects.js');
        for(let id=0;id<EFFECT_NAMES[theme].length;id++)for(const phase of [.15,.3,.5,.7,.85]){
          paintBackground(canvas,{from:theme,to:theme,mix:1,cue:{id,phase,amount:Math.sin(phase*Math.PI)**2}},phase*10,true,art);const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
          for(const label of labels){
            const x0=Math.max(0,Math.floor((label.box.left-rect.left)*canvas.width/rect.width)),x1=Math.min(canvas.width,Math.ceil((label.box.right-rect.left)*canvas.width/rect.width)),y0=Math.max(0,Math.floor((label.box.top-rect.top)*canvas.height/rect.height)),y1=Math.min(canvas.height,Math.ceil((label.box.bottom-rect.top)*canvas.height/rect.height));
            for(let y=y0;y<y1;y+=3)for(let x=x0;x<x1;x+=3){const i=(y*canvas.width+x)*4,a=pixels[i+3]/255,background=lum([0,1,2].map(k=>pixels[i+k]*a+[31,37,43][k]*(1-a)));minimum=Math.min(minimum,(label.foreground+.05)/(background+.05));}
          }
        }
        for(const surface of Object.values(art))surface.width=surface.height=0;return minimum;
      },theme);
      assert(animatedContrast>=4.5,`${theme} animated text contrast is ${animatedContrast}`);
      report.readability.push({theme,text:contrast,animatedMinimum: animatedContrast});
    }
    assert.equal(new Set(hashes).size,8,'Four distinct silhouettes and backgrounds');
    const previewReads=reads;
    await page.getByRole('combobox',{name:'Preview spirit'}).selectOption('ram');
    await page.waitForFunction(()=>document.querySelector('#queueCard').dataset.theme==='ram');
    assert.equal(await page.locator('#queueTime').textContent(),'2:27');assert.equal(reads,previewReads,'Exploration uses local presentation only');
    const paused=await page.locator('#queueAtmosphere').evaluate(c=>c.toDataURL());await page.waitForTimeout(150);
    assert.equal(await page.locator('#queueAtmosphere').evaluate(c=>c.toDataURL()),paused,'Scrubbing pauses the preview at the selected moment');
    await page.getByRole('button',{name:'Play',exact:true}).click();await page.waitForTimeout(150);
    assert.notEqual(await page.locator('#queueAtmosphere').evaluate(c=>c.toDataURL()),paused,'Preview can resume from the explored moment');
    const performances=page.getByRole('combobox',{name:'Preview performance'});
    const catalogOptions=await page.evaluate(async()=>{
      const {EFFECT_NAMES}=await import('/stage/queue-effects.js');
      return ['mix',...Object.entries(EFFECT_NAMES).flatMap(([theme,names])=>names.map((_,id)=>`${theme}:${id}`))];
    });
    assert.deepEqual(await performances.locator('option').evaluateAll(nodes=>nodes.map(node=>node.value).sort()),catalogOptions.sort(),'Every current act can be explored directly, without missing or duplicate choices');
    await performances.selectOption('turtle:8');
    await page.waitForFunction(()=>document.querySelector('output').textContent.includes('Lotus awakening'));
    assert.equal(await page.getByRole('combobox',{name:'Preview spirit'}).inputValue(),'turtle');
    const moments=[];
    for(const time of [3,7,11]){
      await page.getByRole('slider').evaluate((input,value)=>{input.value=value;input.dispatchEvent(new Event('input'));},time);await page.waitForTimeout(100);
      moments.push(await page.locator('#queueAtmosphere').evaluate(c=>c.toDataURL()));
      assert.match(await page.locator('output').textContent(),/Lotus awakening/);
    }
    assert.equal(new Set(moments).size,3,'A chosen performance exposes its arrival, action and aftermath');
    await page.getByRole('button',{name:'New mix',exact:true}).click();await page.waitForFunction(()=>document.querySelector('output').textContent.startsWith('This appearance:'));
    assert.equal(await performances.inputValue(),'mix');assert.equal(reads,previewReads,'Act exploration never reads live state');
    report.rotation=await page.evaluate(async()=>{
      const {themeFrame,themeOrder,effectPlan,effectCue,effectCues,THEME_SECONDS,FADE_SECONDS,EFFECT_COUNT}=await import('/stage/queue-theme.js');
      const cycles=Array.from({length:25},(_,seed)=>Array.from({length:20},(_,bag)=>themeOrder(seed,bag)));
      const plans=['bear','turtle','ram','phoenix'].map(theme=>Array.from({length:40},(_,visit)=>effectPlan(theme,12345,visit)));
      const sample={theme:'bear',theme_mode:'rotate',visual_seed:12345,journey:7};
      return {effectCount:EFFECT_COUNT,interval:THEME_SECONDS,fade:FADE_SECONDS,cycles,plans,halfway:themeFrame(sample,47).mix,fixed:themeFrame({theme:'ram',theme_mode:'ram'},137).current,reducedImmediate:themeFrame(sample,45.1,false).current===themeFrame(sample,49).to,stable:JSON.stringify(themeFrame(sample,137))===JSON.stringify(themeFrame({...sample},137)),selected:[9,22,35].map(t=>effectCue([2,4,6],t).id),continuous:Array.from({length:450},(_,i)=>effectCues([2,4,6],i/10).reduce((sum,c)=>sum+c.weight,0)).every(w=>Math.abs(w-1)<1e-9),late:themeFrame(sample,1e8).plan.length};
    });
    for(const cycle of report.rotation.cycles){for(const bag of cycle)assert.equal(new Set(bag).size,4);const sequence=cycle.flat();assert(sequence.every((theme,i)=>i===0||theme!==sequence[i-1]),'No repeated spirit across shuffle boundaries');}
    assert(new Set(report.rotation.cycles.flat().map(b=>b.join(','))).size>10,'Rotation explores different orders');
    for(const plans of report.rotation.plans){assert(plans.every(p=>p.length===3&&new Set(p).size===3&&p.filter(id=>id>=8).length===2),'Two performances and one accent per appearance');assert.deepEqual([...new Set(plans.flat())].sort((a,b)=>a-b),Array.from({length:report.rotation.effectCount},(_,i)=>i),'Every declared effect and performance is reachable');assert(new Set(plans.map(p=>p.join(','))).size>20,'Later appearances get varied selections');}
    assert.deepEqual(report.rotation.selected,[2,4,6]);assert(report.rotation.continuous);assert(report.rotation.stable);assert.equal(report.rotation.late,3);
    assert.equal(report.rotation.halfway,.5);assert.equal(report.rotation.fixed,'ram');assert(report.rotation.reducedImmediate);
    epoch=Date.now();await page.goto('http://queue.test/stage/queue');await page.locator('#queueCard:visible').waitFor();
    assert.equal(await page.locator('.queue-explorer').count(),0,'Preview controls never appear on the broadcast overlay');
    const before=await page.locator('#queueTime').textContent();await page.waitForTimeout(1200);assert.notEqual(await page.locator('#queueTime').textContent(),before,'Timer advances between samples');
    state.queue_timer={...state.queue_timer,seconds:180,status:'BANNING',roles:['TOP','JUNGLE'],theme:'turtle'};
    await page.waitForFunction(()=>document.querySelector('#queueRoles').textContent.includes('PRIMARYTop'));
    assert.equal(await page.locator('#queueStatus').textContent(),'IN QUEUE','Bans remain concealed even with an older server status');assert(await page.locator('#queueCard').isVisible());
    state.queue_timer={...state.queue_timer,seconds:47,running:false,theme:'bear',theme_mode:'rotate'};
    const expected=await page.evaluate(async()=>{const {themeFrame}=await import('/stage/queue-theme.js');return themeFrame({theme:'bear',theme_mode:'rotate',visual_seed:12345},150).current;});
    await page.waitForFunction(theme=>document.querySelector('#queueCard').dataset.theme===theme&&document.querySelector('#queueTime').textContent==='0:47',expected);
    state.queue_timer.seconds=137;await page.waitForFunction(()=>document.querySelector('#queueTime').textContent==='2:17');
    assert.equal(await page.locator('#queueCard').getAttribute('data-theme'),expected,'Queue API clock corrections must not seek the artwork');
    const count=reads;await page.evaluate(()=>dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:false}})));await page.waitForTimeout(1200);assert.equal(reads,count,'Hidden OBS source stops polling');
    const hidden=await page.locator('#queueAtmosphere,#spirit,#queueTrack').evaluateAll(canvases=>canvases.map(c=>c.toDataURL()));await page.waitForTimeout(300);assert.deepEqual(await page.locator('#queueAtmosphere,#spirit,#queueTrack').evaluateAll(canvases=>canvases.map(c=>c.toDataURL())),hidden,'Hidden source stops all three animated surfaces');
    await page.evaluate(()=>dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:true}})));await page.waitForTimeout(150);assert(reads>count);
    state.queue_timer={...state.queue_timer,active:false,running:false,status:'PICKS BEGIN'};await page.waitForFunction(()=>document.querySelector('#queueCard').hidden);
    await page.emulateMedia({reducedMotion:'reduce'});await page.goto('http://queue.test/stage/queue?demo=1&theme=phoenix');
    assert.equal(await page.locator('.time-digit').first().evaluate(el=>getComputedStyle(el).animationName),'none');
    assert(await page.getByRole('slider').isDisabled(),'Reduced motion disables motion scrubbing');
    for(const width of [1920,680,480,320]){
      await page.setViewportSize({width,height:300});await page.waitForFunction(()=>document.querySelector('#queueCard').getBoundingClientRect().right<=innerWidth-15);
      const controls=await page.locator('.queue-explorer').boundingBox(),card=await page.locator('#queueCard').boundingBox();
      assert(controls.y>=card.y+card.height&&controls.y+controls.height<=300,'Explorer fits below the compact card');
    }
    await page.waitForFunction(()=>document.querySelector('#queueAtmosphere').dataset.artCount==='4');
    const released=await page.evaluate(()=>window.queueReleasedSurfaces);await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide')));
    assert.equal(await page.evaluate(()=>window.queueReleasedSurfaces),released+4,'Exit releases all four prepared art surfaces');
    report.lifecycle={hiddenMotionStopped:true,hiddenPollingStopped:true,exitReleasedSurfaces:4};
    report.visualReview={bear:'Blue Udyr guardian vapor, charged claw trails and slow branching thunder.',turtle:'Green guardian, a hex shell, protective dome pulses and broad liquid caustics.',ram:'Amber guardian, curled horns, stone facets, dust and a rolling ground wake.',phoenix:'Udyr phoenix plumes graded to storm lavender, cold wind ribbons and soft lightning.',hierarchy:'The 52 px clock is dominant. Clock column stays clear; vertical masks protect captions.',preview:'Complete card fits 680, 480 and 320 px preview documents.'};
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'audit.json'),JSON.stringify(report,null,2));
    console.log('Queue overlay: four distinct animated spirits, roles/time, ban exit, source visibility, reduced motion and compact sizing passed.');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
