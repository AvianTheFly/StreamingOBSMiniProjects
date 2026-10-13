// Check the delivered standalone gallery, including local media and controls.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--mute-audio','--autoplay-policy=no-user-gesture-required']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],requests=[];
  // Repeated pixel captures need a consistent readback backend. Keep exact
  // equality; avoid GPU path-cache antialiasing changing a few cached pixels.
  await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,options){return get.call(this,kind,kind==='2d'?{...options,willReadFrequently:true}:options);};});
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.goto(pathToFileURL(path.resolve(__dirname,'../output/thematic-borders/preview.html')).href);
  await page.waitForFunction(()=>window.borderPreview&&!document.querySelector('#play').disabled);
  assert.equal(await page.locator('#list .item').count(),40);
  await page.locator('#play').click();await page.waitForFunction(()=>borderPreview.audio.currentTime>.25);
  await page.locator('#play').click();const t=await page.evaluate(()=>borderPreview.audio.currentTime);
  await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>borderPreview.audio.currentTime),t);
  await page.locator('#search').fill('oh no');await page.locator('#list .item').filter({hasText:/^oh no/}).click();
  await page.waitForFunction(()=>!document.querySelector('#play').disabled);
  await page.locator('#play').click();
  await page.waitForFunction(()=>document.querySelector('#time').textContent==='Finished',{},{timeout:16000});
  await page.locator('#family').selectOption('League');await page.locator('#search').fill('');await page.locator('#search').dispatchEvent('input');
  assert.equal(await page.locator('#list .item').count(),59);
  await page.locator('#search').fill('BACK IN THE FIGHT');await page.locator('#list .item').click();await page.waitForFunction(()=>!document.querySelector('#play').disabled);
  await page.evaluate(()=>{document.querySelector('#seek').value=550;document.querySelector('#seek').dispatchEvent(new Event('input'));});
  const hash=await page.evaluate(()=>document.querySelector('canvas').toDataURL());
  await page.evaluate(()=>{borderPreview.paint(borderPreview.row.duration*.81);borderPreview.paint(borderPreview.row.duration*.55);});
  assert.equal(await page.evaluate(()=>document.querySelector('canvas').toDataURL()),hash);
  assert.equal(await page.evaluate(()=>document.querySelector('canvas').getContext('2d').getImageData(240,170,1440,670).data.some((a,i)=>i%4===3&&a)),false);
  await page.screenshot({path:path.resolve(__dirname,'../output/thematic-borders/preview-gallery.png'),fullPage:true});
  assert.deepEqual(errors,[]);assert(requests.every(u=>/^(file:|blob:|data:)/.test(u)));
  console.log('PASS standalone gallery: 40 sounds / 59 League; original oh-no ending; play, pause, seek; clear center; local files only.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
