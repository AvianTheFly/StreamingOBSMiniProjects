import {character,partyTracks} from './characters.js';
import {RaidSequence} from './raid_sequence.js';
import {partyReady} from './raid_party.js';
import {raidScore} from './raid_music.js';
import {SUB_DURATION} from './subscriber_story.js';
import {SupporterShow,SPIRITS,artReady} from './supporter_show.js';
import {CheerShow} from './cheer_show.js';
const $ = id => document.getElementById(id), stage=$('stage');
const preview = new URLSearchParams(location.search).has('preview');
let current=null, frame=0, phase=-1, audio=null, settings={}, lastGood=performance.now();
let completedId=null,musicStarted=false,musicFailed=false;
const themes=['crab','dragon','cat','frog'];
const raid=new RaidSequence(stage);
const supporter=new SupporterShow(stage),isSupporter=kind=>['subscribe','gift','follow'].includes(kind);
const cheer=new CheerShow(stage);
function stop(){raid.stop();supporter.stop();cheer.stop();stage.className='';current=null;phase=-1;if(audio){audio.pause();audio=null;}$('cast').querySelectorAll('video').forEach(v=>{v.pause();v.removeAttribute('src');v.load();});cancelAnimationFrame(frame);setTimeout(()=>{if(!current){$('cast').replaceChildren();$('particles').replaceChildren();}},500);}
function cast(theme,small,cameo=false){
 const isRaid=current.kind==='raid';
 $('cast').querySelectorAll('video').forEach(v=>{v.pause();v.removeAttribute('src');v.load();});
 $('cast').replaceChildren();
 for(let i=0;i<(small?2:isRaid?4:8);i++){
  const custom=settings.custom?.[theme]?.visual || (cameo && i>=6 ? partyTracks[current.theme].cameo : '');
  const node=document.createElement('div');node.className='mascot';
  const right=i%2, row=Math.floor(i/2);
  node.style.cssText=isRaid?`${right?'right':'left'}:1.2%;top:${24+row*41}%`:`${right?'right':'left'}:${row===3?'10':'0.5'}%;${row===3?'bottom:0.5%':`top:${17+row*24}%`}`;
  const flip=document.createElement('div');flip.className=right?'mirror':'';
  const dance=document.createElement('div');dance.className='dance';
  dance.style.animationDelay=`-${row*.12}s`;
  if(custom){const media=document.createElement(/\.(mp4|webm)$/i.test(custom)?'video':'img');media.src='/media/'+encodeURIComponent(custom);if(media.tagName==='VIDEO'){media.muted=true;media.loop=true;media.autoplay=true;media.playsInline=true;}media.onerror=()=>{dance.innerHTML=character(theme);};dance.append(media);}else dance.innerHTML=character(theme);
  flip.append(dance);node.append(flip);$('cast').append(node);
 }
}
function start(item, options){
 stop();settings=options;phase=-1;
 const theme=themes.includes(item.theme)?item.theme:'crab';
 current={...item,theme,received:performance.now()};
 completedId=null;musicStarted=false;musicFailed=false;
 if(item.kind==='raid')current.duration=raidScore(theme).duration;
 if(item.kind==='subscribe')current.duration=SUB_DURATION;
 stage.style.setProperty('--accent',({crab:'#ff987e',dragon:'#bd9cff',cat:'#7febdf',frog:'#cff38d'})[theme]);
 stage.style.setProperty('--beat',(60/partyTracks[theme].bpm)+'s');
 stage.className='on'+(item.kind==='follow'?' small':'');
 if(item.kind==='raid')raid.start(current);
 if(isSupporter(item.kind))supporter.start(current,settings);
 $('kicker').textContent=({raid:'✦ RAID PARTY INCOMING ✦',follow:'✦ NEW FRIEND UNLOCKED ✦',subscribe:'✦ WELCOME TO THE CLUB ✦',gift:'✦ GENEROSITY LEVEL UP ✦',cheer:'✦ THANK YOU FOR THE HYPE ✦'})[item.kind];
 $('name').textContent=item.name;
 $('detail').textContent=item.kind==='raid'?`${Number(item.count).toLocaleString()} raiders • the party just got better`:item.kind==='gift'?`${item.count} gifted subs • absolute legend`:item.kind==='cheer'?`${item.count} bits • big love`:'Good vibes. Great company. You belong here.';
 if(item.kind==='cheer')cheer.start(current,settings);
 $('particles').replaceChildren();
 for(let i=0;i<(isSupporter(item.kind)||item.kind==='cheer'||item.kind==='raid'?0:28);i++){const p=document.createElement('span');p.className='charm';p.textContent=['✦','♪','♥','✧'][i%4];const side=i%4;p.style.cssText=side<2?`${side?'right':'left'}:${1+i%6}%;top:${15+(i*13)%77}%`:`left:${8+(i*17)%84}%;${side===2?'top':'bottom'}:1%`;p.style.animationDelay=`-${i*.17}s`;$('particles').append(p);}
 const defaultAudio=item.kind==='subscribe'?'subscriber-thanks.wav':isSupporter(item.kind)?`supporter-${item.kind==='follow'?'follow':'sub'}-${SPIRITS[theme].id}.wav`:item.kind==='raid'?raidScore(theme).audio:partyTracks[theme].audio;
 audio=new Audio('/media/'+encodeURIComponent(settings.custom?.[theme]?.audio||defaultAudio));
 audio.volume=settings.muted?0:settings.volume;audio.loop=false;audio.currentTime=Math.min(item.elapsed||0,current.duration-.1);
 const owned=audio;
 audio.onplaying=()=>{if(audio!==owned||!current||musicStarted)return;musicStarted=true;const now=(current.elapsed||0)+(performance.now()-current.received)/1000;if(['raid','subscribe'].includes(current.kind)&&Math.abs(owned.currentTime-now)>.08)owned.currentTime=Math.min(now,current.duration-.01);};
 audio.onended=()=>{if(audio===owned&&['raid','subscribe'].includes(current?.kind))finish();};
 audio.onerror=()=>{if(audio===owned)musicFailed=true;};
 audio.play().catch(()=>{if(audio!==owned)return;musicFailed=true;if(preview)parent.postMessage({type:'celebration-audio-blocked'},location.origin);});
 tick();
}
function finish(){completedId=current?.id;stop();}
function tick(){
 if(!current)return;
 const wall=(current.elapsed||0)+(performance.now()-current.received)/1000;
 if(wall>=current.duration){finish();return;}
 const elapsed=['raid','subscribe'].includes(current.kind)&&!musicFailed&&audio?(musicStarted?audio.currentTime:current.elapsed||0):wall;
 const beat=60/partyTracks[current.theme].bpm;
 const next=current.kind==='follow'?0:elapsed<beat*4?0:elapsed<beat*16?1:elapsed<beat*24?2:3;
 if(current.kind==='raid'){
  const cue=raid.update(elapsed,settings);
  if(cue)phase=cue.cast;
 }else if(isSupporter(current.kind)){supporter.update(elapsed);
 }else if(current.kind==='cheer'){cheer.update(elapsed);
 }else if(next!==phase){phase=next;const index=themes.indexOf(current.theme);cast(themes[(index+Math.max(0,next-1))%themes.length],false,next>=2);stage.classList.toggle('encore',next===3);}
 if(audio){const fade=Math.min(1,elapsed/.15,(current.duration-elapsed)/(current.kind==='raid'?.36:.6));audio.volume=(settings.muted?0:settings.volume)*Math.max(0,fade);}
 frame=requestAnimationFrame(tick);
}
let previewEpoch=0;
window.addEventListener('message',async event=>{if(!preview||event.origin!==location.origin||event.source!==parent)return;if(event.data.type==='preview'){const epoch=++previewEpoch;await Promise.allSettled([artReady,partyReady]);if(epoch===previewEpoch)start(event.data.item,event.data.settings);}if(event.data.type==='stop'){previewEpoch++;stop();}});
let pollTimer=0,request=null,pollRevision=-1,disposed=false,pollEpoch=0,artLoaded=false,polling=false;
async function poll(){
 if(preview||disposed||polling)return;
 polling=true;const epoch=pollEpoch,owned=new AbortController();request=owned;
 const deadline=setTimeout(()=>owned.abort(),1500);let delay=250;
 try{const response=await fetch('/api/overlay?after='+pollRevision,{signal:owned.signal});if(!response.ok)throw Error();const data=await response.json();if(disposed||epoch!==pollEpoch)return;lastGood=performance.now();settings=data.settings;pollRevision=Number.isSafeInteger(data.revision)?data.revision:-1;if(data.active?.id!==current?.id){if(data.active&&data.active.id!==completedId)start(data.active,data.settings);else stop();}if(!data.active&&pollRevision>=0)delay=0;}
 catch{if(!disposed&&epoch===pollEpoch&&performance.now()-lastGood>2500)stop();}
 finally{clearTimeout(deadline);if(epoch===pollEpoch){request=null;polling=false;if(!disposed)pollTimer=setTimeout(poll,delay);}}
}
addEventListener('pagehide',()=>{disposed=true;pollEpoch++;polling=false;clearTimeout(pollTimer);request?.abort();request=null;stop();});
addEventListener('pageshow',()=>{if(!disposed)return;disposed=false;pollRevision=-1;if(artLoaded)poll();});
// Preload shared art before consuming a live alert, so the first welcome is complete.
Promise.allSettled([artReady,partyReady]).then(()=>{artLoaded=true;poll();});
