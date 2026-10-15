const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const {draftFixture,root,feature}=require('./champ_select_fixture.cjs');
const output=path.join(root,'output/champ-select-spirits');
async function semantics() {
  const {DraftCues}=await import(pathToFileURL(path.join(feature,'champ_select_web/draft-cues.js')));
  const c=new DraftCues(),state={visible:true,theme:'bear',generation:1,chat:[{id:'old'}],draft:{allies:[{championId:103,locked:true}],allyBans:[{championId:238,locked:true}]}};
  assert.deepEqual(c.observe(state),[],'initial roster is not a celebration');
  state.draft.allies[0].label='Changed alias';assert.deepEqual(c.observe(state),[]);
  state.draft.allies[1]={championId:84,locked:false};assert.deepEqual(c.observe(state),[]);
  state.draft.allies[1].locked=true;assert.equal(c.observe(state)[0].kind,'lock');assert.deepEqual(c.observe(state),[]);
  state.draft.allyBans.unshift({championId:555,locked:true});const ban=c.observe(state);assert.equal(ban.length,1);assert.equal(ban[0].kind,'ban');assert.equal(ban[0].championId,555);
  state.draft.allyBans.reverse();assert.deepEqual(c.observe(state),[],'reordering bans is not a new ban');
  state.chat.push({id:'new'});assert.equal(c.observe(state)[0].kind,'chat');assert.deepEqual(c.observe(state),[]);
  state.chat.reverse();assert.deepEqual(c.observe(state),[]);
  state.draft.phase='FINALIZATION';assert.equal(c.observe(state)[0].kind,'ready');
  state.generation++;state.chat.push({id:'different-draft'});assert.deepEqual(c.observe(state),[]);
  c.reset();state.draft.enemies=[{championId:157,locked:true}];assert.deepEqual(c.observe(state),[],'hidden return cannot replay old locks');
  state.visible=false;assert.deepEqual(c.observe(state),[]);
  for(let i=0;i<150;i++){state.visible=true;state.chat=[{id:String(i)}];c.observe(state);}
  assert.ok(c.chatIds.size<=80);
}
(async()=>{
  await semantics();fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
  try {
    const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:output,size:{width:1280,height:720}}});
    const page=await context.newPage();await draftFixture(page,{});page.on('pageerror',e=>errors.push(e.message));
    const results=[];
    for(const theme of ['bear','ram','phoenix','turtle']) {
      await page.goto(`http://draft.test/champ-select?demo=1&theme=${theme}`);
      await page.locator('#stage.art-ready').waitFor();
      await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.locator('select option[value=verdant]').count(),0);
      await page.locator('.demo-controls').evaluate(el=>el.style.opacity='0');
      await page.waitForTimeout(250);
      await page.screenshot({path:path.join(output,`${theme}-idle.png`)});
      const first=await page.locator('canvas').evaluate(c=>c.toDataURL());
      await page.waitForTimeout(700);assert.notEqual(first,await page.locator('canvas').evaluate(c=>c.toDataURL()));
      await page.getByRole('button',{name:'Lock pick',exact:true}).click();
      assert.equal(await page.locator('.pick.react-lock').count(),1);
      await page.waitForTimeout(790);await page.screenshot({path:path.join(output,`${theme}-lock.png`)});
      await page.waitForTimeout(1800);
      await page.getByRole('button',{name:'Ban',exact:true}).click();
      assert.equal(await page.locator('.ban.react-ban').count(),1);
      await page.waitForTimeout(200);await page.screenshot({path:path.join(output,`${theme}-ban.png`)});
      await page.waitForTimeout(1800);
      await page.getByRole('button',{name:'Chat',exact:true}).click();
      assert.equal(await page.locator('.message.new-message').count(),1);
      await page.waitForTimeout(550);await page.screenshot({path:path.join(output,`${theme}-chat.png`)});
      await page.waitForTimeout(1400);
      await page.getByRole('button',{name:'Team ready',exact:true}).click();await page.waitForTimeout(1200);
      await page.waitForTimeout(4300);
      await page.getByRole('button',{name:'Hidden detail',exact:true}).click();
      await page.waitForTimeout(5100);await page.screenshot({path:path.join(output,`${theme}-secret.png`)});
      // Source invisibility must stop the entire world and release image ownership.
      await page.evaluate(()=>dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:false}})));
      const hidden=await page.locator('canvas').evaluate(c=>c.toDataURL());await page.waitForTimeout(350);
      assert.equal(hidden,await page.locator('canvas').evaluate(c=>c.toDataURL()));
      assert.equal(await page.locator('#stage.art-ready').count(),0);
      await page.evaluate(()=>dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:true}})));
      await page.locator('#stage.art-ready').waitFor();
      await page.evaluate(()=>document.fonts.ready);
      await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(120);
      const still=await page.locator('canvas').evaluate(c=>c.toDataURL());await page.waitForTimeout(200);
      assert.equal(still,await page.locator('canvas').evaluate(c=>c.toDataURL()));
      await page.emulateMedia({reducedMotion:'no-preference'});
      results.push({theme,lock:true,ban:true,chat:true,ready:true,artLoaded:true,hiddenStops:true,reducedMotion:true});
    }
    // Cancellation during theme replacement cannot publish stale images.
    const lifetime=await page.evaluate(async()=>{
      const {WorldAssets}=await import('/champ-select/world-assets.js');const a=new WorldAssets();
      await Promise.all([a.load('bear'),a.load('turtle')]);
      const last={theme:a.theme,ready:a.ready,poses:a.poses.length};
      a.dispose();return {...last,released:a.images.length===0&&a.poses.length===0&&a.guestFrames.size===0};
    });
    assert.deepEqual(lifetime,{theme:'turtle',ready:true,poses:3,released:true});
    const secrets=await page.evaluate(async()=>{const {secretProgram}=await import('/champ-select/secret-program.js');return Array.from({length:108},(_,t)=>secretProgram('bear',t).filter(s=>s.active).length);});
    assert.ok(secrets.every(count=>count>=2&&count<=3),'two or three staggered discoveries throughout the rotation');
    const source=fs.readFileSync(path.join(feature,'champ_select_web/world-assets.js'),'utf8');
    assert.ok(!source.includes('PaintedPatch')&&!source.includes('mesh.draw'),'background artwork must not morph');
    assert.deepEqual(errors,[]);
    await context.close();await page.video().saveAs(path.join(output,'four-living-worlds.webm'));
    fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({passed:true,semantics:true,lifetime,results,errors},null,2));
    console.log('Four living worlds: artwork loaded, live lock/ban/chat/ready reactions, semantics, hidden/reduced motion and late-load disposal passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
