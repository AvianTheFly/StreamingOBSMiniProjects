'use strict';
// Draft sizing is presentation only. app.js owns playback and saved ranges.
const FootageClipEditor = (() => {
  function fit(center, length, duration) {
    if (!(duration > 0) || !Number.isFinite(center) || !Number.isFinite(length)) return null;
    length = Math.min(duration, Math.max(.1, length));
    const start = Math.max(0, Math.min(duration-length, center-length/2));
    return {start, end:start+length};
  }
  function valid(range, duration) {return !!range && Number.isFinite(range.start) && Number.isFinite(range.end) && range.start>=0 && range.end>range.start && range.end<=duration;}
  function windowFor(range, duration, position) {
    const center = valid(range,duration) ? (range.start+range.end)/2 : position;
    return fit(center, valid(range,duration) ? Math.max(60,(range.end-range.start)*2) : 60, duration);
  }
  function moveEdge(range, edge, value, duration) {
    if (!valid(range,duration)) return range;
    const gap = Math.min(.1,range.end-range.start);
    return edge==='start' ? {...range,start:Math.max(0,Math.min(range.end-gap,value))} : {...range,end:Math.min(duration,Math.max(range.start+gap,value))};
  }
  function mount(owner) {
    const $=id=>document.getElementById(id);
    let sourceId=null, window=null, noteKey=null, busy=false, drag=null;
    async function run(fn){
      if(busy)return;busy=true;sync();
      try{await owner.action(fn);}finally{busy=false;sync();}
    }
    function mode(highlight){
      if(!highlight)drag?.stop();
      $('clip-editor').hidden=!owner.snapshot().video;
      $('mode-recording').classList.toggle('active',!highlight);
      $('mode-highlight').classList.toggle('active',highlight);
    }
    function position(value){
      const inside=window&&value>=window.start&&value<=window.end;
      $('clip-playhead').hidden=!inside;
      if(inside)$('clip-playhead').style.left=(value-window.start)/(window.end-window.start)*100+'%';
    }
    function sync(reframe=false) {
      const {video,range,position:playhead,editing,draftKey,extracting,undo}=owner.snapshot();
      const usable=video?.availability==='online' && video.duration>0;
      const hasRange=usable && valid(range,video.duration);
      if (!video) return;
      if(sourceId!==video.id || reframe || !window) {drag?.stop();sourceId=video.id;window=windowFor(range,video.duration,playhead);}
      const key=video.id+':'+(editing?'saved:'+editing.id:'draft:'+(draftKey||'new'));
      if(key!==noteKey){noteKey=key;$('clip-tags').value=editing?.tags||'';$('clip-note').value=editing?.notes||'';}
      $('clip-duration').textContent=hasRange?(editing?.decision==='keep'?'Kept clip · ':'Selection · ')+owner.duration(range.end-range.start):'Close-up timeline';
      $('clip-selection-note').textContent=hasRange?`${owner.time(range.start)} → ${owner.time(range.end)} · drag a handle to change how much you keep`:'Choose a voice spike, pick a length, or start around the playhead.';
      $('clip-preview').disabled=!hasRange;
      $('quick-keep').disabled=!hasRange;$('quick-keep').textContent=editing?.decision==='keep'?'Save changes':'Keep';
      $('clip-extract').disabled=!hasRange||busy||extracting;
      $('clip-extract').textContent=extracting?'Extracting…':'Extract this clip';
      $('clip-skip').disabled=editing?.decision!=='keep'||busy;
      $('clip-undo').hidden=!undo;$('clip-undo').disabled=busy;
      $('clip-save-note').textContent=editing?.decision==='keep'?'Kept · adjust or extract':editing?.decision==='reject'?'Not kept':'Not saved';
      if(!hasRange)$('clip-save-note').textContent='Drag across the track to select a clip';
      $('clip-times').hidden=!hasRange;
      $('clip-skip').hidden=editing?.decision!=='keep';
      $('clip-new').disabled=!usable;
      const elsewhere=hasRange&&(range.end<window.start||range.start>window.end);
      $('clip-save-note').textContent=elsewhere?'Selection elsewhere · use Fit clip':$('clip-save-note').textContent;
      $('clip-fit').disabled=!hasRange;
      $('clip-zoom-in').disabled=!usable||window.end-window.start<=2;
      $('clip-zoom-out').disabled=!usable||window.end-window.start>=video.duration;
      $('clip-scale').textContent=owner.time(window.end-window.start)+' view';
      const overview=$('overview-window');overview.style.left=window.start/video.duration*100+'%';overview.style.width=(window.end-window.start)/video.duration*100+'%';
      for(const edge of ['start','end']) {
        const slider=$('clip-'+edge);
        slider.disabled=!hasRange||range[edge]<window.start||range[edge]>window.end;
        slider.classList.toggle('outside',slider.disabled);
        slider.min=window?.start||0;slider.max=window?.end||video.duration;
        slider.value=hasRange?range[edge]:playhead;
        slider.setAttribute('aria-valuetext',owner.time(hasRange?range[edge]:playhead));
      }
      const span=(window?.end-window?.start)||1;
      $('clip-fill').style.left=hasRange?Math.max(0,(range.start-window.start)/span*100)+'%':'0%';
      $('clip-fill').style.width=hasRange?Math.max(0,(Math.min(range.end,window.end)-Math.max(range.start,window.start))/span*100)+'%':'0%';
      $('clip-window-start').textContent=owner.time(window?.start||0);
      $('clip-window-end').textContent=owner.time(window?.end||video.duration);
      position(playhead);
    }
    $('mode-recording').onclick=()=>mode(false);
    $('mode-highlight').onclick=()=>{
      const {range,video,position}=owner.snapshot();
      if(video?.availability==='online'&&!valid(range,video.duration))owner.setRange(fit(position,20,video.duration),true,true);
      mode(true);
    };
    $('clip-new').onclick=()=>owner.action(()=>owner.custom(owner.snapshot().position));
    for(const edge of ['start','end'])$('clip-'+edge).oninput=()=>{
      if(drag?.active())return;
      const {video,range}=owner.snapshot();
      if(video&&valid(range,video.duration)){
        const changed=moveEdge(range,edge,Number($('clip-'+edge).value),video.duration);
        owner.setRange(changed,false);owner.scrub(changed[edge]);
      }
    };
    const rail=document.querySelector('.clip-slider');
    drag=FootageClipDrag.mount({
      rail,
      input:edge=>$('clip-'+edge),
      snapshot:()=>{const state=owner.snapshot();return {source:state.video?.id,duration:state.video?.duration,usable:state.video?.availability==='online',range:state.range,window};},
      pan:next=>{window=next;sync();},select:(range,newDraft)=>owner.setRange(range,false,newDraft),scrub:owner.scrub,
      change:(edge,value)=>{
        const {video,range}=owner.snapshot();if(!video||!valid(range,video.duration))return;
        const changed=moveEdge(range,edge,Math.max(window.start,Math.min(window.end,value)),video.duration);
        owner.setRange(changed,false);owner.scrub(changed[edge]);
      }
    });
    function zoom(factor,anchor){
      if(!window)return;drag.stop();const {video,position}=owner.snapshot();
      anchor=anchor??Math.max(window.start,Math.min(window.end,position));
      const span=window.end-window.start,length=Math.min(video.duration,Math.max(2,span*factor));
      const center=anchor+(0.5-(anchor-window.start)/span)*length;
      window=fit(center,length,video.duration);sync();
    }
    rail?.addEventListener('wheel',event=>{
      if(!window)return;event.preventDefault();
      drag.stop();const rect=rail.getBoundingClientRect(),{video}=owner.snapshot();
      if(event.shiftKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)){
        window=FootageClipDrag.pan(window,(event.deltaX||event.deltaY)/rect.width*(window.end-window.start),video.duration);sync();
      }else zoom(event.deltaY>0?1.4:1/1.4,FootageClipDrag.at(window,(event.clientX-rect.left)/rect.width));
    },{passive:false});
    $('clip-zoom-in').onclick=()=>zoom(1/2);$('clip-zoom-out').onclick=()=>zoom(2);
    $('clip-fit').onclick=()=>sync(true);
    for(const id of ['in','out'])$(id).addEventListener('input',()=>sync());
    $('clip-preview').onclick=()=>owner.action(owner.preview);
    $('clip-extract').onclick=()=>run(owner.extract);
    $('clip-skip').onclick=()=>run(owner.remove);
    $('clip-undo').onclick=()=>run(owner.undo);
    $('clip-note-toggle').onclick=()=>{$('clip-notes').hidden=!$('clip-notes').hidden;};
    return {sync,mode,position,viewport:()=>window,navigate:value=>{drag.stop();const {video}=owner.snapshot();window=fit(value,window?.end-window?.start||60,video.duration);sync();},restoreNotes:detail=>{$('clip-tags').value=detail.tags||'';$('clip-note').value=detail.notes||'';},notes:()=>({tags:$('clip-tags').value,notes:$('clip-note').value})};
  }
  function previewFinished(boundary,sourceId,position){return !!boundary && (boundary.videoId!==sourceId || position>=boundary.end);}
  return {fit,valid,windowFor,moveEdge,previewFinished,mount};
})();
if(typeof module!=='undefined')module.exports=FootageClipEditor;
