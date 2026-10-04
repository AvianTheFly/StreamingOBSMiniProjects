// Regression for source-switch races, timeline windows and the review contract.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

async function main(){
  const elements=new Map(),listeners=new Map(),requests=[],reviews=[];
  let now=0;
  function element(id){
    if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',hidden:false,value:'strength'});
    return elements.get(id);
  }
  const context=vm.createContext({
    $:element,AbortController,Date:{now:()=>now},
    time:seconds=>String(seconds),
    document:{addEventListener:(name,callback)=>listeners.set(name,callback)},
    window:{addEventListener:()=>{}},
    fetch:(url,options)=>new Promise(resolve=>requests.push({url,signal:options.signal,
      resolve:data=>resolve({ok:true,json:async()=>data})})),
    action:fn=>fn(),reviewSourceRange:async(...args)=>reviews.push(args),
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'web/voice_markers.js'),'utf8'),context);
  const timeline=(id,start=0,availability='online')=>listeners.get('footage:timeline')({
    detail:{video_id:id,duration:3600,start,length:300,availability}});
  const response=(id,markerId,time,state='current')=>({video_id:id,state,audio_label:'Microphone track',
    markers:[{id:markerId,game_index:0,time,start:time-10,end:time+16,above_baseline_db:12}]});
  const flush=()=>new Promise(resolve=>setImmediate(resolve));

  timeline(1);timeline(2);
  assert.equal(requests[0].signal.aborted,true);
  requests[1].resolve(response(2,'second',200));await flush();
  assert.match(element('voice-spike-list').innerHTML,/second/);
  assert.match(element('voice-detail').innerHTML,/second/);
  timeline(2,1000);
  assert.equal(element('voice-detail').innerHTML,'');
  assert.match(element('voice-overview').innerHTML,/second/);
  assert.equal(requests.length,2);

  // A -> B -> A: even the same source ID cannot revive an obsolete response.
  timeline(1);
  assert.equal(element('voice-overview').innerHTML,'');
  requests[0].resolve(response(1,'old-first',100));await flush();
  assert.equal(element('voice-overview').innerHTML,'');
  requests[2].resolve(response(1,'new-first',120));await flush();
  assert.match(element('voice-spike-list').innerHTML,/new-first/);
  assert.doesNotMatch(element('voice-spike-list').innerHTML,/old-first/);

  let stopped=false;
  const click={target:{closest:()=>({dataset:{voiceMarker:'new-first'}})},stopPropagation:()=>{stopped=true;}};
  await element('voice-spike-list').onclick(click);
  assert.equal(stopped,true);
  assert.deepEqual(reviews,[[1,110,136]]);
  assert.equal(requests.length,3); // Selection creates no keeper or export request.
  timeline(1,0,'missing');
  assert.match(element('voice-spike-list').innerHTML,/disabled/);
  await element('voice-overview').onclick(click);
  assert.equal(reviews.length,1);

  // Existing source-refresh events pick up a newly completed analysis.
  now=9000;timeline(1);
  assert.equal(requests.length,4);
  requests[3].resolve({...response(1,'fresh',140),markers:[]});await flush();
  assert.equal(element('voice-marker-count').textContent,'0 spikes');
  assert.equal(element('voice-overview').innerHTML,'');

  timeline(3);requests[4].resolve({video_id:3,state:'ineligible',markers:[]});await flush();
  for(const id of ['voice-overview','voice-detail','voice-marker-caption','voice-spikes-panel']){
    assert.equal(element(id).hidden,true);
  }
  timeline(4);requests[5].resolve({video_id:4,state:'source_changed',markers:[]});await flush();
  assert.match(element('voice-marker-note').textContent,/Source changed/);
  assert.equal(element('voice-overview').innerHTML,'');
  console.log('Voice marker source-switch, viewport, review and refresh regressions passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
