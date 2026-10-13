// Shared cue clock contract: canvas impacts and DOM response use these same seconds.
export const LOCK={launch:.42,impact:.72,end:4.2};
export const BAN={impact:.35,end:2.7};
export const CHAT={impact:.65,end:2.5};
export function cueResponse(cue,age){
 const impact=cue.kind==='lock'?LOCK.impact:cue.kind==='ban'?BAN.impact:CHAT.impact;
 const d=age-impact;
 if(d<0)return {charge:Math.max(0,age/impact),hit:0,recoil:0};
 return {charge:0,hit:Math.max(0,1-d/.5)**2,recoil:Math.sin(d*28)*Math.exp(-d*9)};
}
export function paintResponses(stage,cues,time){
 const responses=new Map();
 for(const cue of cues){
  const selector=cue.key?`#${cue.key==='allyBans'?'ally-bans':cue.key==='enemyBans'?'enemy-bans':cue.key} > :nth-child(${cue.index+1})`:cue.kind==='chat'?'.chat':null;
  if(selector)responses.set(selector,cueResponse(cue,time-cue.at));
 }
 for(const el of stage.querySelectorAll('.react-lock,.react-ban,.react-chat')){
  let r={hit:0,charge:0,recoil:0};for(const [selector,response] of responses)if(el.matches(selector))r=response;
  el.style.setProperty('--cue-hit',r.hit.toFixed(3));el.style.setProperty('--cue-charge',r.charge.toFixed(3));el.style.setProperty('--cue-recoil',r.recoil.toFixed(3));
 }
}
