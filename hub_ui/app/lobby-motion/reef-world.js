// Preserve the reviewed reef choreography while sharing document assembly.
import {scene,ReefMotion,oceanClip} from './reef-scene.js';
import {cues} from './reef-cues.js';
import {seaArtists} from './reef-visitors.js';
import {roomArtists} from './reef-room.js';
export const world={scene,cues,artists:{...seaArtists,...roomArtists},createMotion:()=>new ReefMotion(),clip:(c,spec)=>{if(spec.domain==='sea')oceanClip(c);}};
