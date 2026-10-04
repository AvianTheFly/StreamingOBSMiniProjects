/* Finite, local-only About image exports. Does not touch installed OBS cards. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const catalog=require('../stream_brand/panels_v2/catalog.js');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'stream_brand','exports','panels-v2');
async function main(){
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true,channel:'chrome',args:['--disable-background-networking']});
  const stage=fs.mkdtempSync(path.join(output,'.panel-build-'));
  const assets=[];
  try{
    const page=await browser.newPage({viewport:{width:catalog.width,height:catalog.height},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const panel of catalog.panels){
      const url=pathToFileURL(path.join(root,'stream_brand','panels_v2','design.html'));url.searchParams.set('panel',panel.id);
      await page.goto(url.href);
      await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()))});
      const clipped=await page.locator('section,section *').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.left<0||r.top<0||r.right>innerWidth||r.bottom>innerHeight||(n.clientWidth>0&&n.scrollWidth>n.clientWidth+1)||(n.clientHeight>0&&n.scrollHeight>n.clientHeight+1)}).map(n=>n.textContent));
      if(clipped.length)throw Error('Clipped text '+panel.id+': '+clipped.join(', '));
      const file=panel.id+'.png';await page.screenshot({path:path.join(stage,file)});
      const bytes=fs.statSync(path.join(stage,file)).size;if(bytes>=2900000)throw Error('Panel size limit: '+file);
      assets.push({id:panel.id,file,width:catalog.width,height:catalog.height,bytes});
    }
    if(errors.length)throw Error(errors.join('\n'));
    for(const asset of assets)fs.renameSync(path.join(stage,asset.file),path.join(output,asset.file));
    fs.writeFileSync(path.join(stage,'manifest.json'),JSON.stringify({generatedArtwork:'Built-in imagegen',assets},null,2)+'\n');
    fs.renameSync(path.join(stage,'manifest.json'),path.join(output,'manifest.json'));
    const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    fs.writeFileSync(path.join(output,'index.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><title>About cards · UdyrIsABotLaner</title><style>body{margin:0;background:#101015;color:#eee;font:16px Segoe UI,sans-serif}main{padding:32px;max-width:1390px;margin:auto}h1{font:32px Georgia}p{color:#c4c4cb}.grid{display:grid;grid-template-columns:repeat(4,320px);gap:24px}img{display:block;width:320px;height:250px}a{color:#b5d8cb}.caption{font-size:12px;padding:8px 0}@media(max-width:1390px){.grid{grid-template-columns:repeat(3,320px)}}@media(max-width:1070px){.grid{grid-template-columns:repeat(2,320px)}}</style><main><h1>Eight stories. One channel.</h1><p>Distinct illustrations, integrated copy, and short clickable links. Cards shown at Twitch display size.</p><div class="grid">'+catalog.panels.map(p=>'<div><a href="'+p.id+'.png"><img src="'+p.id+'.png" alt="'+escape(p.alt)+'"></a><div class="caption">'+escape(p.title)+'</div></div>').join('')+'</div></main></html>');
    await page.setViewportSize({width:1390,height:800});await page.goto(pathToFileURL(path.join(output,'index.html')).href);
    await page.evaluate(async()=>Promise.all([...document.images].map(i=>i.decode())));
    await page.screenshot({path:path.join(output,'preview.png'),fullPage:true});
    console.log(JSON.stringify({output,assets,errors}));
  }finally{
    await browser.close();
    const resolved=path.resolve(stage);if(!resolved.startsWith(path.resolve(output)+path.sep)||!path.basename(resolved).startsWith('.panel-build-'))throw Error('Unsafe staging cleanup');
    fs.rmSync(resolved,{recursive:true,force:true});
  }
}
main().catch(e=>{console.error(e);process.exitCode=1});

