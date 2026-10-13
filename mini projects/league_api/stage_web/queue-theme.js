// Pure scheduling: a document seed and journey clock keep polling, hidden return
// and dodge requeues on the same presentation without retaining old schedules.
export const THEME_ORDER=['bear','turtle','ram','phoenix'];
export const THEME_SECONDS=45,FADE_SECONDS=4,EFFECT_COUNT=12;
function hash(value){let n=value>>>0;n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return (n^(n>>>16))>>>0;}
function shuffled(values,seed){const result=[...values];for(let i=result.length-1;i>0;i--){seed=hash(seed+i+1);const j=seed%(i+1);[result[i],result[j]]=[result[j],result[i]];}return result;}
function lastInBag(seed,bag){return hash(seed+Math.imul(bag+1,0x9e3779b9))%4;}
export function themeOrder(seed,bag){
  // Visit every spirit once per bag. Its known last item lets the next bag avoid
  // an immediate repeat in constant work, even after a long hidden interval.
  const last=lastInBag(seed,bag),previous=lastInBag(seed,bag-1);
  const rest=shuffled([0,1,2,3].filter(i=>i!==last),hash(seed+bag));
  if(bag>0&&rest[0]===previous)[rest[0],rest[1]]=[rest[1],rest[0]];
  return [...rest,last].map(i=>THEME_ORDER[i]);
}
export function effectPlan(theme,seed,visit){
  const key=hash(seed+Math.imul(visit+1,7919)+THEME_ORDER.indexOf(theme)*104729);
  const stories=shuffled([8,9,10,11],key).slice(0,2),accent=shuffled([0,1,2,3,4,5,6,7],hash(key+37))[0];
  return shuffled([...stories,accent],hash(key+73));
}
export function effectCues(plan,local,previous=plan){
  // Nineteen-second gestures overlap for four seconds. One persistent world
  // interpolates these weights instead of fading down to an idle illustration.
  const slot=Math.min(2,Math.floor(local/15)),age=local-slot*15,u=Math.min(1,age/4),blend=u*u*(3-2*u);
  const cue=(id,age,weight)=>{const phase=Math.min(1,age/19);return {id,phase,weight,amount:Math.sin(phase*Math.PI)**2};};
  return [cue(slot?plan[slot-1]:previous[2],age+15,1-blend),cue(plan[slot],age,blend)].filter(c=>c.weight>0);
}
export function effectCue(plan,local){
  return effectCues(plan,local).reduce((a,b)=>a.weight>b.weight?a:b);
}
export function blendCues(from,to,mix){
  const result=new Map();
  for(const [cues,scale] of [[from,1-mix],[to,mix]])for(const cue of cues||[]){
    const weight=(cue.weight??1)*scale;if(weight<=0)continue;
    const entry=result.get(cue.id)||{id:cue.id,weight:0,phase:0,amount:0};
    entry.weight+=weight;entry.phase+=cue.phase*weight;entry.amount+=cue.amount*weight;result.set(cue.id,entry);
  }
  return [...result.values()].map(c=>({...c,phase:c.phase/c.weight,amount:c.amount/c.weight}));
}
export function themeFrame(data,seconds,motion=true){
  const base=THEME_ORDER.includes(data.theme)?data.theme:'bear';
  const time=Number.isFinite(seconds)?Math.max(0,seconds):0,step=Math.floor(time/THEME_SECONDS),local=time%THEME_SECONDS;
  const seed=hash((Number(data.visual_seed)||0)+Math.imul(Number(data.journey)||0,65537));
  const at=visit=>themeOrder(seed,Math.floor(visit/4))[visit%4];
  const rotating=(data.theme_mode||data.theme)==='rotate',to=rotating?at(step):base,from=rotating&&step?at(step-1):to;
  const blend=Math.min(1,local/FADE_SECONDS),mix=motion&&from!==to?blend*blend*(3-2*blend):1;
  const plan=effectPlan(to,seed,step),previousPlan=effectPlan(from,seed,Math.max(0,step-1));
  const cues=motion?effectCues(plan,local,previousPlan):[];
  const previousPhase=Math.min(1,(15+local)/19),fromCues=motion?[{id:previousPlan[2],phase:previousPhase,weight:1,amount:Math.sin(previousPhase*Math.PI)**2}]:[];
  return {from,to,mix,current:mix<.5?from:to,visit:step,plan,cues,fromCues,cue:cues.length?cues.reduce((a,b)=>a.weight>b.weight?a:b):null};
}
