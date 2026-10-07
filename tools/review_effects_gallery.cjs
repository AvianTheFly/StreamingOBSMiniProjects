// Finite browser QA against an isolated read-only Hub HTTP fixture.
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const fixture=spawn('py',['-3.11','-X','utf8','-u','-c',"from lib.paths import ensure_import_paths,load_project_env;ensure_import_paths();load_project_env();from hub_ui.server import _Handler;from http.server import ThreadingHTTPServer;s=ThreadingHTTPServer(('127.0.0.1',0),_Handler);s._editor_port=8765;print(s.server_port,flush=True);s.serve_forever()"],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
let browser;
(async()=>{try{
 const port=await new Promise((resolve,reject)=>{fixture.stdout.once('data',data=>resolve(Number(String(data).trim())));fixture.once('exit',code=>reject(Error('Fixture exited '+code)));});
 const base='http://127.0.0.1:'+port;
 browser=await chromium.launch({headless:true,channel:'chrome',args:['--mute-audio']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],mutations=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.method()!=='GET')mutations.push(request.url());});
 await page.route(base+'/gallery-test',route=>route.fulfill({contentType:'text/html',body:'<html><head><link rel="stylesheet" href="/css/main.css"></head><body><main id="root"></main><script type="module">import {mount,unmount} from "/js/pages/effects-gallery.js";window.leave=unmount;mount(document.getElementById("root"));</script></body></html>'}));
 await page.goto(base+'/gallery-test');await page.waitForFunction(()=>document.querySelector('#egPlay')&&!document.querySelector('#egPlay').disabled,{timeout:30000});
 assert.equal(await page.locator('.eg-item').count(),148);
 const ids=await page.locator('.eg-item').evaluateAll(nodes=>nodes.map(node=>node.dataset.id));
 for(const id of ids){await page.locator(`[data-id="${id}"]`).click();await page.waitForFunction(()=>!document.querySelector('#egPlay').disabled,{timeout:10000});}
 for(const id of ['sound:JOHN CENA','sound:Deja Vu','sound:bonk_7zPAD7C','league:dragon_hextech','league:death','league:victory']){
  await page.locator(`[data-id="${id}"]`).click();await page.waitForFunction(()=>!document.querySelector('#egPlay').disabled);
  const pixels=await page.locator('canvas').evaluate(canvas=>canvas.getContext('2d').getImageData(0,0,1920,1080).data.filter((v,i)=>i%4===3&&v>20).length);
  assert(pixels>1000,id+' has no rendered border');
 }
 await page.locator('[data-id="sound:bonk_7zPAD7C"]').click();await page.waitForFunction(()=>!document.querySelector('#egPlay').disabled);
 await page.locator('#egPlay').click();await page.waitForFunction(()=>document.querySelector('#egPlay').textContent.includes('Pause'));
 await page.waitForFunction(()=>document.querySelector('#egPlay').textContent.includes('Resume'));
 assert.equal(await page.locator('canvas').evaluate(canvas=>canvas.getContext('2d').getImageData(0,0,1920,1080).data.some((v,i)=>i%4===3&&v)),false,'ended clears the border');
 await page.locator('[data-id="league:dragon_hextech"]').click();await page.waitForFunction(()=>!document.querySelector('#egPlay').disabled);
 await page.locator('#egPlay').click();await page.waitForTimeout(150);await page.locator('#egPlay').click();
 const paused=await page.locator('#egSeek').inputValue();await page.waitForTimeout(150);assert.equal(await page.locator('#egSeek').inputValue(),paused);
 await page.locator('#egSeek').fill('1.8');await page.locator('#egSeek').dispatchEvent('input');
 const out=path.join(root,'output/effects-gallery');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile page overflows');
 await page.locator('#egSearch').fill('hextech');assert.equal(await page.locator('.eg-item').count(),1);
 await page.evaluate(()=>window.leave());assert.equal(mutations.length,0,'private previews must issue no live commands');assert.deepEqual(errors,[]);
 console.log('148 effects; rendered sound/League examples, original-audio end, pause, scrub, search, mobile and GET-only isolation passed.');
 }finally{await browser?.close();fixture.kill();}})().catch(error=>{console.error(error);process.exitCode=1;});
