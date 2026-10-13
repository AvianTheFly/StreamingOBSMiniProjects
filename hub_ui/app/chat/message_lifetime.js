// The browser owns message age. One compositor fade per row, swept by the
// overlay's existing expiry timer; readability cannot revive an old message.
const fades=new WeakMap();
export function removeMessage(row){fades.get(row)?.cancel();fades.delete(row);row.remove();}
export function clearMessages(messages){for(const row of [...messages.children])removeMessage(row);}
export function ageMessages(messages,seconds,now=Date.now(),holdSeconds=0){
 const duration=Math.max(0,Number(seconds)||0)*1000;
 const delay=Math.max(0,Number(holdSeconds)||0)*1000;
 for(const row of [...messages.children]){
  const age=Math.max(0,now-Number(row.dataset.time));
  let fade=fades.get(row);
  if(duration&&age>=duration+delay){removeMessage(row);continue;}
  if(!duration){fade?.cancel();fades.delete(row);continue;}
  if(fade?.effect.getTiming().duration===duration&&fade.effect.getTiming().delay===delay)continue;
  fade?.cancel();
  fade=row.animate([{opacity:1},{opacity:0}],{duration,delay,fill:'both',easing:'linear'});
  fade.currentTime=age;fades.set(row,fade);
 }
}
