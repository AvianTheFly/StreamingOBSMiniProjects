// Click-through windows receive no DOM mouse events. Read normalized OS pointer
// coordinates from the Hub instead; no mouse hooks, focus changes or input capture.
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
 let busy=false,stopped=false,last={game:true,x:null,y:null};
 const apply=()=>applyReadability(messages,getSettings(),last);
 async function tick(){
  if(busy||stopped)return;
  busy=true;
  try{if(!preview){const response=await fetch('/api/chat/pointer',{cache:'no-store'});if(!response.ok)throw Error();last=await response.json();}apply();}
  catch{last={game:true,x:null,y:null};apply();}
  finally{busy=false;}
 }
 if(preview){
  window.addEventListener('pointermove',event=>{last={game:true,x:event.clientX/innerWidth,y:event.clientY/innerHeight};apply();});
  window.addEventListener('pointerleave',()=>{last={game:true,x:null,y:null};apply();});
 }
 const observer=new MutationObserver(apply);observer.observe(messages,{childList:true});
 const timer=setInterval(tick,250);tick();
 window.addEventListener('beforeunload',()=>{stopped=true;clearInterval(timer);observer.disconnect();});
}
