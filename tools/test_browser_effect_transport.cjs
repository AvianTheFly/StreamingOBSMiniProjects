// Real browser transport against a disposable notification fixture, no OBS writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const playback=fs.readFileSync(path.join(__dirname,'../lib/browser_effects/web/playback.js'));
function silence(){const n=44100*12,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(44100,24);b.writeUInt32LE(88200,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);return b;}
(async()=>{
 let active=null,revision=0,modern=false,requests=0,browser,played;const pending=new Set(),acks=[],errors=[],wave=silence();
 const playing=new Promise(resolve=>played=resolve);
 function publish(value){active=value;revision++;for(const finish of [...pending])finish();}
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://fixture');
  if(url.pathname.startsWith('/api/state/')){
   requests++;const respond=()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(modern?{active,revision}:{active}));};
   if(modern&&url.searchParams.get('after')===String(revision)){
    let finished=false;const finish=()=>{if(finished)return;finished=true;clearTimeout(timer);pending.delete(finish);if(!res.destroyed)respond();};
    const timer=setTimeout(finish,1000);pending.add(finish);res.on('close',()=>{finished=true;clearTimeout(timer);pending.delete(finish);});
   }else respond();return;
  }
  if(url.pathname.startsWith('/api/ack/')){let data='';req.on('data',chunk=>data+=chunk);req.on('end',()=>{const ack=JSON.parse(data);acks.push(ack);if(ack.id==='first'&&ack.status==='playing')played();res.end('{}');});return;}
  if(url.pathname.startsWith('/audio/')){res.setHeader('Content-Type','audio/wav');res.end(wave);return;}
  if(url.pathname==='/playback.js'){res.setHeader('Content-Type','application/javascript');res.end(playback);return;}
  if(url.pathname==='/renderers.js'){res.setHeader('Content-Type','application/javascript');res.end('export function makeRenderer(){return {ready:Promise.resolve(),draw(){window.paints++},clear(){}}}');return;}
  res.setHeader('Content-Type','text/html');res.end('<canvas id="effects"></canvas><script type="module" src="/playback.js"></script>');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  browser=await chromium.launch({headless:true,channel:'chrome',args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.paints=0;window.audio=[];const Original=Audio;window.Audio=function(...args){const a=new Original(...args);window.audio.push(a);return a;};});
  await page.goto(`http://127.0.0.1:${server.address().port}/overlay/soundboard`);
  let began=requests;await page.waitForTimeout(3100);const legacy=requests-began;
  modern=true;await page.waitForTimeout(500);began=requests;await page.waitForTimeout(3100);const notified=requests-began;
  assert(legacy>=7);assert(notified<=4);assert.equal(await page.evaluate(()=>paints),0);
  const start=Date.now();publish({id:'first',effect:{},stem:'cue',elapsed:0,paused:false});
  await page.waitForFunction(()=>audio.at(-1)&&!audio.at(-1).paused,null,{timeout:900});const wakeMs=Date.now()-start;
  await Promise.race([playing,new Promise((_,reject)=>setTimeout(()=>reject(Error('Missing playing acknowledgement')),1000))]);
  assert(acks.some(a=>a.id==='first'&&a.status==='playing'));
  publish({...active,paused:true});await page.waitForFunction(()=>audio.at(-1).paused);
  publish({...active,paused:false});await page.waitForFunction(()=>!audio.at(-1).paused);
  publish(null);await page.waitForFunction(()=>audio.at(-1).getAttribute('src')===null);
  await page.evaluate(()=>dispatchEvent(new Event('pagehide')));await page.waitForTimeout(150);
  began=requests;await page.waitForTimeout(1200);assert.equal(requests,began);assert.equal(pending.size,0);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,requestsIn3_1s:{legacy,notified},wakeMs,pauseResume:true,teardown:true}));
 }finally{if(browser)await browser.close();for(const finish of [...pending])finish();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1});
