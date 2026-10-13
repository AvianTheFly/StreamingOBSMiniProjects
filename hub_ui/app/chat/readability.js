// Click-through windows receive no DOM mouse events. Read normalized OS pointer
// coordinates from the Hub instead; no mouse hooks, focus changes or input capture.
import {pollVisible} from '/shared/visible-poll.js';
export function applyReadability(messages, settings, pointer){
 const desktop=settings.focus_mode==='desktop'||(settings.focus_mode!=='game'&&pointer.game===false);
 const x=pointer.x===null?null:pointer.x*innerWidth,y=pointer.y===null?null:pointer.y*innerHeight;
 for(const row of messages.children){
  const rect=row.getBoundingClientRect();
  const hovered=x!==null&&y!==null&&x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom;
  row.classList.toggle('reading',hovered&&!desktop);
  row.classList.toggle('desktop-reading',desktop);
 }
}

export function watchReadability(messages,getSettings,{preview=false}={}){
 let last={game:true,x:null,y:null};
 const apply=()=>applyReadability(messages,getSettings(),last);
 const move=event=>{last={game:true,x:event.clientX/innerWidth,y:event.clientY/innerHeight};apply();};
 const leave=()=>{last={game:true,x:null,y:null};apply();};
 if(preview){
  window.addEventListener('pointermove',move);
  window.addEventListener('pointerleave',leave);
 }
 const poller=preview?null:pollVisible({url:'/api/chat/pointer',interval:250,timeout:2000,
  onData:value=>{last=value;apply();},onError:leave});
 const observer=new MutationObserver(apply);observer.observe(messages,{childList:true});
 const dispose=()=>{poller?.dispose();observer.disconnect();window.removeEventListener('pointermove',move);window.removeEventListener('pointerleave',leave);};
 window.addEventListener('beforeunload',dispose,{once:true});
 return {dispose};
}
