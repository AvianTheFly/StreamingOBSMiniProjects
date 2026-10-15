// Shared cue clock contract: canvas impacts and DOM response use these same seconds.
export const LOCK={launch:0,impact:.18,end:4.2};
export const BAN={impact:.35,end:2.7};
export const CHAT={impact:.65,end:2.5};
export function cueResponse(cue,age){
 if(age<0)return {charge:0,hit:0,recoil:0};
 const impact=cue.kind==='lock'?LOCK.impact:cue.kind==='ban'?BAN.impact:CHAT.impact;
 const d=age-impact;
 if(d<0)return {charge:Math.max(0,age/impact),hit:cue.kind==='lock'?.28*(1-age/impact):0,recoil:0};
 return {charge:0,hit:Math.max(0,1-d/.5)**2,recoil:Math.sin(d*28)*Math.exp(-d*9)};
}
const bindings=new WeakMap();
export function releaseResponses(stage){
 const binding=bindings.get(stage);if(!binding)return;
 for(const el of binding.active){for(const key of ['hit','charge','recoil'])el.style.removeProperty('--cue-'+key);el.classList.remove('react-lock','react-ban','react-chat');}
 bindings.delete(stage);
}
export function paintResponses(stage,cues,time){
 let binding=bindings.get(stage);if(!binding){binding={nodes:new Map(),active:new Set()};bindings.set(stage,binding);}
 const responses=new Map();
 for(const cue of cues){
  const selector=cue.key?`#${cue.key==='allyBans'?'ally-bans':cue.key==='enemyBans'?'enemy-bans':cue.key} > :nth-child(${cue.index+1})`:cue.kind==='chat'?'.chat':null;
  if(selector){let el=binding.nodes.get(selector);if(!el){el=stage.querySelector(selector);if(el)binding.nodes.set(selector,el);}if(el)responses.set(el,cueResponse(cue,time-cue.at));}
 }
 for(const el of binding.active)if(!responses.has(el)){for(const key of ['hit','charge','recoil'])el.style.removeProperty('--cue-'+key);el.classList.remove('react-lock','react-ban','react-chat');}
 for(const [el,r] of responses){
  el.style.setProperty('--cue-hit',r.hit.toFixed(3));el.style.setProperty('--cue-charge',r.charge.toFixed(3));el.style.setProperty('--cue-recoil',r.recoil.toFixed(3));
 }
 binding.active=new Set(responses.keys());
}
