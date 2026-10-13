// Complete correspondence, fallback, ownership and exact live/prepared geometry.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const web=path.resolve(__dirname,'../mini projects/spotify/web');
const Morph=require(path.join(web,'stage_morph.js')),Cache=require(path.join(web,'morph_cache.js'));
const World=require(path.join(web,'reactive.js')),Journey=require(path.join(web,'journey.js'));
const prepared=JSON.parse(fs.readFileSync(path.join(web,'prepared-morphs.json'))),count=Journey.names.length;
assert.throws(()=>Morph.exportPrepared(65));assert.throws(()=>Morph.exportPrepared(0));
const world=new World({geometry:false}),journey=new Journey();
const signal={energy:.4,bass:.2,treble:.12,beat:0,flux:.1,width:.55,tonality:.7,pitch:.3,
 bands:Array.from({length:48},(_,i)=>.04+.25*Math.sin(i*.23)**2),waveform:Array.from({length:128},(_,i)=>Math.sin(i*.18)*.35)};
for(let i=0;i<90;i++){world.step(signal,1/30);journey.step(world,1/30,signal);}
function fingerprint(api){
 const hash=crypto.createHash('sha256'),sink={coverageCopies:true};
 for(const kind of ['face','line','stroke'])sink[kind]=(...args)=>hash.update(kind+JSON.stringify(args));
 api.render(sink,world,journey);return hash.digest('hex');
}
let reference=null;
if(process.env.SPOTIFY_REFERENCE_DIR){
 const Module=require('node:module'),file=path.join(web,'reference_stage_morph.js'),m=new Module(file,module);m.filename=file;m.paths=module.paths;
 m._compile(fs.readFileSync(path.join(process.env.SPOTIFY_REFERENCE_DIR,'stage_morph.js'),'utf8'),file);reference=m.exports;
}
const golden=[];
for(let from=0;from<count;from++)for(let to=0;to<count;to++)if(from!==to){
 journey.stage=from;journey.next=to;journey.transitioning=true;
 for(const mix of [.001,.5,.999]){journey.mix=mix;const value=fingerprint(Morph);
  if(reference)assert.equal(value,fingerprint(reference),`original geometry ${from}:${to}:${mix}`);
  golden.push({from,to,mix,value});}
}
assert(Morph.installPrepared(prepared,count));assert.equal(Morph.planCount(),count*(count-1));
for(const entry of golden){journey.stage=entry.from;journey.next=entry.to;journey.mix=entry.mix;
 assert.equal(fingerprint(Morph),entry.value,'prepared plans preserve every coordinate, color, width and opacity');}
for(let stage=0;stage<count;stage++){journey.stage=stage;journey.transitioning=false;if(reference)assert.equal(fingerprint(Morph),fingerprint(reference));}
const owned=Morph.capture(6,world,journey),before=JSON.stringify(owned);
journey.stage=0;journey.next=5;journey.transitioning=true;journey.mix=.5;fingerprint(Morph);
assert.equal(JSON.stringify(owned),before,'public captures own their arrays independently of later rendering');
const cache=new Cache();assert(cache.install(prepared,count));const entries=cache.status().entries;
const malformed={...prepared,plans:{...prepared.plans,'0:1':{face:[{a:999999,b:0,ca:1,cb:1}],line:[],stroke:[]}}};
assert.equal(cache.install(malformed,count),false);assert.equal(cache.status().entries,entries,'reject incomplete publication without replacing live plans');
assert.equal(cache.install({...prepared,stages:count+1},count),false);
cache.clear();for(let i=0;i<5000;i++)cache.set(String(i),{},1);assert.equal(cache.status().entries,4096);
cache.clear();cache.set('a',{},200*1024*1024);cache.set('b',{},200*1024*1024);assert.equal(cache.status().entries,1);assert(cache.status().bytes<=cache.status().budget);
(async()=>{
 const fetchBefore=global.fetch;let finish,aborted=false;
 try{
  global.fetch=(_url,{signal})=>new Promise(resolve=>{finish=resolve;signal.addEventListener('abort',()=>{aborted=true;});});
  const loading=cache.load(count);cache.clear();finish({ok:true,text:async()=>JSON.stringify(prepared)});
  assert.equal(await loading,false);assert(aborted);assert.equal(cache.status().entries,0,'late preparation cannot resurrect a disposed page');
 }finally{global.fetch=fetchBefore;}
 const status=Morph.status();assert(status.plans.bytes<=status.plans.budget);
 Morph.clear();assert.equal(Morph.planCount(),0);assert.equal(Morph.status().references,0);
 console.log(JSON.stringify({passed:true,pairs:count*(count-1),exactFrames:golden.length+count,originalReference:!!reference,preparedBytes:status.plans.bytes,fallbackAndCleanup:true}));
})().catch(error=>{console.error(error);process.exitCode=1;});
