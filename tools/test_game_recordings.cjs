const assert=require('node:assert/strict');
const http=require('node:http');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const {spawnSync}=require('node:child_process');const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../mini projects/league_api/recording_web');
const output=path.resolve(__dirname,'../output/game-recording-update');
(async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'recording-review-'));
 const video=path.join(temp,'fixture.mp4');
 assert.equal(spawnSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=black:s=320x180:d=3','-threads','2','-pix_fmt','yuv420p',video]).status,0);
 let calls=0,posts=[],fail=false;
 const row={id:'game-1',path:'C:/Replays/Unreviewed Games/example.mp4',decision:'pending',expires_at:Date.now()/1000+86400,
  markers:[{id:'m1',label:'Dragon <script>steal</script>',source:'instant_replay',offset_seconds:1,clip_path:'C:/Replays/clips/dragon.mp4'}]};
 const state={enabled:true,owned:true,active:{id:'live',decision:'pending',markers:[]},status:'Recording champion select and game',audio:'Clean first; full mix second',latest:row,recordings:[row]};
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='POST'){
   let body='';req.on('data',v=>body+=v);req.on('end',()=>{posts.push(JSON.parse(body));res.setHeader('Content-Type','application/json');res.statusCode=fail?400:200;res.end(JSON.stringify(fail?{error:'OBS is still recording'}:{ok:true,message:'Recording kept'}));});return;
  }
  if(url.pathname==='/recordings/state'){calls++;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(state));return;}
  if(url.pathname==='/recordings/media'){const bytes=fs.readFileSync(video);const match=/bytes=(\d+)-(\d*)/.exec(req.headers.range||'');res.setHeader('Content-Type','video/mp4');res.setHeader('Accept-Ranges','bytes');if(match){const start=Number(match[1]),end=match[2]?Number(match[2]):bytes.length-1;res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${bytes.length}`);res.end(bytes.subarray(start,end+1));}else res.end(bytes);return;}
  const file=url.pathname==='/shared/visible-poll.js'?path.resolve(root,'../../..','lib/browser_effects/web/visible-poll.js'):path.join(root,{'/recordings':'index.html','/recordings/app.js':'app.js','/recordings/style.css':'style.css'}[url.pathname]||'missing');
  if(!fs.existsSync(file)){res.statusCode=404;res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1360,height:1000}});let errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/recordings`);
  await page.getByRole('button',{name:'Review markers',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('video').readyState>=1);
  await page.getByRole('button',{name:/1:01|0:01/}).click();
  await page.waitForFunction(()=>Math.abs(document.querySelector('video').currentTime-1)<.1,{},{timeout:5000});
  assert.equal(await page.locator('#markers script').count(),0);
  await page.getByRole('button',{name:'Keep',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Recording kept'}).waitFor();
  assert.deepEqual(posts.at(-1),{id:'game-1',decision:'kept'});
  fail=true;await page.getByRole('button',{name:'Delete permanently',exact:true}).click();
  await page.getByText('OBS is still recording',{exact:true}).waitFor();
  assert.deepEqual(posts.at(-1),{id:'game-1',decision:'deleted'});
  await page.screenshot({path:path.join(output,'review-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(output,'review-mobile.png'),fullPage:true});
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  const before=calls;await page.waitForTimeout(2200);assert.equal(calls,before);
  assert.deepEqual(errors,[]);console.log('Recording review: seeking, literal labels, ID decisions, errors, responsive layout and hidden polling passed');
 }finally{await browser.close();server.close();assert.equal(path.dirname(fs.realpathSync(temp)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(temp).startsWith('recording-review-'));fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
