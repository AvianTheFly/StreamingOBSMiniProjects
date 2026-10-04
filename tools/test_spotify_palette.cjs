// Regress the hue-sector bug (every hue previously became red/magenta), plus
// score continuity and simultaneous contrast across the complete catalog.
const assert=require('node:assert/strict');
const Palette=require('../mini projects/spotify/web/stage_palette.js');
const Journey=require('../mini projects/spotify/web/journey.js');
assert.equal(Palette.families.length,Journey.names.length);
const base=Palette.families.map((_,stage)=>Palette.color(stage,0));
assert(base.some(c=>c[1]>c[0]+.3&&c[1]>c[2]+.1),'authored emerald must render green');
assert(base.some(c=>c[2]>c[0]+.3),'authored blue must render blue');
assert(base.some(c=>c[0]>c[2]+.3),'authored fire must render warm');
let minContrast=Infinity,maxStep=0;
for(let stage=0;stage<Journey.names.length;stage++)for(let phase=0;phase<=720;phase+=.5){
 const a=Palette.color(stage,0,{palettePhase:phase}),b=Palette.color(stage,1,{palettePhase:phase});
 const contrast=Math.hypot(...a.map((v,k)=>v-b[k]));minContrast=Math.min(minContrast,contrast);
 assert(contrast>.45,'primary and accent must never collapse to one color');
 for(const t of [0,.25,.5,.75,1]){
  const c=Palette.color(stage,t,{palettePhase:phase}),d=Palette.color(stage,t,{palettePhase:phase+.001});
  assert(c.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
  maxStep=Math.max(maxStep,...c.map((v,k)=>Math.abs(v-d[k])));
 }
}
assert(maxStep<.001,'score changes must have no hue jumps');
console.log(JSON.stringify({passed:true,stages:Journey.names.length,fullSpectrum:true,minContrast,maxStep}));
