// This isolated QA input stays outside the program scene. Permit its painting
// explicitly so we can inspect native CEF while production visibility sleeps.
sourceVisible=true;Object.defineProperty(document,'hidden',{get:()=>false});
window.addEventListener('obsSourceVisibleChanged',()=>{sourceVisible=true;});
let qaStopped=false,qaPending=false,qaFailures=0;
const qaTimers=[];
const qaReport=url=>{
 if(qaStopped||qaPending||qaFailures>=3)return;
 qaPending=true;
 return fetch(url).then(()=>{qaFailures=0;},()=>{qaFailures++;})
  .finally(()=>{qaPending=false;});
};
const qaEvery=(fn,ms)=>qaTimers.push(setInterval(fn,ms));
window.addEventListener('pagehide',()=>{qaStopped=true;qaTimers.forEach(clearInterval);});
window.addEventListener('error',e=>qaReport('/diagnostics?error='+encodeURIComponent(e.message)));
window.addEventListener('unhandledrejection',e=>qaReport('/diagnostics?error='+encodeURIComponent(String(e.reason))));
let qaStage=-1;
qaEvery(()=>{if(Number.isInteger(data.qa_stage)&&data.qa_stage!==qaStage){
 qaStage=data.qa_stage;journey.stage=qaStage;journey.transitioning=false;journey.mix=0;journey.age=0;journey.exposure=0;
}},50);
qaEvery(()=>qaReport('/diagnostics?state='+encodeURIComponent(JSON.stringify({renderer:widget.dataset.renderer,
name:journey.name,catalog:VisualJourney.names,energy:data.energy,visible:sourceVisible,hidden:document.hidden,active:world.active,playing:data.playing,age:performance.now()-lastSuccess,graphics:radiance?.status(),glError:radiance?.gl.getError(),nativeNow:performance.now(),paintMs:visualizerTiming.paintMs,feed:typeof musicFeed!=='undefined'?musicFeed.status():null,motion:{body:journey.motion.body,counts:journey.motion.counts,pacing:journey.motion.pacing.snapshot()},view:journey.space.snapshot(),lens:VisualDepth.camera(journey).lens,sampleAgeMs:visualizerTiming.sampleAgeMs}))),250);
