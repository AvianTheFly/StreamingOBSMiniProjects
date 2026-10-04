// Browser contract: independent choices, complete asset generations, no OBS I/O.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {serve}=require('./spirit_fixture.cjs');
(async()=>{
 const fixture=process.env.SPIRIT_PREVIEW_URL?null:await serve();
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)console.error(`Preview asset ${r.status()}: ${r.url()}`);});
  page.on('requestfailed',r=>console.error(`Preview request failed: ${r.url()} (${r.failure()?.errorText})`));
  await page.goto(process.env.SPIRIT_PREVIEW_URL||fixture.url);
  await page.waitForFunction(()=>!!window.spiritPreview);
  const result=await page.evaluate(async()=>{
   const {show,select,draw}=window.spiritPreview;
   const clips=['bear','bear-alt','turtle','turtle-alt','ram','ram-alt','phoenix','phoenix-alt'];
   for(const id of clips){await select(id);draw(3.85);if(show.clip!==id||document.querySelector('#variant').value!==id)throw Error('Wrong preview selection');}
   await select('bear');
   const pending=show.load('phoenix');show.draw(3.2);
   if(show.id!=='bear')throw Error('Incomplete asset generation was published');
   const latest=show.load('turtle');await Promise.all([pending,latest]);show.draw(4.05);
   if(show.id!=='turtle'||show.flame!==null)throw Error('Stale loading replaced the current animal');
   await select('bear');draw(0);
   return {cards:document.querySelectorAll('.card').length,clips:clips.length};
  });
  assert.equal(result.cards,4);assert.equal(result.clips,8);assert.deepEqual(errors,[]);
  await page.route('**/assets/turtle-material-*.png',route=>route.abort());
  const recovery=await page.evaluate(async()=>{
   const {show}=window.spiritPreview,before=show.character;let failed=false;
   try{await show.load('turtle');}catch{failed=true;}
   show.draw(2.2);return {failed,id:show.id,same:show.character===before,disposed:!!before.disposed,parts:before.parts.cells.length};
  });
  assert(recovery.failed);assert.equal(recovery.id,'bear');assert(recovery.same);assert.equal(recovery.disposed,false);assert.equal(recovery.parts,4);
  console.log('Four cards, eight independent previews, atomic latest selection and failed-load resource cleanup passed.');
 }finally{await browser.close();fixture?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
