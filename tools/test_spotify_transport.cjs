// Isolated transport/visibility proof. Never changes Spotify or the live Hub.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const web=path.resolve(__dirname,'../mini projects/spotify/web');
let state={playing:false,title:'',artist:'',bands:Array(48).fill(0),revision:0},legacy=true,offline=false,requests=0;
const pending=new Set();
function respond(response){response.setHeader('Content-Type','application/json');response.end(JSON.stringify(state));}
function publish(next){state={...state,...next,revision:state.revision+1};for(const finish of [...pending])finish();}
const server=http.createServer((request,response)=>{
 const url=new URL(request.url,'http://localhost');
 if(url.pathname==='/api/state'){
  requests++;if(offline){response.writeHead(503);response.end();return;}
  if(legacy){response.setHeader('Content-Type','application/json');const {revision,...old}=state;response.end(JSON.stringify(old));return;}
  if(!state.playing&&Number(url.searchParams.get('after'))===state.revision&&url.searchParams.has('after')){
   let timer;const finish=()=>{clearTimeout(timer);pending.delete(finish);if(!response.destroyed)respond(response);};
   pending.add(finish);assert(pending.size<=1,'idle requests must stay serialized');timer=setTimeout(finish,1000);
   response.on('close',()=>{clearTimeout(timer);pending.delete(finish);});return;
  }
  respond(response);return;
 }
 const file=path.join(web,url.pathname==='/overlay'?'overlay.html':url.pathname.slice(1));
 if(!file.startsWith(web+path.sep)){response.writeHead(404);response.end();return;}
 try{response.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(fs.readFileSync(file));}
 catch{response.writeHead(404);response.end();}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:400,height:300}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/overlay');
  await page.waitForTimeout(200);assert(await page.locator('#widget').isHidden());
  const baseline= requests;await page.waitForTimeout(3000);const oldIdle=requests-baseline;
  assert(oldIdle>35,'older state servers must keep polling compatibly');
  legacy=false;await page.waitForFunction(()=>Number.isSafeInteger(data.revision));
  const start=requests;await page.waitForTimeout(3000);const newIdle=requests-start;
  assert(newIdle<=4,'idle clients must make approximately one request per second');
  // A one-second timeout can resolve at the exact three-second sample. Wait
  // for the next notification request rather than failing in that normal gap.
  for(let i=0;i<50&&pending.size===0;i++)await new Promise(resolve=>setTimeout(resolve,10));
  assert(pending.size===1,'one serialized idle request must be ready for immediate playback notification');
  const signal={playing:true,title:'Immediate playback',artist:'Artist',energy:.65,bass:.4,treble:.25,beat:.3,
   pitch:.4,tonality:.8,width:.3,balance:0,flux:.2,bands:Array(48).fill(.3),waveform:Array.from({length:128},(_,i)=>Math.sin(i*.15)*.4)};
  const notified=Date.now();publish(signal);
  await page.waitForFunction(()=>!document.getElementById('widget').hidden,null,{timeout:750});
  const wakeMs=Date.now()-notified;assert.equal(await page.locator('#title').textContent(),signal.title);
  await page.evaluate(()=>{
   window.costs={steps:0,paints:0,stepMs:0,paintMs:0};const step=world.step.bind(world),paint=present;
   world.step=(...args)=>{const start=performance.now();const result=step(...args);costs.steps++;costs.stepMs+=performance.now()-start;return result;};
   present=()=>{const start=performance.now();const result=paint();costs.paints++;costs.paintMs+=performance.now()-start;return result;};
  });
  await page.waitForTimeout(1200);
  const visible=await page.evaluate(()=>({...costs,phase:world.snapshot().phase}));
  assert(visible.paints>10,'visible musical frames must still paint normally');
  await page.evaluate(()=>{window.dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:false}}));costs={steps:0,paints:0,stepMs:0,paintMs:0};});
  const activeStart=requests;await page.waitForTimeout(1200);
  const hidden=await page.evaluate(()=>({...costs,phase:world.snapshot().phase}));
  assert(hidden.steps>10,'off-scene musical simulation must keep advancing');
  assert.equal(hidden.paints,0,'off-scene frames must skip all presentation work');
  assert(hidden.phase.some((value,i)=>value>visible.phase[i]),'hidden frames must retain spectral travel');
  assert(requests-activeStart>10,'active signal polling must retain its cadence off scene');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:true}})));
  await page.waitForFunction(()=>costs.paints>0);
  publish({playing:false});await page.waitForFunction(()=>document.getElementById('widget').hidden);
  await page.waitForTimeout(150);publish(signal);await page.waitForFunction(()=>!document.getElementById('widget').hidden,null,{timeout:750});
  offline=true;await page.waitForFunction(()=>document.getElementById('widget').hidden);
  offline=false;await page.waitForFunction(()=>!document.getElementById('widget').hidden);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,idleRequestsIn3Seconds:{before:oldIdle,after:newIdle},wakeMs,
   visible:{steps:visible.steps,paints:visible.paints,stepMs:visible.stepMs,paintMs:visible.paintMs},
   hidden:{steps:hidden.steps,paints:hidden.paints,stepMs:hidden.stepMs,paintMs:hidden.paintMs},resume:true,reconnect:true}));
 }finally{
  if(browser)await browser.close();for(const finish of [...pending])finish();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
