// Playback only in the live desk; editing lives on the clip management page.
import {mountReplayPicker} from './replay-picker.js';

export function mountDeskReplays(root,refresh){
  const host=root.querySelector('#deskReplay'),editor=root.querySelector('.stage-editor-layout'),footer=root.querySelector('.stage-desk-footer');
  let opened=false,disposed=false,context={},picker;
  function open(stage){
    const next=stage==='replay';
    if(next===opened||disposed)return true;
    opened=next;host.hidden=!next;editor.hidden=next;footer.hidden=next;
    if(next){
      picker=mountReplayPicker(host,refresh);picker.update(context);
    }else{picker?.dispose();picker=null;host.replaceChildren();}
    return true;
  }
  return {open,beforeLeave:()=>true,update(next){context=next;picker?.update(next);},dispose(){disposed=true;picker?.dispose();picker=null;opened=false;host.replaceChildren();}};
}
