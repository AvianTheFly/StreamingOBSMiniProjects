// A single disposable pointer/keyboard camera. No playback or browser channels.
export class Camera {
  constructor(svg, world, changed) {
    this.svg=svg;this.world=world;this.changed=changed;this.scale=1;this.x=0;this.y=0;this.drag=null;
    this.abort=new AbortController();const opts={signal:this.abort.signal};
    svg.addEventListener('wheel',e=>{e.preventDefault();const box=svg.getBoundingClientRect();this.zoom(Math.exp(-e.deltaY*.0015),e.clientX-box.left,e.clientY-box.top);},{...opts,passive:false});
    svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,ox:this.x,oy:this.y,moved:false,node:e.target.closest('[data-node]')?.dataset.node};svg.setPointerCapture(e.pointerId);},opts);
    svg.addEventListener('pointermove',e=>{if(!this.drag||this.drag.id!==e.pointerId)return;const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;this.drag.moved ||= Math.hypot(dx,dy)>5;this.x=this.drag.ox+dx;this.y=this.drag.oy+dy;this.apply();},opts);
    svg.addEventListener('pointerup',()=>{this.suppressClick=!!this.drag?.moved;this.lastNode=this.drag?.node;this.drag=null;},opts);
    svg.addEventListener('pointercancel',()=>{this.drag=null;},opts);
    svg.addEventListener('keydown',e=>{if(e.target!==svg)return;let used=true;if(e.key==='+'||e.key==='=')this.zoom(1.2);else if(e.key==='-')this.zoom(1/1.2);else if(e.key==='0')this.fit();else if(e.key==='ArrowLeft')this.x+=50;else if(e.key==='ArrowRight')this.x-=50;else if(e.key==='ArrowUp')this.y+=50;else if(e.key==='ArrowDown')this.y-=50;else used=false;if(used){e.preventDefault();this.apply();}},opts);
    this.resize=new ResizeObserver(()=>{if(!this.initialized&&svg.clientWidth){this.fit();this.initialized=true;}});this.resize.observe(svg);
  }
  apply(reason=''){this.world.setAttribute('transform',`translate(${this.x} ${this.y}) scale(${this.scale})`);this.changed(this.scale,reason);}
  zoom(factor,cx=this.svg.clientWidth/2,cy=this.svg.clientHeight/2){const next=Math.min(2.2,Math.max(.18,this.scale*factor)),ratio=next/this.scale;this.x=cx-(cx-this.x)*ratio;this.y=cy-(cy-this.y)*ratio;this.scale=next;this.apply('zoom');}
  setModel(model){this.model=model;}
  fit(){if(!this.model)return;const {width,height}=this.model;this.scale=Math.min(1.08,(this.svg.clientWidth-54)/width,(this.svg.clientHeight-50)/height);this.scale=Math.max(.18,this.scale);this.x=(this.svg.clientWidth-width*this.scale)/2;this.y=(this.svg.clientHeight-height*this.scale)/2;this.apply();}
  focus(box){this.scale=Math.min(1.25,(this.svg.clientWidth-60)/box.w,(this.svg.clientHeight-60)/box.h);this.x=(this.svg.clientWidth-box.w*this.scale)/2-box.x*this.scale;this.y=(this.svg.clientHeight-box.h*this.scale)/2-box.y*this.scale;this.apply();}
  dispose(){this.abort.abort();this.resize.disconnect();}
}
