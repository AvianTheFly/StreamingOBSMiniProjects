// Authored contacts in ORIGINAL clip seconds. The existing audio clock supplies t;
// these finite paths neither analyse audio nor introduce a timer during playback.
// PCM witnesses: output/border-lineup-audit/original-timing-study.json (10 ms hops).
export const SOUND_LINEUPS={approval:.16267,lizard:.11267,bonk:.06,quack:.17267,
 garyOn:.03,garyOff:.36,wowOn:.18,wowFull:1.01267,mute:.76,
 noLate:7.56,noFinal:8.82};
export function soundContactMotion(key,t){
 const contact=SOUND_LINEUPS[key];
 const lead={approval:.105,lizard:.09,bonk:.045,quack:.13}[key];
 const approach=smooth((t-contact+lead)/lead),hit=t>=contact;
 return{contact,approach,hit,age:t-contact};
}
export function stampLineupMotion(t){
 const m=soundContactMotion('approval',t),release=smooth((t-.25)/.18);
 return{...m,release,unfurl:smooth((t-.28)/.39),
  // Stamp bottom is +16; checklist top is -12. Exact shared contact plane.
  y:-87+m.approach*59-release*26,paperTop:-12,bottom:16};
}
export function quackLineupMotion(t,index=0){
 const m=soundContactMotion('quack',t),born=m.contact+index*.03;
 return{...m,close:smooth(m.age/.085),born,escaped:t>=born,
  escape:smooth((t-born)/.37),target:{x:1878,y:622},
  cursor:{x:1780+98*m.approach,y:732-110*m.approach}};
}
