// Raid choreography is data, separate from transport and the base overlay.
// Times are seconds from the server's alert start. Late joins skip old sounds.
export const RAID_CUES = [
 {at:0, phase:'incoming', sound:'radar', headline:'RAID INCOMING', cast:0},
 {at:.65, phase:'reveal', sound:'reveal', headline:'LOOK WHO BROUGHT THE PARTY', cast:0},
 {at:1.5, phase:'drop', sound:'pop', headline:'THE CREW HAS ARRIVED', cast:1},
 {at:3.2, phase:'remix', sound:'sparkle', headline:'EVERYBODY IN', cast:2},
 {at:5, phase:'finale', sound:'pop', headline:'ABSOLUTE LEGENDS', cast:3},
 {at:6.4, phase:'welcome', sound:'welcome', headline:'THANK YOU FOR THE RAID', cast:3},
 {at:7.4, phase:'exit', headline:'MAKE YOURSELF AT HOME', cast:3},
];
const WORDS={crab:['CLAW IN!','CRAB CREW','CLACK CLACK'],dragon:['TINY WINGS','BIG ENTRANCE','DRAGON ENERGY'],cat:['NYAN NYAN','CAT PARADE','PURRFECT RAID'],frog:['PEDRO PEDRO','PARTY PEOPLE','ONE MORE DANCE']};

export class RaidSequence {
 constructor(stage){this.stage=stage;this.sounds=new Set();this.index=-1;}
 start(item){
  this.stop();this.item=item;this.index=-1;
  this.stage.classList.add('raid');
  const layer=document.getElementById('raidLayers');layer.replaceChildren();
  for(let i=0;i<4;i++){const light=document.createElement('div');light.className='edge-light light-'+i;layer.append(light);}
  for(let i=0;i<2;i++){const beam=document.createElement('div');beam.className='edge-beam beam-'+i;layer.append(beam);}
  for(let i=0;i<4;i++){const ring=document.createElement('div');ring.className='corner-ring ring-'+i;layer.append(ring);}
  // Fixed budget regardless of raid size; only the text count scales.
  for(let i=0;i<36;i++){const confetti=document.createElement('i');confetti.className='raid-confetti';const side=i%2;confetti.style.cssText=`${side?'right':'left'}:${1+(i*7)%9}%;top:${12+(i*17)%76}%;--r:${i*31}deg;--delay:${(i%6)*.06}s;--travel:${(side?-1:1)*(12+i%20)}px;background:${['var(--accent)','#ffe68e','#fff','#ed9bff'][i%4]}`;layer.append(confetti);}
  const badge=document.createElement('div');badge.id='raidBadge';
  const count=document.createElement('b');count.id='raidCount';
  const label=document.createElement('span');label.textContent='RAIDERS JOINED';badge.append(count,label);layer.append(badge);
  for(let i=0;i<2;i++){const word=document.createElement('div');word.className='raid-word word-'+i;layer.append(word);}
 }
 update(elapsed,settings){
  const next=RAID_CUES.findLastIndex(c=>elapsed>=c.at);
  if(next<0)return null;
  const cue=RAID_CUES[next];
  const count=document.getElementById('raidCount');
  if(count)count.textContent=Math.round(this.item.count*Math.min(1,Math.max(0,(elapsed-.65)/.7))).toLocaleString();
  for(const sound of this.sounds)sound.volume=settings.muted?0:settings.volume*.65;
  if(next===this.index)return null;
  this.index=next;this.stage.dataset.raidPhase=cue.phase;
  document.getElementById('kicker').textContent=cue.headline;
  document.getElementById('detail').textContent=cue.phase==='welcome'||cue.phase==='exit'?'Your crew is welcome here. Stay for the chaos.':`Raiding with ${Number(this.item.count).toLocaleString()} lovely humans`;
  const words=WORDS[this.item.theme];
  document.querySelectorAll('.raid-word').forEach((node,i)=>{node.textContent=next===0?'RAID INCOMING':words[(next+i)%words.length];});
  if(cue.sound && elapsed-cue.at<.4 && !settings.muted){
   const audio=new Audio('/media/raid-'+cue.sound+'.wav');audio.volume=settings.volume*.65;
   this.sounds.add(audio);audio.onended=()=>this.sounds.delete(audio);
   audio.play().catch(()=>this.sounds.delete(audio));
  }
  return cue;
 }
 stop(){for(const sound of this.sounds)sound.pause();this.sounds.clear();this.stage.classList.remove('raid');delete this.stage.dataset.raidPhase;document.getElementById('raidLayers')?.replaceChildren();this.index=-1;}
}
