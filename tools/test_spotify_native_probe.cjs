// A removed native QA source must not turn a closed report server into an
// unhandled-rejection feedback loop inside OBS's browser console.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const script=fs.readFileSync(require('node:path').join(__dirname,'fixtures/spotify_native_probe.js'),'utf8');
async function trial(available){
 const listeners={},timers=new Map();let requests=0,cleared=0,unhandled=0;
 const rejection=()=>unhandled++;process.on('unhandledRejection',rejection);
 const context=vm.createContext({window:{addEventListener:(k,fn)=>listeners[k]=fn},document:{},
  sourceVisible:false,data:{},fetch:()=>{requests++;return available?Promise.resolve({}):Promise.reject(Error('QA server closed'));},
  setInterval:fn=>{const id=timers.size+1;timers.set(id,fn);return id;},
  clearInterval:id=>{if(timers.delete(id))cleared++;}});
 try{
  vm.runInContext(script,context);
  for(let i=0;i<30;i++){
   for(let n=0;n<40;n++)listeners.unhandledrejection({reason:Error('Disconnected browser')});
   await new Promise(resolve=>setImmediate(resolve));
  }
  assert.equal(unhandled,0,'failed diagnostic requests cannot generate another unhandled rejection');
  if(!available)assert(requests<=3,'a dead QA server stops receiving repeated browser reports');
  else assert(requests>3,'healthy QA remains observable');
  const before=requests;listeners.pagehide();
  listeners.error({message:'late detached-source error'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests,before,'a detached QA page stops reporting');
  assert.equal(timers.size,0);assert.equal(cleared,2,'both QA intervals leave with their page');
 }finally{process.removeListener('unhandledRejection',rejection);}
}
(async()=>{await trial(false);await trial(true);console.log('Native QA: closed-server feedback and detached-page cleanup pass');})().catch(e=>{console.error(e);process.exitCode=1;});
