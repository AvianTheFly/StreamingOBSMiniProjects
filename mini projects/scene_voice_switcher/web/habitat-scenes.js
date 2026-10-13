// Scene-local spirit weather and parchment jokes share the existing finite clock.
import {ellipse,glow,TAU} from './shared/world-motion.js';
import {phase} from './game-guest-acts.js';
import {line} from './league-spirit-ink.js';
export const habitats=new Set(['aurora-camp','sanctuary','forge','phoenix-observatory']);
import {environment} from './habitat-environment.js';
export {environment} from './habitat-environment.js';

const labels={
 'aurora-camp':['The thunder-bear answers the forest runes','Fireflies gather in the ancient forest','The wooden spoon achieves legendary status'],
 sanctuary:['The turtle sends ripples through the shrine','Blossoms drift from the bonsai','The leading snail gets a tiny victory lap'],
 forge:['The mountain ram wakes the forge','The furnace exhales a shower of embers','The duck blueprint gains even larger horns'],
 'phoenix-observatory':['The cryophoenix unfurls a frozen firestorm','A little sparkle follows the frozen tea spill','The egg attempts to warm its own hat']};
export function withHabitat(id,world){
 if(!habitats.has(id))return world;
 const cues=world.cues.filter(c=>['game-','league-','border-'].some(p=>c.id.startsWith(p))).map(c=>({...c,habitatStory:!c.id.startsWith('border-'),habitatZone:c.id.startsWith('league-')?(id==='forge'?'bench':id==='sanctuary'?'tea':id==='aurora-camp'?'tea':'ice-table'):c.habitatZone}));
 const artists={...world.artists};
 for(const [index,kind] of ['awakening','weather','lanterns'].entries()){
  const key='moment-'+kind;artists[key]=(c,a)=>environment(c,a,id,kind);
  cues.push({id:key,label:labels[id][index],description:'A finite reaction anchored to the painted room; no captions or screen-space decorations.',life:14,weight:.65,impact:.65,depth:'background',habitatZone:'scenery'});
 }
 return {...world,cues,artists};
}
