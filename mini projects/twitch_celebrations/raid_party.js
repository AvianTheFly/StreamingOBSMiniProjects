// One page-owned canvas and the existing overlay clock. Center clipping is final.
import {penguinsReady} from './raid_penguins.js';
import {ease,raidGuests,storySeed} from './raid_story.js';
import {drawStagecraft} from './raid_effects.js';
import {drawAct} from './raid_acts.js';
import {guestsReady} from './raid_guests.js';
import {drawCrossovers} from './raid_crossovers.js';
import {raidScore,storyAt,musicalMotion} from './raid_music.js';
export {raidGuests} from './raid_story.js';
export const partyReady=Promise.all([penguinsReady,guestsReady]);
export const GAMEPLAY_OPENING={x:240,y:170,width:1440,height:670};
export class RaidParty{
 constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d');this.frozen=false;}
 start(item){this.item=item;this.seed=storySeed(item);this.frozen=false;}
 clear(){this.c.clearRect(0,0,1920,1080);this.frozen=false;delete this.canvas.dataset.guests;delete this.canvas.dataset.acts;delete this.canvas.dataset.crossovers;}
 draw(elapsed,reduced=false){
  const theme=this.item?.theme,duration=raidScore(theme).duration;
  if(reduced&&this.frozen&&elapsed>0&&elapsed<duration)return;
  this.clear();if(elapsed<=0||elapsed>=duration)return;
  const t=reduced?5.85:storyAt(theme,elapsed),c=this.c,o=GAMEPLAY_OPENING;
  const music=reduced?{beat:10,punch:0}:musicalMotion(theme,elapsed);
  c.save();c.beginPath();c.rect(0,0,1920,1080);c.rect(o.x,o.y,o.width,o.height);c.clip('evenodd');
  c.globalAlpha=ease(t/.2)*ease((8-t)/.42);
  drawStagecraft(c,t,this.seed,music);
  const guests=raidGuests(this.item?.theme,t,this.seed);
  this.canvas.dataset.guests=guests.map(g=>g.key).join(',');this.canvas.dataset.acts=guests.map(g=>g.id).join(',');
  for(const guest of guests)drawAct(c,{...guest,music},t,this.seed);
  this.canvas.dataset.crossovers=drawCrossovers(c,t,this.item?.theme,this.seed).map(s=>s.id).join(',');
  c.restore();this.frozen=reduced;
 }
}
