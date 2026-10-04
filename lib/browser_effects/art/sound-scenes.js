// Sound art assembly. Playback and audio clocks remain in playback.js.
import {WorldPaint,ScenicLayers,smooth,TAU,pathOf} from './subtle.js';
/* @ATLAS_DATA@ */
/* @MOM_FROG_ART@ */
/* @FROG_BORDER@ */
/* @PIUW_BORDER@ */
/* @ARENA_ART@ */
/* @NIGHT_RUN_ART@ */
/* @HOORAY_ART@ */
/* @AUTHORED_CUES@ */
/* @CUE_INK@ */
/* @SPAM_INK@ */
/* @SPAM_LIZARD@ */
/* @SPAM_GARY@ */
/* @SPAM_QUACK@ */
/* @SPAM_BONK@ */
/* @SPAM_PIUW@ */
/* @SPAM_CUES@ */
/* @CHARACTER_CUES@ */
/* @REACTION_CUES@ */
/* @CUE_ACCENTS@ */
/* @LIBRARY_TECH@ */
/* @LIBRARY_PLAY@ */
/* @LIBRARY_MOOD@ */
/* @LIBRARY_ACCENTS@ */
// Compatibility fallback uses vector geometry; rejected raster scenery is no
// longer decoded or embedded in the live sound bundle.
const SCENIC={};
function soundScenery(){}
/* @CUE_ART@ */
/* @LIBRARY_ART@ */
export const artReady=Promise.all([momFrogSprites.ready,spamSprites.ready]);
export const STORIES={tantrum:true,kitchen:true,meltdown:true,rewind:true,violin:true,spill:true,heartbreak:true,arcade:true,approval:true};
export class RaveStage{
 constructor(c){this.c=c;this.ready=artReady;}
 draw(t,duration,effect,scene){
  if(effect.style==='arena'){legacyArenaPaint(this.c,t,duration,effect,scene);return;}
  if(effect.style==='racing'){nightRun(this.c,t,duration,effect);return;}
  if(spamCue(this.c,t,duration,effect))return;
  if(effect.scene){libraryScene(this.c,effect.scene,t,duration,scene.progress);libraryTech(this.c,effect.scene,t,duration)||libraryPlay(this.c,effect.scene,t,duration)||libraryMood(this.c,effect.scene,t,duration);libraryAccents(this.c,effect.scene,t,duration);return;}
  const style={party:'balloons',confetti:'disco',cats:'nyan'}[effect.style]||effect.style;
  const cue=style===effect.style?effect:{...effect,style};
  if(authoredCue(this.c,t,duration,cue)||characterCue(this.c,t,duration,cue)||reactionCue(this.c,t,duration,cue)){cueAccents(this.c,t,duration,cue);return;}
  cueWorld(this.c,style||'muffins',t,duration,scene.progress);
 }
}
