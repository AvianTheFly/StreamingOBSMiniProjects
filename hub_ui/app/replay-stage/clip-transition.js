// Finite viewport-only handoff. The playback owner chooses when to swap media.
export class ClipTransition {
  constructor(root, covered) {
    this.root=root;this.covered=covered;this.animations=[];this.revision=null;this.phase='idle';this.generation=0;
  }
  reset() {
    this.generation++;this.animations.forEach(a=>a.cancel());this.animations=[];
    this.root.style.visibility='hidden';this.root.dataset.closed='false';this.phase='idle';
  }
  update(state) {
    if(!state.active){this.reset();this.revision=null;return;}
    if(state.handoff && this.revision!==state.revision && ['covering','loading'].includes(state.phase)) this.close(state);
    else if(['revealing','playing'].includes(state.phase) && ['closing','closed'].includes(this.phase)) this.open(state);
    else if(state.phase==='returning') this.reset();
  }
  frames(closing) {
    const style=this.root.dataset.style, pair=(hidden,shown)=>closing?[hidden,shown]:[shown,hidden];
    if(style==='sweep') return [
      ['.left',pair({transform:'translateX(-150%)'},{transform:'translateX(0)'})],
      ['.right',pair({transform:'translateX(150%)'},{transform:'translateX(0)'})]];
    if(style==='iris') return [['.iris-disc',pair({clipPath:'circle(0% at 50% 50%)'},{clipPath:'circle(100% at 50% 50%)'})]];
    return [['.veil',pair({opacity:0},{opacity:1})]];
  }
  duration(state, closing) {
    if(state.motion===false || matchMedia('(prefers-reduced-motion: reduce)').matches || state.clip_transition==='cut') return 0;
    return state.clip_transition==='fade'?(closing?260:340):(closing?520:640);
  }
  async play(state, closing) {
    const generation=++this.generation;
    this.animations.forEach(a=>a.cancel());this.animations=[];
    const duration=this.duration(state,closing);
    const frames=this.frames(closing);
    frames.push(['.handoff-copy',closing?[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}]:[{opacity:1},{opacity:0}]]);
    frames.push(['.handoff-ring',closing?[{opacity:0,transform:'scale(.65) rotate(-35deg)'},{opacity:.7,transform:'scale(1) rotate(0deg)'}]:[{opacity:.7,transform:'scale(1)'},{opacity:0,transform:'scale(1.25) rotate(35deg)'}]]);
    for(const [selector,keyframes] of frames) this.animations.push(this.root.querySelector(selector).animate(keyframes,{duration,easing:'cubic-bezier(.7,0,.2,1)',fill:'forwards'}));
    await Promise.allSettled(this.animations.map(a=>a.finished));
    if(generation!==this.generation)return;
    if(closing){this.phase='closed';this.root.dataset.closed='true';this.covered(state.revision,'covered');}
    else{this.phase='idle';this.root.style.visibility='hidden';this.root.dataset.closed='false';this.covered(state.revision,'revealed');}
  }
  close(state) {
    this.revision=state.revision;this.phase='closing';this.root.dataset.style=state.clip_transition||'sweep';
    this.root.dataset.revision=String(state.revision);
    this.root.style.visibility='visible';this.root.dataset.closed='false';this.play(state,true);
  }
  open(state) {this.phase='opening';this.play(state,false);}
}
