// Derived background cues must navigate the chosen original without saving clips.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

async function main(){
  const elements=new Map(),listeners=new Map(),requests=[],reviews=[];
  let now=0;
  function element(id){
    if(!elements.has(id))elements.set(id,{innerHTML:'',hidden:false});
    return elements.get(id);
  }
  const context=vm.createContext({
    $:element,AbortController,Date:{now:()=>now},time:String,
    document:{addEventListener:(name,callback)=>listeners.set(name,callback)},
    window:{addEventListener:()=>{}},
    fetch:(url,options)=>new Promise(resolve=>requests.push({url,signal:options.signal,
      resolve:data=>resolve({ok:true,json:async()=>data})})),
    action:fn=>fn(),reviewSourceRange:async(...args)=>reviews.push(args),
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'web/between_games.js'),'utf8'),context);
  const timeline=(id,availability='online')=>listeners.get('footage:timeline')({
    detail:{video_id:id,duration:3600,start:0,length:300,availability}});
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  const click=index=>({target:{closest:()=>({dataset:{betweenMarker:String(index)}})}});

  timeline(1);timeline(2);
  assert.equal(requests[0].signal.aborted,true);
  requests[1].resolve({video_id:2,state:'current',markers:[{start:60,end:200},{start:3580,end:3600}]});
  await flush();
  assert.equal(element('between-games-panel').hidden,false);
  assert.match(element('between-games-list').innerHTML,/3580/);
  await element('between-games-list').onclick(click(1));
  assert.deepEqual(reviews,[[2,3580,3600]]);
  timeline(2,'missing');
  await element('between-games-list').onclick(click(0));
  assert.equal(reviews.length,1);

  timeline(1);
  assert.equal(element('between-games-panel').hidden,true);
  requests[0].resolve({video_id:1,state:'current',markers:[{start:10,end:50}]});await flush();
  assert.equal(element('between-games-panel').hidden,true);
  requests[2].resolve({video_id:1,state:'current',markers:[{start:150,end:200}]});await flush();
  await element('between-games-list').onclick(click(0));
  assert.deepEqual(reviews,[[2,3580,3600],[1,150,180]]);
  assert.ok(requests.every(request=>request.url.startsWith('/api/analysis-between-marks?id=')));
  assert.equal(requests.length,3); // No keeper, export or source-change request.

  now=9000;timeline(1);
  requests[3].resolve({video_id:1,state:'source_changed',markers:[]});await flush();
  assert.equal(element('between-games-panel').hidden,true);
  console.log('Between-game source-switch, timestamp navigation and read-only cue checks passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
