// Contact contracts for the revised romance acts. Pure, seekable, one-shot paths.
export function roseCourierMotion(p){
 const drop=smooth((p-.32)/.2),catching=smooth((p-.57)/.16),reach=smooth((p-.45)/.12);
 const rose={x:40+drop*21*(1-catching),y:-28+drop*42*(1-catching),a:drop*.8*(1-catching)};
 const grip={x:rose.x-Math.sin(rose.a)*11,y:rose.y+Math.cos(rose.a)*11};
 const hand={x:40+(grip.x-40)*reach,y:-17+(grip.y+17)*reach};
 return {hand,rose,caught:p>=.73,blush:smooth((p-.73)/.13)};
}
export function cupidArrowMotion(p){
 const q=smooth((p-.3)/.43),a=q*TAU,start={x:157,y:465},target={x:95,y:419.4};
 // A single curling shot returns to his chest. Position and tangent stay continuous.
 const x=start.x+(target.x-start.x)*q+Math.sin(a)*43,y=start.y+(target.y-start.y)*q-Math.sin(q*Math.PI)*99;
 const dx=target.x-start.x+TAU*Math.cos(a)*43,dy=target.y-start.y-Math.PI*Math.cos(q*Math.PI)*99;
 const angle=Math.atan2(dy,dx);
 return {x:x-Math.cos(angle)*20.3,y:y-Math.sin(angle)*20.3,a:angle,tip:{x,y},caught:p>=.73,fade:1-smooth((p-.74)/.06),target};
}
export function roseReceiptMotion(p){return {open:smooth((p-.43)/.2),stamp:smooth((p-.66)/.17)};}
export function paperTurnMotion(q){return {xScale:Math.cos(Math.max(0,Math.min(1,q))*TAU),angle:0};}
export function coffinHatMotion(p){const turn=smooth((p-.44)/.34),lift=Math.sin(turn*Math.PI);return {x:lift*35,y:-56-lift*104,a:turn*TAU};}
export function toothlessFishMotion(p){
 const q=smooth((p-.3)/.3),hop=Math.sin(smooth((p-.45)/.2)*Math.PI),gulp=smooth((p-.58)/.045);
 return {x:105+Math.sin(q*Math.PI)*24,y:247+q*177.7-hop*34,scale:.8*(1-gulp),a:q*2,mouth:{x:105,y:424.7-hop*34}};
}
