// Disposable browser audit: no live client/OBS calls or personal settings writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),feature=path.join(root,'mini projects/league_api');
const output=path.join(root,'output/champ-select-epic');
async function fixture(page,state) {
  await require('./champ_select_fixture.cjs').draftFixture(page,state);
  await page.addInitScript(()=>{
    window.drawAudit={frames:0,strokes:0,lastStrokes:0};
    const proto=CanvasRenderingContext2D.prototype,clear=proto.clearRect,stroke=proto.stroke;
    proto.clearRect=function(...args){if(this.canvas.classList.contains('world-motion')&&args[0]===0&&args[1]===0){
      drawAudit.frames++;drawAudit.lastStrokes=drawAudit.strokes;drawAudit.strokes=0;
    }return clear.apply(this,args);};
    proto.stroke=function(...args){if(this.canvas.classList.contains('world-motion'))drawAudit.strokes++;return stroke.apply(this,args);};
  });
}
const blank=()=>({championId:0,locked:false});
const sample=(id,locked=true)=>({championId:id,name:'Ahri',locked,role:'MIDDLE',image:`/champ-select/icons/${id}.png`,portrait:`/champ-select/portraits/${id}.jpg`});
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const errors=[];
  try {
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    const state={visible:true,theme:'bear',draft:{seconds:20,allies:[sample(103,false)],enemies:[],allyBans:[],enemyBans:[]},chat:[]};
    page.on('pageerror',e=>errors.push(e.message));await fixture(page,state);
    await page.goto('http://draft.test/champ-select');await page.locator('.pick.tentative').waitFor();
    const canvas=page.locator('.world-motion');
    const first=await canvas.evaluate(c=>c.toDataURL());
    const before=await page.evaluate(()=>drawAudit.frames);await page.waitForTimeout(1100);
    const frames=await page.evaluate(()=>drawAudit.frames)-before;
    assert.ok(frames>=8&&frames<=35,`bounded cadence: ${frames}`);
    assert.notEqual(await canvas.evaluate(c=>c.toDataURL()),first,'world must actually animate');
    await page.evaluate(()=>dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:false}})));
    const hidden=await page.evaluate(()=>drawAudit.frames);
    state.draft.allies[0].locked=true;await page.waitForTimeout(700);
    assert.equal(await page.evaluate(()=>drawAudit.frames),hidden,'hidden OBS source must stop drawing');
    assert.equal(await page.locator('#stage.motion-paused').count(),1);
    await page.evaluate(()=>dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:true}})));
    await page.locator('.pick.locked').waitFor();
    // Compare per-frame primitive counts with and without a new lock. Returning
    // from invisibility must only establish the current baseline.
    const base=await page.evaluate(()=>drawAudit.lastStrokes);
    state.draft.allies[0]=sample(84);
    await page.waitForFunction(()=>document.querySelector('.pick img')?.src.endsWith('/84.jpg'));
    await page.waitForTimeout(350);
    const lock=await page.evaluate(()=>drawAudit.lastStrokes);
    assert.ok(lock>base,`live lock emits a finite burst: ${base} -> ${lock}`);
    await page.waitForTimeout(4300);
    assert.ok(await page.evaluate(()=>drawAudit.lastStrokes)<=base+1,'lock burst must expire');
    // The drawing mask must use the exact theme aperture, keeping camera pixels clear.
    for(const theme of ['bear','ram','phoenix','turtle']) {
      state.theme=theme;
      await page.waitForFunction(theme=>document.querySelector('#stage').dataset.theme===theme,theme);
      assert.ok((await canvas.evaluate(c=>getComputedStyle(c).maskImage)).includes(`/masks/${theme}.svg`));
    }
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(150);
    const reducedImage=await canvas.evaluate(c=>c.toDataURL());
    await page.waitForTimeout(700);
    assert.equal(await canvas.evaluate(c=>c.toDataURL()),reducedImage,'reduced-motion composition stays static');
    state.visible=false;await page.waitForFunction(()=>document.querySelector('#stage.hidden'));
    const privateFrames=await page.evaluate(()=>drawAudit.frames);await page.waitForTimeout(600);
    assert.equal(await page.evaluate(()=>drawAudit.frames),privateFrames,'hidden draft must stop drawing');
    await page.evaluate(()=>dispatchEvent(new Event('pagehide')));const closed=await page.evaluate(()=>drawAudit.frames);
    await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>drawAudit.frames),closed);
    assert.deepEqual(errors,[]);
    await page.close();
    console.log(JSON.stringify({passed:true,framesIn1100ms:frames,boundedLockBurst:true,hiddenStops:true,reducedMotion:true,themeMasks:true,errors}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
