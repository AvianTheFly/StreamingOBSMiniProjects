// Browser transport and render lifetime. The simulation owns musical history;
// journey.js conducts scenes; stage_renderer.js only presents their state.
const widget=document.getElementById('widget');
let canvas=document.getElementById('visualizer');
let ctx=null;
const title=document.getElementById('title'),artist=document.getElementById('artist');
let data={playing:false,bands:[]},lastSuccess=0,frame=0,lastFrame=0,sourceVisible=true;
let stopped=false,pollTimer=0,pending=null,pollGeneration=0,failures=0;
const world=new ReactiveWorld({geometry:false}),journey=new VisualJourney();
const musicFeed=new MusicFeed(world,journey);
// Load deterministic correspondence before a musical transition needs it.
// Missing/stale preparation falls back to the same live matching algorithm.
VisualMorph.loadPrepared(VisualJourney.names.length);
// Begin with the woven infinity ribbon; the musical journey explores the
// curated families while keeping their internal choreography continuous.
journey.stage=6;journey.next=3;journey.visits.fill(0);journey.visits[6]=1;journey.recent=[6];
let radiance=null,graphicsUnavailable=false;
const visualizerTiming={frames:0,paintMs:0,sampleAgeMs:null,analysisMs:0,receivedAt:0,rttMs:0};
function fit(){widget.style.transform=`scale(${Math.min(innerWidth/400,innerHeight/180)})`;}
fit();window.addEventListener('resize',fit);
function clear(){if(ctx){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);}else if(radiance&&!radiance.disposed&&!radiance.lost){radiance.gl.clear(radiance.gl.COLOR_BUFFER_BIT);}}
function hide(){widget.hidden=true;cancelAnimationFrame(frame);frame=0;clear();lastFrame=0;}
function present(){
 if(radiance?.disposed){
  // A restored WebGL context belongs to its original surface. Keep that
  // surface during temporary loss, then replace only the fallback picture.
  if(ctx&&!graphicsUnavailable){canvas.replaceWith(radiance.canvas);canvas=radiance.canvas;ctx=null;}
  radiance=null;
 }
 if(!radiance&&!graphicsUnavailable){
  try{radiance=new VisualStageRenderer({canvas});}catch(error){graphicsUnavailable=true;console.warn('Visualizer Canvas fallback:',error.message);}
 }
 if(radiance&&radiance.paint(null,world,journey)){widget.dataset.renderer='webgl2';return;}
 if(!ctx){
  // A canvas cannot switch context types. Replace only the presentation surface.
  const fallback=document.createElement('canvas');fallback.id=canvas.id;fallback.width=1200;fallback.height=660;
  canvas.replaceWith(fallback);canvas=fallback;ctx=fallback.getContext('2d');
  const temporaryLoss=radiance&&(radiance.lost||radiance.gl.isContextLost());
  if(!temporaryLoss){radiance?.dispose();radiance=null;graphicsUnavailable=true;}
 }
 ctx.save();ctx.setTransform(3,0,0,3,600,330);
 widget.dataset.renderer='canvas';VisualStageRenderer.fallback(ctx,world,journey);ctx.restore();
}
function draw(now){
 frame=0;if(stopped||!sourceVisible||document.hidden)return;
 if(!data.playing||performance.now()-lastSuccess>1600){hide();return;}
 frame=requestAnimationFrame(draw);if(lastFrame&&now-lastFrame<15)return;
 lastFrame=now;
 // Audio generations advance the instrument in poll(), independently of paints.
 // Musical history keeps advancing off scene; only invisible painting sleeps.
 clear();
 if(!world.active)return;
 widget.dataset.theme=journey.name;widget.dataset.morph=journey.blend.toFixed(3);
 const began=performance.now();present();
 visualizerTiming.frames++;visualizerTiming.paintMs=performance.now()-began;
 visualizerTiming.sampleAgeMs=Number.isFinite(data.sample_age_ms)?data.sample_age_ms+(began-visualizerTiming.receivedAt)+visualizerTiming.rttMs*.5:null;
 visualizerTiming.analysisMs=data.analysis_ms||0;
}
async function poll(){
 if(stopped)return;const generation=pollGeneration;
 let next=16;
 const request={controller:new AbortController(),timer:0};pending=request;
 try{
  const idle=!data.playing&&Number.isSafeInteger(data.revision);
  const audioWait=!idle&&data.playing&&Number.isSafeInteger(data.audio_revision);
  const query=audioWait?'?audio_after='+data.audio_revision+'&after='+data.revision:idle?'?after='+data.revision:'';
  const requested=performance.now();
  request.timer=setTimeout(()=>request.controller.abort(),idle?2000:1000);
  const response=await fetch('/api/state'+query,{cache:'no-store',signal:request.controller.signal});
  if(!response.ok)throw Error('offline');const snapshot=await response.json();
  if(stopped||generation!==pollGeneration)return;
  data=snapshot;lastSuccess=performance.now();failures=0;
  visualizerTiming.receivedAt=lastSuccess;
  musicFeed.accept(data,lastSuccess);
  visualizerTiming.rttMs=audioWait?0:Math.min(20,lastSuccess-requested);
  if(Number.isSafeInteger(data.audio_revision))next=0;
  if(data.playing){
   if(title.textContent!==data.title)title.textContent=data.title;
   const artistName=data.artist||'Spotify';if(artist.textContent!==artistName)artist.textContent=artistName;
   widget.hidden=false;startDrawing();
  }
  else{hide();if(Number.isSafeInteger(data.revision))next=0;}
 }catch{
  if(stopped||generation!==pollGeneration)return;
  data.playing=false;delete data.revision;musicFeed.accept(data,performance.now());hide();
  next=Math.min(2000,250*2**Math.min(3,failures++));
 }finally{clearTimeout(request.timer);if(pending===request)pending=null;}
 if(stopped||generation!==pollGeneration)return;
 // A successful revision request already yields at fetch. Avoid the browser
 // nested-timer clamp between successive capture notifications.
 if(next===0)queueMicrotask(()=>{if(generation===pollGeneration)poll();});else pollTimer=setTimeout(poll,next);
}poll();
function startDrawing(){if(!stopped&&sourceVisible&&!document.hidden&&data.playing&&!frame)frame=requestAnimationFrame(draw);}
function visibility(){if(!sourceVisible||document.hidden){cancelAnimationFrame(frame);frame=0;lastFrame=0;}else startDrawing();}
window.addEventListener('obsSourceVisibleChanged',event=>{sourceVisible=event.detail?.visible!==false;visibility();});
document.addEventListener('visibilitychange',visibility);
window.addEventListener('pagehide',()=>{
 stopped=true;pollGeneration++;clearTimeout(pollTimer);pending?.controller.abort();clearTimeout(pending?.timer);
 hide();radiance?.dispose();VisualMorph.clear();
});
window.addEventListener('pageshow',()=>{if(stopped){stopped=false;failures=0;VisualMorph.loadPrepared(VisualJourney.names.length);poll();}});
