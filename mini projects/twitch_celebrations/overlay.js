import {character,partyTracks} from './characters.js';
import {RaidSequence} from './raid_sequence.js';
const $ = id => document.getElementById(id), stage=$('stage');
const preview = new URLSearchParams(location.search).has('preview');
let current=null, frame=0, phase=-1, audio=null, settings={}, lastGood=performance.now();
const themes=['crab','dragon','cat','frog'];
const raid=new RaidSequence(stage);
function stop(){raid.stop();stage.className='';current=null;phase=-1;if(audio){audio.pause();audio=null;}cancelAnimationFrame(frame);setTimeout(()=>{if(!current){$('cast').replaceChildren();$('particles').replaceChildren();}},500);}
function cast(theme,small,cameo=false){
 $('cast').replaceChildren();
 for(let i=0;i<(small?2:8);i++){
  const custom=settings.custom?.[theme]?.visual || (cameo && i>=6 ? partyTracks[current.theme].cameo : '');
  const node=document.createElement('div');node.className='mascot';
  const right=i%2, row=Math.floor(i/2);
  node.style.cssText=`${right?'right':'left'}:${row===3?'10':'0.5'}%;${row===3?'bottom:0.5%':`top:${17+row*24}%`}`;
  const flip=document.createElement('div');flip.className=right?'mirror':'';
  const dance=document.createElement('div');dance.className='dance';
  dance.style.animationDelay=`-${row*.12}s`;
  if(custom){const media=document.createElement(/\.(mp4|webm)$/i.test(custom)?'video':'img');media.src='/media/'+encodeURIComponent(custom);if(media.tagName==='VIDEO'){media.muted=true;media.loop=true;media.autoplay=true;media.playsInline=true;}media.onerror=()=>{dance.innerHTML=character(theme);};dance.append(media);}else dance.innerHTML=character(theme);
  flip.append(dance);node.append(flip);$('cast').append(node);
 }
}
function start(item, options){
 stop();settings=options;current={...item,received:performance.now()};phase=-1;
 const theme=themes.includes(item.theme)?item.theme:'crab';
 stage.style.setProperty('--accent',({crab:'#ff987e',dragon:'#bd9cff',cat:'#7febdf',frog:'#cff38d'})[theme]);
 stage.style.setProperty('--beat',(60/partyTracks[theme].bpm)+'s');
 stage.className='on'+(item.kind==='follow'?' small':'');
 if(item.kind==='raid')raid.start(item);
 $('kicker').textContent=({raid:'✦ RAID PARTY INCOMING ✦',follow:'✦ NEW FRIEND UNLOCKED ✦',subscribe:'✦ WELCOME TO THE CLUB ✦',gift:'✦ GENEROSITY LEVEL UP ✦',cheer:'✦ THANK YOU FOR THE HYPE ✦'})[item.kind];
 $('name').textContent=item.name;
 $('detail').textContent=item.kind==='raid'?`${Number(item.count).toLocaleString()} raiders • the party just got better`:item.kind==='gift'?`${item.count} gifted subs • absolute legend`:item.kind==='cheer'?`${item.count} bits • big love`:'Good vibes. Great company. You belong here.';
 $('particles').replaceChildren();
 for(let i=0;i<(item.kind==='follow'?6:28);i++){const p=document.createElement('span');p.className='charm';p.textContent=['✦','♪','♥','✧'][i%4];const side=i%4;p.style.cssText=side<2?`${side?'right':'left'}:${1+i%6}%;top:${15+(i*13)%77}%`:`left:${8+(i*17)%84}%;${side===2?'top':'bottom'}:1%`;p.style.animationDelay=`-${i*.17}s`;$('particles').append(p);}
 audio=new Audio('/media/'+encodeURIComponent(settings.custom?.[theme]?.audio||partyTracks[theme].audio));
 audio.volume=settings.muted?0:settings.volume;audio.currentTime=Math.min(item.elapsed||0,item.duration-.1);
 audio.play().catch(()=>{if(preview)parent.postMessage({type:'celebration-audio-blocked'},location.origin);});
 tick();
}
function tick(){
 if(!current)return;
 const elapsed=(current.elapsed||0)+(performance.now()-current.received)/1000;
 if(elapsed>=current.duration){stop();return;}
 const beat=60/partyTracks[current.theme].bpm;
 const next=current.kind==='follow'?0:elapsed<beat*4?0:elapsed<beat*16?1:elapsed<beat*24?2:3;
 if(current.kind==='raid'){
  const cue=raid.update(elapsed,settings);
  if(cue && cue.cast!==phase){phase=cue.cast;const index=themes.indexOf(current.theme);cast(themes[(index+Math.max(0,phase-1))%themes.length],phase===0,phase>=1);}
 }else if(next!==phase){phase=next;const index=themes.indexOf(current.theme);cast(themes[(index+Math.max(0,next-1))%themes.length],current.kind==='follow',next>=2);stage.classList.toggle('encore',next===3);}
 if(audio){const fade=Math.min(1,elapsed/.15,(current.duration-elapsed)/.6);const duck=current.kind==='raid'&&elapsed<1.5?.35:1;audio.volume=(settings.muted?0:settings.volume)*Math.max(0,fade)*duck;}
 frame=requestAnimationFrame(tick);
}
window.addEventListener('message',event=>{if(!preview||event.origin!==location.origin||event.source!==parent)return;if(event.data.type==='preview')start(event.data.item,event.data.settings);if(event.data.type==='stop')stop();});
async function poll(){
 try{const response=await fetch('/api/overlay');if(!response.ok)throw Error();const data=await response.json();lastGood=performance.now();settings=data.settings;if(data.active?.id!==current?.id){if(data.active)start(data.active,data.settings);else stop();}}
 catch{if(performance.now()-lastGood>2500)stop();}
 setTimeout(poll,250);
}
if(!preview)poll();
