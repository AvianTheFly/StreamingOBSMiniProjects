/* Prepared feature geometry: bounded RAM ownership, startup fetch and teardown.
 * Importing defines the owner; overlay startup explicitly requests preparation. */
(function(root){
 'use strict';
 // Budget serialized plan data; JS object overhead is additional heap storage.
 const BUDGET=256*1024*1024,MAX_PAIRS=4096;
 class Cache{
  constructor(){this.entries=new Map();this.bytes=0;this.prepared=0;this.revision=0;this.request=null;}
  get(key){const e=this.entries.get(key);if(!e)return;this.entries.delete(key);this.entries.set(key,e);return e.value;}
  set(key,value,size=JSON.stringify(value).length){
   if(size>BUDGET)return;
   const old=this.entries.get(key);if(old){this.bytes-=old.size;this.entries.delete(key);}
   while(this.bytes+size>BUDGET||this.entries.size>=MAX_PAIRS){const first=this.entries.keys().next().value;this.bytes-=this.entries.get(first).size;this.entries.delete(first);}
   this.entries.set(key,{value,size});this.bytes+=size;
  }
  install(data,count){
   if(data?.schema!==1||data.stages!==count||count<2||count>64||!data.plans||!data.sizes||!Array.isArray(data.counts)||data.counts.length!==count)return false;
   if(!data.counts.every(c=>['face','line','stroke'].every(k=>Number.isSafeInteger(c?.[k])&&c[k]>=0&&c[k]<=40000)))return false;
   const keys=Object.keys(data.plans);if(keys.length!==count*(count-1))return false;
   let bytes=0;
   for(let a=0;a<count;a++)for(let b=0;b<count;b++)if(a!==b){
    const key=a+':'+b,plan=data.plans[key],size=JSON.stringify(plan)?.length;
    if(size!==data.sizes[key])return false;
    if(!Number.isSafeInteger(size)||size<1||(bytes+=size)>BUDGET)return false;
    for(const kind of ['face','line','stroke']){
     if(!Array.isArray(plan?.[kind])||plan[kind].length>40000)return false;
     for(const p of plan[kind]){
      if(!Number.isSafeInteger(p.a)||!Number.isSafeInteger(p.b)||p.a<0||p.b<0||p.a>=data.counts[a][kind]||p.b>=data.counts[b][kind]||
         !Number.isSafeInteger(p.ca)||!Number.isSafeInteger(p.cb)||p.ca<1||p.cb<1||typeof p.primaryA!=='boolean'||typeof p.primaryB!=='boolean')return false;
      if(kind==='face'){if(!Array.isArray(p.order)||p.order.length!==3||new Set(p.order).size!==3||p.order.some(i=>!Number.isInteger(i)||i<0||i>2))return false;}
      else if(!Number.isFinite(p.shift)||typeof p.reverse!=='boolean'||
              !['rangeA','rangeB'].every(name=>Array.isArray(p[name])&&p[name].length===2&&p[name].every(Number.isFinite)&&p[name][0]>=0&&p[name][1]<=1&&p[name][0]<p[name][1]))return false;
     }
    }
   }
   // Publish the entire verified map, never a partially accepted plan set.
   this.entries.clear();this.bytes=0;
   for(const key of keys)this.set(key,data.plans[key],data.sizes[key]);
   this.prepared=keys.length;return true;
  }
  async load(count){
   this.cancel();const revision=this.revision,controller=new AbortController();this.request=controller;
   const deadline=setTimeout(()=>controller.abort(),10000);
   try{
    const response=await fetch('/prepared-morphs.json',{signal:controller.signal,cache:'no-store'});
    if(!response.ok)return false;
    const text=await response.text();if(text.length>BUDGET||revision!==this.revision)return false;
    const data=JSON.parse(text);
    return this.install(data,count);
   }catch{return false;}finally{clearTimeout(deadline);if(this.request===controller)this.request=null;}
  }
  cancel(){this.revision++;this.request?.abort();this.request=null;}
  clear(){this.cancel();this.entries.clear();this.bytes=this.prepared=0;}
  status(){return {entries:this.entries.size,bytes:this.bytes,budget:BUDGET,prepared:this.prepared};}
 }
 root.MorphPlanCache=Cache;if(typeof module!=='undefined'&&module.exports)module.exports=Cache;
})(globalThis);
