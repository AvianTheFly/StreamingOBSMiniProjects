// Code-native League performances, compiled into the existing static delivery route.
// Detection, admission, clocks and saved presentation data remain with their owners.
import {smooth,TAU} from './subtle.js';
/* @STORY_INK@ */
/* @STORY_STRUCTURES@ */
/* @STORY_SPIRITS@ */
/* @STORY_COMBOS@ */
/* @STORY_COMBAT@ */
/* @STORY_OBJECTIVES@ */
/* @STORY_PROGRESSION@ */
/* @STORY_SIGNALS@ */
/* @STORY_PAYOFFS@ */
/* @STORY_MOTIFS@ */
/* @STORY_RIM@ */
/* @STORY_EVENTS@ */
/* @STORY_CUES@ */
/* @STORY_ENERGY@ */
/* @STORY_THEATER@ */
/* @BORDER_INK@ */
/* @BORDER_MATERIALS@ */
/* @BORDER_SCENERY@ */
/* @BORDER_SIGNAL_SCENERY@ */
/* @BORDER_CONTACTS@ */
/* @BORDER_COMBAT@ */
/* @BORDER_DRAGONS@ */
/* @BORDER_OBJECTIVES@ */
/* @BORDER_STRUCTURES@ */
/* @BORDER_VITALS@ */
/* @BORDER_PROGRESSION@ */
/* @BORDER_LIFECYCLE@ */
/* @BORDER_SIGNALS@ */
/* @BORDER_STORIES@ */
/* @BORDER_SCORES@ */
export const artReady=Promise.resolve();
export function eventRelics(c,e){
 if(Number.isFinite(e.duration))return borderPerformance(c,e);
 storyEnergy(c,e);
 if(e.key!=='dragon_hextech')storyRim(c,e);
 const handled=e.key==='dragon_hextech'||playfulLeague(c,e);if(handled){storyPayoffs(c,e);storyTheater(c,e);}return handled;
}
export const playfulStories=BORDER_STORIES;
export function soulRelics(c,death){const e={key:'death',elapsed:death.elapsed||0,duration:Infinity},I=borderInk(c,e);c.save();c.globalAlpha*=smooth(e.elapsed/1.2);BORDER_SCENERY.death(I,borderMaterials(I));borderDeath(I);c.restore();}
