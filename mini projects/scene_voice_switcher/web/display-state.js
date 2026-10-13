// The document owns this read-only observer through the shared visibility lifecycle.
import {pollVisible} from '/shared/visible-poll.js';
export function observeDisplay(source,receive){
 return pollVisible({url:'/api/projects/scene_voice_switcher/display_state?source='+encodeURIComponent(source),interval:750,onData:state=>{if(state.source===source&&typeof state.visible==='boolean')receive(state.visible);}});
}
