/* A continuous frequency field inside the existing sculpture. It deforms shared
 * vertices and grades their material; it never emits extra shapes or particles.
 * The eight register envelopes and held-partial gestures use the capture clock. */
(function(root){
 'use strict';
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
 const mix=(a,b,t)=>a+(b-a)*t;
 function create(m){
  const levels=m.absoluteVoices?m.presenceVoices:m.voices,a=m.articulation||{};
  // Smooth interpolation keeps shared faces and outlines coincident, including
  // during morphs. The profile has a fixed eight-register budget per paint.
  const profile=Array.from({length:8},(_,i)=>{
   const level=clamp(levels?.[i]),phase=m.flowPhases?.[i]||0;
   const presence=1-Math.exp(-level*3),pan=m.voiceBalances?.[i]||0;
   return {presence,lift:presence*(18+28*Math.sin(phase*.8+i*.72)),
    depth:presence*(32*Math.cos(phase*.63+i*.8)-28),
    bend:presence*(Math.sin(phase*.55+i*.6)*.24+pan*.12)};
  });
  function sample(p){
   const z=p[2]||0,unproject=(280+z)/280,x=p[0]*unproject,y=p[1]*unproject;
   const lane=clamp((x+154)/308)*7,lo=Math.min(6,Math.floor(lane));
   let t=lane-lo;t=t*t*(3-2*t);
   const left=profile[lo],right=profile[lo+1];
   const presence=mix(left.presence,right.presence,t),lift=mix(left.lift,right.lift,t);
   const depth=mix(left.depth,right.depth,t),bend=mix(left.bend,right.bend,t);
   // A held partial bends the structure; pitch moves the bend's centre.
   // Percussion folds the same surfaces briefly instead of throwing fragments.
   const lead=clamp(a.lead),pitch=clamp(a.pitch??.5),attack=clamp(a.attack),air=clamp(a.air);
   const centre=(pitch-.5)*170,arch=Math.exp(-(((x-centre)/100)**2));
   const phrase=lead*arch*Math.sin(x*.012-(a.phase||0));
   const ripple=air*presence*Math.sin(x*.085+y*.025-(a.airPhase||0))*2;
   // Traveling note history curls the cross-section rather than translating
   // every point together. Stereo steers sideways, pitch glides change torsion.
   const age=clamp((y+z*.4+100)/220),dance=m.dance;
   const wave=dance?dance.at(lane,age):0,delayed=dance?dance.at(lane,clamp(age+.16)):0;
   const turn=dance?mix(dance.turn[lo],dance.turn[lo+1],t):0;
   const sway=dance?mix(dance.sway[lo],dance.sway[lo+1],t):0;
   const twist=wave*.7+turn*.35,cs=Math.cos(twist),sn=Math.sin(twist);
   const yy=(y*cs-z*sn)*(1+presence*.20)-lift*.65+phrase*16+wave*24+attack*presence*7+ripple;
   const xx=x+y*bend+phrase*5+(wave-delayed)*35+sway*18;
   const zz=(y*sn+z*cs)*(1+presence*.28)+depth+phrase*24+delayed*36-attack*presence*12;
   const projection=280/Math.max(80,280+zz);
   return {point:[xx*projection,yy*projection,zz],presence,
    light:clamp(presence*.72+lead*arch*.2+attack*presence*.16)};
  }
  return {sample};
 }
 root.VisualArticulation={create};if(typeof module!=='undefined'&&module.exports)module.exports={create};
})(globalThis);
