// Authored League border composition and scenic geometry; no detection or timers.
import {smooth,EdgeFinish,Optics,pathOf,TAU} from './subtle.js';
import {eventRelics,soulRelics,artReady} from './event-relics.js';
import {hextechAtmosphere,hextechSurge} from './elements.js';
import {colors as legacyColors} from './palette.js';
const PALETTES={earth:'#bdc4aa',fire:'#e9a171',water:'#79d9c7',air:'#b7dfef',hextech:'#75bded',chemtech:'#b6cd7b',elder:'#e1d4ed',void:'#b7a0dd',blood:'#d48b9c',gold:'#dac58c',mint:'#90cfb8',cyan:'#8ecedd',arcane:'#b6a6dc',ash:'#a8beca'};
const descriptions={
 kill:'Single blade / cooling wake',assist:'Braided support links',first_blood:'One drop / unfurling crimson silk',low_hp_kill:'Scar line repaired by a gold thread',low_hp_multikill:'Pulse woven into an ascending constellation',
 double_kill:'Twin crossing comets',triple_kill:'Three orbiting satellites',quadra_kill:'Four compass petals',pentakill:'Five ascending constellations / feather filigree',ace:'Five team links closing a constellation',
 dragon:'Draconic scale procession',dragon_earth:'Fault-line cartography / mineral light',dragon_fire:'Rising ember calligraphy',dragon_water:'Tidal refraction / flowing current',dragon_air:'Aerial isobars / wind vanes',dragon_hextech:'Hexagonal circuits / travelling charge',dragon_chemtech:'Glass botanical chambers / vapor',dragon_elder:'Ancient silver wing engraving',
 baron:'Void tide / curling bioluminescent tendrils',herald:'One watchful iris / heralding spiral',void_grub:'Tiny burrowing constellation / marching mites',objective_steal:'A thread stolen from one orbit into another',atakhan_legacy:'Thorn relic / blood-red bloom',
 turret_destroyed:'Architectural blueprint dissolving at its joints',first_turret:'Foundation keystone / rising survey lines',inhibitor_destroyed:'Crystalline containment lattice releases',inhibitor_respawning_soon:'Dormant crystal traced in fragments',inhibitor_respawned:'Crystal facets knit back together',
 death:'Soul sanctuary / suspended hourglass shards',respawn:'Gateway petals unfolding into the Rift',low_health:'A restrained living ECG thread',heavy_health_loss:'Hairline glass cracks that settle',large_heal:'Seedlings following a restorative current',
 resource_spent:'A reservoir drains into an arc',level_up:'An ascending rune stair',ultimate_learned:'A four-sided arcane observatory unlocks',ability_rank_up:'One rune notch illuminated',inventory_added:'A floating glass reliquary receives a gem',inventory_removed:'A vacant reliquary dissolves',cs_milestone:'Golden harvest blades / drifting seeds',vision_activity:'Radar sonar reveals a small ward constellation',manpower_advantage:'Unequal allied and enemy star lines',
 game_start:'A threshold of summoning rings',minions_spawning:'A lantern procession along a lane',victory:'Gold laurel branches / quiet celestial canopy',defeat:'Torn silver banner / fireflies endure',game_end:'The final chapter closes into starlight',
 possible_purchase:'Tentative coin thread',possible_item_upgrade:'Tentative facets converging',possible_consumable_use:'Tentative vial vapor',possible_base_visit:'Tentative homeward arc',possible_combat:'Tentative blade echoes',possible_low_hp_escape:'Tentative escaping pulse',possible_teamfight:'Tentative interwoven battle paths',possible_objective_fight:'Tentative contested orbital crossing',possible_power_spike:'Tentative upward crystal wave',possible_roam:'Tentative constellation journey',possible_jungle_activity:'Tentative forest firefly trail'
};
export const EVENT_DESIGNS=Object.freeze(descriptions);
function caption(c,e,color){
 if(!e.title)return;c.save();c.globalAlpha*=.54;c.font=(e.key==='victory'?'500 23px Georgia':'500 16px "Segoe UI",sans-serif');c.textAlign='center';c.fillStyle=color;
 const x=e.category==='economy'?1410:e.category==='survival'?530:960;c.fillText(e.title,x,e.key==='victory'?62:34,620);c.restore();
}

export function eventArt(c,e,options){
 if(e.key==='dragon_hextech'){
  const t=e.elapsed,d=e.duration;if(t<0||t>=d)return true;
  const power=Math.max(.3,Math.min(2.56,(options.intensity??1.15)*(e.intensity??1)));
  c.save();c.globalAlpha*=smooth(t/.35)*smooth((d-t)/.5);
  c.globalAlpha*=Math.min(1,Math.sqrt(power));
  if(!options.hextechBasePresent)hextechAtmosphere(c,t,true);
  hextechSurge(c,t,d);
  caption(c,e,legacyColors.hextech);c.restore();return true;
 }
 const k=e.key;if(!EVENT_DESIGNS[k]&&!k?.startsWith('custom_'))return false;
 const t=e.elapsed,color=PALETTES[e.theme]||PALETTES.arcane;
 c.save();c.lineCap='round';c.lineJoin='round';
 c.globalAlpha*=smooth(t/Math.min(.85,e.duration*.3))*smooth((e.duration-t)/Math.min(.9,e.duration*.3));
 c.globalAlpha*=Math.min(1,Math.max(.3,((options.intensity||1)*(e.intensity||1))**.5));
 if(k==='death')deathAtmosphere(c,{elapsed:t,worth:false});
 else{eventRelics(c,e);}
 caption(c,e,color);c.restore();return true;
}
export function deathAtmosphere(c,death){
 const t=death.elapsed||0,worth=!!death.worth,color=worth?'#cbd7ba':'#a9c9df';
 soulRelics(c,death);
 c.save();c.globalAlpha*=.65*smooth(t/1.4);c.textAlign='center';c.font='500 17px "Segoe UI",sans-serif';c.fillStyle=color;
 const remaining=death.remaining;
 c.fillText(Number.isFinite(remaining)?`RETURNING IN ${Math.max(0,Math.ceil(remaining))}s`:'RETURNING',960,44);
 if(worth)c.fillText('THE TRADE STILL COUNTS',960,1060);c.restore();
}
export {EdgeFinish,artReady};
