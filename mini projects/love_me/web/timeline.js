// Cue anchor maps an explicitly trimmed audio excerpt onto authored imagery.
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const audioFileTime=(elapsed,row)=>(row.audio_start||0)+elapsed*(row.audio_rate||1);
export function authoredTime(t,row){
 const anchor=row.audio_anchor??row.anchor;
 if(t<=anchor)return anchor>0?t/anchor*row.anchor:row.anchor;
 return row.anchor+(t-anchor)/(row.duration-anchor)*(row.timeline_duration-row.anchor);
}
export function cueAt(t,row){
 const u=authoredTime(t,row),cuts=row.cuts;
 let index=0;while(index+1<cuts.length&&u>=cuts[index+1])index++;
 const next=cuts[index+1]??row.timeline_duration;
 return {index,progress:clamp((u-cuts[index])/Math.max(.05,next-cuts[index])),time:u,
         fade:Math.min(clamp(t/.6),clamp((row.duration-t)/.8)),
         phase:u<row.anchor?0:u<row.timeline_duration*.76?1:2};
}
