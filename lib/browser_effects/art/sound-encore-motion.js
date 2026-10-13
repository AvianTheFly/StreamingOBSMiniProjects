// Finite second-act blocking. Coordinates belong to the small bottom-rim stage.
export function encoreThrowMotion(q){
 const u=smooth(Math.max(0,Math.min(1,q)));
 return {x:-38+u*87,y:8+u*15-Math.sin(u*Math.PI)*58,a:u*1.7,landed:q>=1,target:{x:49,y:23}};
}
export function encoreBootMotion(q){
 const press=smooth(q/.46),lift=smooth((q-.55)/.31);
 return {y:-49+press*35-lift*35,stamp:smooth((q-.46)/.06),alpha:1-smooth((q-.88)/.12),foot:30*.7,surface:7};
}
export function encoreTeaMotion(q){const tray=Math.sin(Math.max(0,Math.min(1,q))*Math.PI)*.28;return {tray,cup:-tray};}
export function encoreToastMotion(q,index){const u=smooth((q-index*.19)/.39);return {x:0,y:30-index*18-(1-u)*69,a:(1-u)*(index%2?.23:-.23),landed:u===1};}
export function encoreSilenceMotion(q){
 const move=smooth(q/.54),fold=smooth((q-.54)/.17),sleep=smooth((q-.72)/.19);
 return {x:-73+move*45,y:8-Math.sin(move*Math.PI)*14,fold,alpha:1-fold,sleep};
}
