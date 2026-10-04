"use strict";
// Fixed-scale pointer gestures. No timer changes the scale while a handle is held.
const FootageClipDrag = (() => {
  function at(window, fraction) {return window.start+Math.max(0,Math.min(1,fraction))*(window.end-window.start);}
  function selection(anchor,position,duration) {
    const start=Math.max(0,Math.min(duration-.1,anchor,position));
    return {start,end:Math.min(duration,Math.max(start+.1,anchor,position))};
  }
  function pan(window,delta,duration) {
    const span=window.end-window.start,start=Math.max(0,Math.min(duration-span,window.start+delta));
    return {start,end:start+span};
  }
  function mount(owner) {
    let drag=null;
    function stop(){const old=drag;drag=null;if(old?.target.hasPointerCapture?.(old.pointer))old.target.releasePointerCapture(old.pointer);}
    function begin(event,edge=null){
      const state=owner.snapshot();
      if(event.button!==0||!state.usable||!state.window)return;
      if(edge&&owner.input(edge).disabled)return;
      stop();event.preventDefault();
      const target=edge?owner.input(edge):owner.rail,rect=owner.rail.getBoundingClientRect();
      drag={source:state.source,edge,range:state.range,window:{...state.window},duration:state.duration,target,pointer:event.pointerId,x:event.clientX,width:rect.width,left:rect.left,pan:!edge&&event.shiftKey,moved:false,created:false};
      target.focus?.();target.setPointerCapture(event.pointerId);
    }
    function move(event){
      if(!drag||event.pointerId!==drag.pointer)return;
      event.stopPropagation?.();
      if(owner.snapshot().source!==drag.source){stop();return;}
      const delta=event.clientX-drag.x;
      if(Math.abs(delta)>=3)drag.moved=true;
      if(!drag.moved)return;
      const span=drag.window.end-drag.window.start;
      if(drag.edge)owner.change(drag.edge,drag.range[drag.edge]+delta/drag.width*span);
      else if(drag.pan)owner.pan(pan(drag.window,-delta/drag.width*span,drag.duration));
      else {
        const anchor=at(drag.window,(drag.x-drag.left)/drag.width),position=at(drag.window,(event.clientX-drag.left)/drag.width);
        owner.select(selection(anchor,position,drag.duration),!drag.created);drag.created=true;owner.scrub(position);
      }
    }
    function finish(event){
      if(!drag||event.pointerId!==drag.pointer)return;
      if(!drag.moved&&!drag.edge&&!drag.pan)owner.scrub(at(drag.window,(event.clientX-drag.left)/drag.width));
      stop();
    }
    const targets=[owner.rail,...['start','end'].map(edge=>owner.input(edge))];
    for(const target of targets){target.onpointermove=move;target.onpointerup=finish;target.onpointercancel=target.onlostpointercapture=stop;}
    owner.rail.onpointerdown=event=>{if(event.target.tagName==='INPUT')return;begin(event);};
    for(const edge of ['start','end'])owner.input(edge).onpointerdown=event=>{event.stopPropagation();begin(event,edge);};
    globalThis.addEventListener?.('pagehide',stop);globalThis.addEventListener?.('blur',stop);
    document.addEventListener?.('visibilitychange',()=>{if(document.hidden)stop();});
    return {stop,active:()=>!!drag};
  }
  return {at,selection,pan,mount};
})();
if(typeof module!=="undefined")module.exports=FootageClipDrag;
