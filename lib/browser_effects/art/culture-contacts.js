// Cue-specific blocking in canvas coordinates. These are the same anchors used
// by the drawing owners and the finite contact review; no simulation or clock.
const cultureUnit=q=>Math.max(0,Math.min(1,q));
export function cultureCrabMotion(p,index){
 const x=454+index*155,ballX=345+cultureUnit((p-.3)/.56)*1240;
 const crossing=.3+(x-345)/1240*.56,q=smooth((p-crossing+.065)/.13);
 return{x,ballX,crossing,y:1041-Math.sin(q*Math.PI)*45,roll:index===6?q*Math.PI:0};
}
export function cultureToastMotion(p){
 const q=cultureUnit((p-.54)/.23),caught=p>=.77,hand={x:1837,y:414};
 return{q,caught,hand,toast:{x:hand.x+Math.sin(q*Math.PI)*33,y:575+(hand.y-23*.8-575)*q-Math.sin(q*Math.PI)*92,a:q*Math.PI*2}};
}
export function cultureDetectiveMotion(p){
 const walk=smooth((p-.06)/.32),slip=smooth((p-.4)/.19),peel={x:186,y:540};
 const root={x:142+walk*22,y:455},pivot={x:root.x+22,y:540};
 return{walk,slip,peel,pivot,root,rise:slip*21,a:-slip*1.22,foot:{x:pivot.x,y:pivot.y},glasses:smooth((p-.54)/.15)};
}
export function cultureSpillMotion(p){
 const q=cultureUnit((p-.12)/.26),fall=q*q,a=-q*Math.PI/2;
 // Rounded mug body: half-height 31, half-width 29, at 1.05 scale.
 const bottom=1.05*(Math.abs(Math.sin(a))*29+Math.abs(Math.cos(a))*31);
 const surface=558,landed=p>=.38;
 return{q,a,landed,surface,x:91+fall*15,y:365+(surface-bottom-365)*fall,puddle:smooth((p-.38)/.15)};
}
export function cultureMuteMotion(p,d=5.04){
 const t=p*d,contact=SOUND_LINEUPS.mute;
 const approach=smooth((t-.42)/(contact-.42)),clicked=t>=contact,settle=smooth((t-contact)/.16);
 return{clicked,settle,contact,target:{x:1841,y:540},cursor:{x:1884+(1841-1884)*approach,y:744+(540-744)*approach},release:smooth((t-.94)/.42)};
}
export function cultureRescueBlockMotion(p){
 const rescue=cultureRescueMotion(p),fist={x:rescue.hero.x+53*1.2,y:rescue.hero.y-52*1.2};
 const attack=cultureUnit((p-.59)/.13),deflect=cultureUnit((p-.72)/.16);
 const bolt=p<=.72?{x:1882+(fist.x-1882)*attack,y:250+(fist.y-250)*attack}
  :{x:fist.x+(1756-fist.x)*deflect,y:fist.y+(248-fist.y)*deflect};
 return{fist,bolt,attack,deflect,health:smooth((p-.55)/.15)};
}
