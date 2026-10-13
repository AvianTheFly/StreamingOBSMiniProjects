// Finite reaction blocking: a consequence appears once after its cause.
// These are presentation contracts, never game detection or mutable simulation.
export function aceSweepMotion(p){
 const first=smooth((p-.31)/.27),returnForSpeck=smooth((p-.69)/.13);
 return {x:-47+first*76+returnForSpeck*21,a:-.2+first*.3-returnForSpeck*.1,speck:smooth((p-.59)/.07)*(1-smooth((p-.77)/.045)),second:returnForSpeck};
}
export function emptyDropMotion(p){
 const age=Math.max(0,Math.min(1,(p-.66)/.16));
 return {age,visible:p>.66&&p<.82,x:31+age*17,y:18+age*58,shake:Math.sin(age*TAU*2)*Math.sin(age*Math.PI)*.09};
}
export function grubHopMotion(p,index){
 const q=smooth((p-.16-index*.085)/.42);
 return {q,y:-Math.sin(q*Math.PI)*(23+index*6),sleep:index===2&&q<.25};
}
function storyPayoffs(c,e){
 if(!Number.isFinite(e.duration))return;
 const I=storyInk(c,e),{p,at,line,poly,oval,face,box}=I;
 const keys=['baron','cs_milestone','turret_destroyed','first_turret','inhibitor_destroyed'];
 const born=e.key==='baron'||e.key==='cs_milestone'?.48:.22;
 if(!keys.includes(e.key)||p<born)return;
 const arrive=smooth((p-born)/.15),react=smooth((p-.69)/.14);
 at(970,1015+(1-arrive)*43,.8,0,()=>{
  if(e.key==='baron'){
   I.bean(0,12,1,'#bca7d1',react*.6);
   // A minion-sized wearer tries the oversized Baron horns, wobbles, then balances.
   at(0,-7,1,Math.sin(react*TAU)*.28*(1-react),()=>{poly([[-26,0],[-32,-16],[-18,-12],[-8,-23],[8,-23],[18,-12],[32,-16],[26,0]],'#bba9d2');for(const s of [-1,1])poly([[s*18,-10],[s*43,-39],[s*37,-1]],'#d2c3de');});
  }else if(e.key==='cs_milestone'){
   line([[0,-22],[0,36]],'#b7a785',6);line([[-24,-1],[24,-1]],'#b7a785',6);
   box(-18,-4,36,25,'#b5c5a1');oval(0,-18,16,14,'#d7c49a');face(0,-18);
   at(-react*7,-31-react*12,1,-react*.23,()=>{poly([[-25,3],[25,3],[12,-3],[8,-18],[-8,-18],[-12,-3]],'#dcc494');line([[-11,-3],[11,-3]],'#a49683',3);});
  }else{
   // The miniature safety marshal braces under an umbrella before the crush.
   poly([[-17,32],[0,-5],[17,32]],'#d6ad88');line([[-23,34],[23,34]],'#c6b89c',6);face(0,21);
   line([[0,10],[0,-39]],'#b8c4bf',3);poly([[-46,-22],[-30,-39],[0,-48],[30,-39],[46,-22],[15,-25],[0,-21],[-15,-25]],'#acc9bc');
   const dust=smooth((p-.53)/.15)*(1-smooth((p-.76)/.08));
   c.save();c.globalAlpha*=dust;for(let j=0;j<4;j++)oval(-36+j*24,-36+(1-dust)*12,3,3,'#d1c2a5');c.restore();
   // Clear weather: a single little star finishes the protective reaction.
   at(0,-24,react,.05,()=>I.star(0,0,9,'#e0c995'));
  }
 });
}
