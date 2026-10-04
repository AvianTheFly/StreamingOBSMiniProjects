// Read-only derived timelines, including stale-source response rejection.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
async function main(){
  const elements=new Map(),listeners=new Map(),requests=[],reviews=[];let now=0;
  const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',hidden:false,style:{}});return elements.get(id);};
  const context=vm.createContext({$:element,AbortController,Date:{now:()=>now},time:String,escape:s=>String(s).replaceAll('<','&lt;'),FootageClipEditor:require('./web/clip_editor.js'),
    document:{addEventListener:(name,fn)=>listeners.set(name,fn)},window:{addEventListener(){}},
    action:fn=>fn(),reviewSourceRange:async(...args)=>reviews.push(args),reviewSavedRange:async(...args)=>reviews.push(args),
    fetch:(url,options)=>new Promise(resolve=>requests.push({url,signal:options.signal,resolve:data=>resolve({ok:true,json:async()=>data})}))});
  vm.runInContext(fs.readFileSync(__dirname+'/web/recording_timeline.js','utf8'),context);
  const timeline=(id,availability='online')=>listeners.get('footage:timeline')({detail:{video_id:id,duration:1800,availability,draft:{start:110,end:130},ranges:[{id:8,start:100,end:150,title:'<bad>',decision:'keep'},{id:9,start:160,end:180,title:'Removed',decision:'reject'}]}});
  const result=id=>({video_id:id,state:'current',games:[{index:0,start:100,end:1100,outcome:'victory'}]});
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  timeline(1);timeline(2);assert.equal(requests[0].signal.aborted,true);
  requests[1].resolve(result(2));await flush();requests[0].resolve({...result(1),games:[]});await flush();
  assert.match(element('game-overview').innerHTML,/Game 1/);assert.match(element('saved-overview').innerHTML,/&lt;bad>/);
  assert.doesNotMatch(element('saved-overview').innerHTML,/Removed/);
  assert.equal(element('full-selection').hidden,false);
  await element('game-overview').onclick({target:{closest:()=>({dataset:{gameIndex:'0'}})}});assert.deepEqual(reviews.pop(),[2,100,1100]);
  await element('saved-overview').onclick({target:{closest:()=>({dataset:{savedRange:'8'}})}});assert.deepEqual(reviews.pop(),[2,8]);
  timeline(2,'missing');await element('game-overview').onclick({target:{closest:()=>({dataset:{gameIndex:'0'}})}});assert.equal(reviews.length,0);
  now=9000;timeline(2);assert.equal(requests.length,3);requests[2].resolve({video_id:2,state:'source_changed',games:[]});await flush();assert.equal(element('game-overview').innerHTML,'');assert.match(element('game-timeline-note').textContent,/changed/);
  console.log('Game/saved-clip timeline navigation, read-only snapshots, selection and stale-source checks passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
