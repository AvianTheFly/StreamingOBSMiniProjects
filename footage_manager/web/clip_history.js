'use strict';
// One reversible clip decision. Source files and export metadata never participate.
const FootageClipHistory = (() => {
  const fields=['id','video_id','start','end','title','decision','tags','purpose','usage','collection','notes'];
  function review(range){return Object.fromEntries(fields.map(key=>[key,range[key]??(key==='usage'?'unused':'')]));}
  function signature(range){return JSON.stringify(review(range));}
  function create(owner){
    let entry=null,busy=false;
    function remember(before,after){entry={before:before?review(before):null,after:review(after)};}
    function available(source){return !busy&&entry?.after.video_id===source;}
    async function undo(source){
      if(!available(source))return null;
      busy=true;const pending=entry;
      try{
        const current=await owner.read(source,pending.after.id);
        if(!current||signature(current)!==signature(pending.after)){
          if(entry===pending)entry=null;
          throw Error('This clip changed since that action. Choose the clip to adjust it.');
        }
        // A new keeper becomes not-kept, retaining its note and any extracted file.
        const restored=pending.before||{...pending.after,decision:'reject'};
        await owner.write(restored);
        if(entry===pending)entry=null;
        return restored;
      }finally{busy=false;}
    }
    return {remember,available,undo};
  }
  return {review,signature,create};
})();
if(typeof module!=='undefined')module.exports=FootageClipHistory;
