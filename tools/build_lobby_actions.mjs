// Finite metadata publication from the actual artist catalogs; no renderer is started.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const {worlds,loadWorld}=await import(new URL('hub_ui/app/lobby-motion/worlds.js',root));
const catalog={};
const {habitatDesigns}=await import(new URL('hub_ui/app/lobby-motion/habitat-designs.js',root));
fs.writeFileSync(fileURLToPath(new URL('mini projects/scene_voice_switcher/habitat-layouts.json',root)),JSON.stringify(habitatDesigns,null,2)+'\n');
for(const entry of worlds){
  const world=await loadWorld(entry.id);
  catalog[entry.source]={world:entry.id,actions:world.cues.map(({id,label})=>({id,label}))};
}
fs.writeFileSync(fileURLToPath(new URL('mini projects/scene_voice_switcher/motion-actions.json',root)),JSON.stringify(catalog,null,2)+'\n');
console.log('Published action catalogs for',worlds.length,'living lobbies.');
