// One measured score for queue duration, single-pass audio and musical blocking.
export const RAID_SCORES=await fetch('/raid_score.json').then(r=>{if(!r.ok)throw Error('Raid score unavailable');return r.json();});
export const raidScore=theme=>RAID_SCORES[theme]||RAID_SCORES.crab;
// Monotone Hermite retiming preserves shared contact points and smooth velocity.
// The story coordinate is choreography, not wall-clock seconds.
export function storyAt(theme,seconds){
 const points=raidScore(theme).anchors;
 if(seconds<=0)return 0;if(seconds>=points.at(-1)[0])return 8;
 const i=points.findIndex((p,j)=>j<points.length-1&&seconds<points[j+1][0]);
 const slope=j=>(points[j+1][1]-points[j][1])/(points[j+1][0]-points[j][0]);
 const tangent=j=>j===0?slope(0):j===points.length-1?slope(j-1):2/(1/slope(j-1)+1/slope(j));
 const [x,y]=points[i],h=points[i+1][0]-x,u=(seconds-x)/h;
 return (2*u**3-3*u*u+1)*y+(u**3-2*u*u+u)*h*tangent(i)+(-2*u**3+3*u*u)*points[i+1][1]+(u**3-u*u)*h*tangent(i+1);
}
export function musicAt(theme,story){
 let lo=0,hi=raidScore(theme).duration;
 for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(storyAt(theme,mid)<story)lo=mid;else hi=mid;}
 return (lo+hi)/2;
}
export function musicalMotion(theme,seconds){
 const score=raidScore(theme),beat=(seconds-score.beats[0])*score.bpm/60;
 const age=(beat-Math.floor(beat))*60/score.bpm;
 return {theme,seconds,beat,punch:beat<0?0:Math.exp(-age/ .075)};
}
export function beatTime(theme,story){
 const time=musicAt(theme,story);
 return raidScore(theme).beats.reduce((a,b)=>Math.abs(b-time)<Math.abs(a-time)?b:a);
}
