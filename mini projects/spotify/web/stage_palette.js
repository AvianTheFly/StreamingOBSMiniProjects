/* Authored color families. The journey owns their audible-time evolution;
 * this pure mapper keeps saturation and luminance bounded during hue travel. */
(function(root){
 'use strict';
 const families=[
  [[222,.88,.57],[185,.83,.64],[282,.87,.65]],
  [[192,.83,.60],[225,.77,.70],[332,.81,.64]],
  [[168,.80,.53],[204,.88,.65],[43,.89,.62]],
  [[250,.83,.65],[213,.88,.71],[26,.90,.61]],
  [[18,.77,.49],[36,.87,.62],[54,.84,.73]],
  [[285,.77,.60],[332,.85,.66],[173,.79,.62]],
  [[215,.87,.57],[185,.83,.63],[76,.86,.62]],
  [[181,.84,.56],[211,.85,.69],[350,.85,.65]],
  [[210,.88,.60],[177,.81,.66],[46,.87,.64]],
  [[263,.82,.64],[199,.88,.65],[329,.83,.64]],
  [[172,.84,.57],[222,.84,.68],[31,.88,.62]],
  [[233,.83,.63],[300,.81,.65],[178,.81,.63]],
  [[155,.85,.59],[49,.92,.64],[295,.81,.65]],
  [[12,.91,.57],[44,.92,.65],[192,.88,.61]],
  [[217,.86,.62],[180,.87,.61],[39,.91,.65]],
  [[148,.84,.55],[48,.88,.64],[207,.84,.65]],
  [[33,.92,.59],[278,.83,.64],[174,.83,.61]]
 ];
 // Independent complementary scores, rather than rotating every scene through
 // the same blue-to-pink wash. The three roles retain a vivid accent contrast.
 const scores=[
  [[19,.92,.57],[46,.92,.64],[183,.85,.60]],
  [[145,.84,.54],[194,.87,.62],[321,.85,.65]],
  [[232,.87,.63],[287,.83,.63],[49,.93,.65]],
  [[344,.86,.60],[28,.92,.62],[169,.85,.56]],
  [[185,.87,.55],[215,.87,.67],[17,.91,.62]],
  [[276,.84,.61],[326,.84,.64],[89,.84,.61]]
 ];
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 function rgb(h,s,l){
  h=(((h%360)+360)%360)/60;const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs(h%2-1)),m=l-c/2;
  const a=h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x];
  return a.map(v=>v+m);
 }
 function blend(a,b,q){
  const hue=((b[0]-a[0]+540)%360)-180;
  return [a[0]+hue*q,a[1]+(b[1]-a[1])*q,a[2]+(b[2]-a[2])*q];
 }
 function color(stage,t,j={}){
  // Each stage traverses different authored harmonies. Quiet passages linger;
  // musical time still owns progress, so silence cannot run a color animation.
  const phase=(j.palettePhase||0)/72,epoch=Math.floor(phase),fraction=phase-epoch;
  const a=epoch===0?families[stage]:scores[(epoch-1+stage*5)%scores.length];
  const b=scores[(epoch+stage*5)%scores.length];
  const q=fraction*fraction*(3-2*fraction),anchors=a.map((v,i)=>blend(v,b[i],q));
  // Keep the accent on the opposite side of the main color when two score
  // paths happen to meet during interpolation; never collapse to monochrome.
  const middle=anchors[1][0]-anchors[0][0],accent=anchors[2][0]-anchors[0][0];
  anchors[1][0]=anchors[0][0]+24+12*Math.sin(middle*Math.PI/180);
  anchors[2][0]=anchors[0][0]+165+25*Math.sin(accent*Math.PI/180);
  // Most of a form belongs to one close harmony. Reserve the complementary
  // color for authored accents instead of sweeping a rainbow over every rib.
  const position=clamp(t),u=position<=.78?position/.78:1+(position-.78)/.22;
  const index=Math.min(1,Math.floor(u)),qColor=u-index;
  const c=anchors[index].map((v,k)=>v+(anchors[index+1][k]-v)*qColor);
  const expression=j.motion?.pacing,intensity=expression?.intensity??.5;
  const lift=clamp(expression?.swell||0),rest=clamp(expression?.release||0);
  const accentRole=clamp((position-.78)/.22),phraseLight=(lift*.065-rest*.03)*(.35+accentRole*.65);
  return rgb(c[0]+(j.tone||0)*9,clamp((c[1]+(j.drive||0)*.04)*(.80+intensity*.20+lift*.06-rest*.06),.55,.96),
   clamp(c[2]+(j.motion?.high||0)*.025+(intensity-.5)*.035+phraseLight,.42,.73));
 }
 const api={color,families};root.VisualPalette=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
