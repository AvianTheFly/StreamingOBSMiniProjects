// Raid lifecycle and sounds; drawing is owned by the single edge canvas.
import {RaidParty} from './raid_party.js';
import {ease,arc} from './raid_story.js';
import {storyAt,musicAt} from './raid_music.js';
export const RAID_CUES=[
 {at:0,phase:'incoming',cast:0},
 {at:.65,phase:'reveal',cast:0},
 {at:1.13,phase:'drop',sound:'pop',cast:1},
 {at:3.35,phase:'remix',sound:'sparkle',cast:2},
 {at:6.22,phase:'finale',sound:'pop',cast:3},
 {at:7.24,phase:'welcome',cast:3},
 {at:7.4,phase:'exit',cast:3}
];
export class RaidSequence{
 constructor(stage){this.stage=stage;this.sounds=new Set();this.index=-1;this.reduced=matchMedia('(prefers-reduced-motion:reduce)');}
 start(item){
  this.stop();this.theme=item.theme;this.index=-1;this.stage.classList.add('raid');
  const layer=document.getElementById('raidLayers');layer.replaceChildren();
  const canvas=document.createElement('canvas');canvas.id='raidParty';canvas.width=1920;canvas.height=1080;layer.append(canvas);
  this.party=new RaidParty(canvas);this.party.start(item);this.stage.dataset.raidWorld=item.theme;
  const announcement=document.createElement('div');announcement.id='raidAnnouncement';
  const card=document.createElement('div');card.id='raidAnnouncementCard';
  const intro=document.createElement('div');intro.id='raidIntro';intro.textContent="OH MY GOD. WE'RE BEING RAIDED!";
  const name=document.createElement('div');name.id='raidName';name.textContent=String(item.name||'A lovely streamer');
  const crew=document.createElement('div');crew.id='raidCrew';
  const count=document.createElement('strong');count.textContent=Number(item.count||1).toLocaleString();
  crew.append(count,document.createTextNode(Number(item.count)===1?' viewer just raided in!':' viewers just raided in!'));
  card.append(intro,name,crew);announcement.append(card);layer.append(announcement);
  this.card=card;this.crew=crew;
  // Fit the actual name without ellipsis. Text nodes preserve punctuation safely.
  let font=parseFloat(getComputedStyle(name).fontSize);
  while(name.scrollWidth>name.clientWidth&&font>12){font-=1;name.style.fontSize=font+'px';}
 }
 update(seconds,settings){
  this.party?.draw(seconds,this.reduced.matches);
  const elapsed=storyAt(this.theme,seconds);
  if(this.card){
   const entry=this.reduced.matches?1:ease(elapsed/.55),exit=this.reduced.matches?0:ease((elapsed-7.5)/.5);
   const bounce=this.reduced.matches?0:arc((elapsed-.32)/.65)*.035;
   this.card.style.transform=`translateY(${(1-entry)*-170-exit*170}%) scale(${.88+entry*.12+bounce}) rotate(${(1-entry)*-3}deg)`;
   this.card.style.opacity=String(entry*(1-exit));
   const arrive=this.reduced.matches?1:ease((elapsed-.45)/.35);
   this.crew.style.transform=`translateY(${(1-arrive)*25}px) scale(${.8+.2*arrive})`;this.crew.style.opacity=String(arrive);
  }
  const next=RAID_CUES.findLastIndex(c=>elapsed>=c.at);if(next<0)return null;
  for(const sound of this.sounds)sound.volume=settings.muted?0:settings.volume*.65;
  if(next===this.index)return null;
  const cue=RAID_CUES[next];this.index=next;this.stage.dataset.raidPhase=cue.phase;
  if(cue.sound&&seconds-musicAt(this.theme,cue.at)<.12&&!settings.muted){
   const audio=new Audio('/media/raid-'+cue.sound+'.wav');audio.volume=settings.volume*.65;
   this.sounds.add(audio);audio.onended=()=>this.sounds.delete(audio);
   audio.play().catch(()=>this.sounds.delete(audio));
  }
  return cue;
 }
 stop(){for(const sound of this.sounds)sound.pause();this.sounds.clear();this.party?.clear();this.party=null;this.card=null;this.crew=null;this.stage.classList.remove('raid');delete this.stage.dataset.raidPhase;delete this.stage.dataset.raidWorld;document.getElementById('raidLayers')?.replaceChildren();this.index=-1;}
}
