// Raid choreography is data, separate from transport and the base overlay.
// Times are seconds from the server's alert start. Late joins skip old sounds.
import {RaidArt,RAID_WORLDS} from './raid_art.js';
export const RAID_CUES = [
 {at:0, phase:'incoming', sound:'radar', headline:'RAID INCOMING', cast:0},
 {at:.65, phase:'reveal', sound:'reveal', headline:'LOOK WHO BROUGHT THE PARTY', cast:0},
 {at:1.5, phase:'drop', sound:'pop', headline:'THE CREW HAS ARRIVED', cast:1},
 {at:3.2, phase:'remix', sound:'sparkle', headline:'EVERYBODY IN', cast:2},
 {at:5, phase:'finale', sound:'pop', headline:'ABSOLUTE LEGENDS', cast:3},
 {at:6.4, phase:'welcome', sound:'welcome', headline:'THANK YOU FOR THE RAID', cast:3},
 {at:7.4, phase:'exit', headline:'MAKE YOURSELF AT HOME', cast:3},
];

export class RaidSequence {
 constructor(stage){this.stage=stage;this.sounds=new Set();this.index=-1;this.reduced=matchMedia('(prefers-reduced-motion:reduce)');}
 start(item){
  this.stop();this.item=item;this.index=-1;
  this.stage.classList.add('raid');
  const layer=document.getElementById('raidLayers');layer.replaceChildren();
  const canvas=document.createElement('canvas');canvas.id='raidArt';canvas.width=1920;canvas.height=1080;layer.append(canvas);
  this.art=new RaidArt(canvas);this.art.start(item);this.stage.dataset.raidWorld=item.theme;
  const badge=document.createElement('div');badge.id='raidBadge';
  const count=document.createElement('b');count.id='raidCount';
  const label=document.createElement('span');label.textContent='RAIDERS JOINED';badge.append(count,label);layer.append(badge);
 }
 update(elapsed,settings){
  this.art?.draw(elapsed,this.reduced.matches);
  const next=RAID_CUES.findLastIndex(c=>elapsed>=c.at);
  if(next<0)return null;
  const cue=RAID_CUES[next];
  const count=document.getElementById('raidCount');
  if(count)count.textContent=Math.round(this.item.count*Math.min(1,Math.max(0,(elapsed-.65)/.7))).toLocaleString();
  for(const sound of this.sounds)sound.volume=settings.muted?0:settings.volume*.65;
  if(next===this.index)return null;
  this.index=next;this.stage.dataset.raidPhase=cue.phase;
  document.getElementById('kicker').textContent=cue.phase==='reveal'?RAID_WORLDS[this.item.theme].title:cue.headline;
  document.getElementById('detail').textContent=cue.phase==='welcome'||cue.phase==='exit'?'Your crew is welcome here. Stay for the chaos.':`Raiding with ${Number(this.item.count).toLocaleString()} lovely humans`;
  if(cue.sound && elapsed-cue.at<.4 && !settings.muted){
   const audio=new Audio('/media/raid-'+cue.sound+'.wav');audio.volume=settings.volume*.65;
   this.sounds.add(audio);audio.onended=()=>this.sounds.delete(audio);
   audio.play().catch(()=>this.sounds.delete(audio));
  }
  return cue;
 }
 stop(){for(const sound of this.sounds)sound.pause();this.sounds.clear();this.art?.clear();this.art=null;this.stage.classList.remove('raid');delete this.stage.dataset.raidPhase;delete this.stage.dataset.raidWorld;document.getElementById('raidLayers')?.replaceChildren();this.index=-1;}
}
