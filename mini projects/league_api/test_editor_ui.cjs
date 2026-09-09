const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/control.js','utf8');
const requestCode=source.slice(source.indexOf('let settingsWrite='),source.indexOf('\nfunction act'));
(async()=>{
  const regions=[{inert:false},{inert:false}];let finish;
  const context=vm.createContext({settingsStale:false,document:{querySelectorAll:()=>regions},fetch:()=>new Promise(r=>finish=r),Error});
  vm.runInContext(requestCode,context);
  const save=context.req('/event',{key:'kill'});
  assert(regions.every(r=>r.inert));
  await assert.rejects(context.req('/options',{}),/already in progress/);
  finish({ok:true,json:async()=>({saved:true})});
  await save;assert(regions.every(r=>!r.inert));
  const failure=context.req('/event',{});
  finish({ok:false,json:async()=>({error:'Conflict'})});
  await assert.rejects(failure,/Conflict/);assert(regions.every(r=>!r.inert));
  const retry=context.req('/options',{});
  finish({ok:true,json:async()=>({})});await retry;
  context.settingsStale=true;await assert.rejects(context.req('/options',{}),/another window/);
  // An OBS read begun before a manual fader edit must not repaint the old value,
  // even when the write completes before that read returns.
  let resolveRead, rejectRead, shown=[];
  const audioContext=vm.createContext({audioRevision:0,audioBusy:false,audioState:null,
    req:()=>new Promise((resolve,reject)=>{resolveRead=resolve;rejectRead=reject}),
    showAudio:v=>shown.push(v),setTimeout:()=>{},$:()=>{throw Error('Stale read touched controls')}});
  vm.runInContext(source.slice(source.indexOf('async function pollAudio()'),source.indexOf('async function poll()')),audioContext);
  let read=audioContext.pollAudio();audioContext.audioRevision++;resolveRead({db:-30});await read;
  assert.equal(shown.length,0);
  read=audioContext.pollAudio();audioContext.audioRevision++;rejectRead(Error('old failure'));await read;
  read=audioContext.pollAudio();resolveRead({db:-8});await read;assert.equal(shown[0].db,-8);
  let clearRequest;
  const clearContext=vm.createContext({$:()=>({set onclick(fn){clearRequest=fn}}),act:fn=>fn,req:(...args)=>args});
  vm.runInContext(source.slice(source.indexOf("$('#clear').onclick"),source.indexOf("$('#demo').onclick")),clearContext);
  const clear=await clearRequest();assert.equal(clear[0],'/clear');assert.equal(JSON.stringify(clear[1]),'{}');
  console.log('Save serialization, stale settings protection, volume race and clear-action checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
