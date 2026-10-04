// Replaceable painted skin contract and atomic failed-generation preservation.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {serve,web}=require('./spirit_fixture.cjs');
(async()=>{const fixture=await serve(),browser=await chromium.launch({headless:true,channel:'chrome'});
 try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let mode='original',sideReads=0,materialReads=0;
 const pack=JSON.parse(fs.readFileSync(path.join(web,'rigs/ram/skin-pack.json'),'utf8'));
 await page.route('**/rigs/ram/skin-pack.json',route=>{const skin=structuredClone(pack);
  if(mode==='replacement'){skin.id='replacement-contract';skin.views.find(v=>v.id==='side').file='replacement-ram-side.png';skin.material='replacement-ram-material.png';skin.views.reverse();}
  if(mode==='invalid')skin.views.pop();
  return route.fulfill({contentType:'application/json',body:JSON.stringify(skin)});});
 await page.route('**/assets/replacement-ram-side.png',route=>{sideReads++;return route.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(web,'assets',pack.views[0].file))});});
 await page.route('**/assets/replacement-ram-material.png',route=>{materialReads++;return route.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(web,'assets',pack.material))});});
 await page.goto(fixture.url);
 await page.evaluate(async()=>{const {SpiritTransition}=await import('./renderer.js');window.skinShow=await new SpiritTransition(document.createElement('canvas')).load('ram');skinShow.draw(2.05);window.oldSkin=skinShow.character;window.originalPaint=skinShow.canvas.toDataURL();});
 mode='replacement';
 const replaced=await page.evaluate(async()=>{await skinShow.load('ram');skinShow.draw(2.05);return {samePaint:originalPaint===skinShow.canvas.toDataURL(),skin:skinShow.character.parts.skin.id,oldReleased:oldSkin.disposed&&oldSkin.parts===null};});
 assert(replaced.samePaint);assert.equal(replaced.skin,'replacement-contract');assert(replaced.oldReleased);assert.equal(sideReads,1);assert.equal(materialReads,1);
 mode='invalid';
 const failed=await page.evaluate(async()=>{const current=skinShow.character;let rejected=false;try{await skinShow.load('ram');}catch{rejected=true;}
  skinShow.draw(2.05);const result={rejected,preserved:skinShow.character===current&&!current.disposed,samePaint:originalPaint===skinShow.canvas.toDataURL()};skinShow.dispose();return {...result,released:current.parts===null};});
 assert.deepEqual(failed,{rejected:true,preserved:true,samePaint:true,released:true});assert.deepEqual(errors,[]);
 console.log('Skin files and material replace independently of choreography; invalid packs preserve the current generation; replaced/disposed paint is released.');
 }finally{await browser.close();fixture.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
