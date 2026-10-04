// Finite real-CDN validation: every installed animation, hover, bounded playback.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),pack=JSON.parse(fs.readFileSync(path.join(root,'chat_sticker_pack.json')));
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1400}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:7420/chat/');
  await page.waitForFunction(()=>document.querySelector('#providers').textContent.includes('Rave & Chaos'),null,{timeout:40000});
  const remote=await (await page.request.get('http://127.0.0.1:7420/api/chat/catalog?id=53924461')).json();
  assert.equal(Object.keys(remote.pack.emotes).length,Object.keys(pack.emotes).length);
  for(const code of pack.requested)assert.equal(remote.emotes[code].url,pack.emotes[code].url,code);
  await page.locator('.sticker-library summary').click();
  await page.locator('#sticker-category').selectOption('Rave / EDM');
  assert.equal(await page.locator('.sticker-entry').count(),60,'library uses bounded pages');
  await page.locator('#sticker-search').fill('RaveTime');
  await page.locator('.sticker-entry').first().hover();
  const frame=page.frameLocator('#preview');
  await frame.locator('.name').filter({hasText:'Sticker test'}).waitFor();
  assert(await frame.locator('.body img').count()>0,'hover previews a real animated image');
  await page.waitForTimeout(400);
  const playback=await page.locator('#sticker-list').evaluate(el=>[...el.querySelectorAll('img')].filter(img=>img.dataset.visible==='true').length);
  assert(playback>0&&playback<10,'only viewport-visible thumbnails play');
  await page.locator('.sticker-library summary').click();
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#sticker-list').evaluate(el=>[...el.querySelectorAll('img')].filter(img=>img.dataset.visible==='true').length),0);
  await page.locator('.sticker-library summary').click();
  await page.locator('#sticker-search').fill('');
  await page.locator('#sticker-category').selectOption('Spin / hyper');
  await page.locator('#sticker-list').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>[...document.querySelectorAll('#sticker-list img')].filter(img=>img.dataset.visible==='true').every(img=>img.complete&&img.naturalWidth>0));
  await page.screenshot({path:path.join(root,'tmp_obs_debug/chat-chaos-studio.png'),fullPage:true});
  if(process.argv.includes('--ui-only')){assert.deepEqual(errors,[]);console.log('PASS: live pack, hover preview, bounded visible animation, loaded thumbnails and panel cleanup.');return;}
  const assets=Object.entries(pack.emotes),results=[];
  // Decode a second frame from every file, with three concurrent decoders.
  for(let at=0;at<assets.length;at+=75){
   const batch=await page.evaluate(async entries=>{
    const results=[];let index=0;
    async function worker(){
     while(index<entries.length){
      const [code,asset]=entries[index++];let last;
      for(let attempt=0;attempt<3;attempt++){
       let decoder;
       try{
        const response=await fetch(asset.url,{signal:AbortSignal.timeout(20000)});
        if(!response.ok)throw Error('HTTP '+response.status);
        decoder=new ImageDecoder({data:new Uint8Array(await response.arrayBuffer()),type:'image/webp'});
        await decoder.tracks.ready;
        const frames=decoder.tracks.selectedTrack.frameCount;
        if(frames<2)throw Error('File is not animated');
        const frame=await decoder.decode({frameIndex:1});frame.image.close();
        results.push({code,frames});last=null;break;
       }catch(e){last=String(e);}finally{decoder?.close();}
      }
      if(last)results.push({code,error:last});
     }
    }
    await Promise.all([worker(),worker(),worker()]);return results;
   },assets.slice(at,at+75));
   results.push(...batch);
   console.log('Animated files checked:',results.length,'/',assets.length,'failures:',results.filter(r=>r.error).length);
  }
  fs.writeFileSync(path.join(root,'tmp_obs_debug/chat-chaos-animation-audit.json'),JSON.stringify({total:results.length,results},null,2));
  assert.deepEqual(results.filter(r=>r.error),[]);
  assert.deepEqual(errors,[]);
  console.log('PASS: every installed file decoded with multiple frames; every requested Kesha code is live; hover preview, bounded visible playback and panel cleanup verified.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
