import {esc} from '../utils.js';

let cleanup=null, epoch=0;
export function unmount(){++epoch;cleanup?.();cleanup=null;}
export async function mount(root){
 const token=++epoch;
 root.innerHTML=`<link rel="stylesheet" href="/css/effects-gallery.css"><div class="eg"><header><div><h1>Effects gallery</h1><p>Pick a border. See it move. Hear its sound. Previews stay in this page.</p></div><a class="btn" href="#projects/soundboard">Soundboard ↗</a></header><div class="eg-layout"><section class="eg-browser" aria-label="Effect library"><input class="input" id="egSearch" type="search" placeholder="Find a sound or event…" aria-label="Find an effect"><div class="eg-tabs" role="group" aria-label="Effect category"><button class="btn" data-group="All" aria-pressed="true">All</button><button class="btn" data-group="Sounds" aria-pressed="false">Sounds</button><button class="btn" data-group="League" aria-pressed="false">League</button></div><p id="egCount"></p><div id="egList" class="eg-list"></div></section><section class="eg-viewer" aria-label="Selected effect"><div class="eg-title"><div><h2 id="egName">Loading your effects…</h2><p id="egMeta"></p></div><select class="input" id="egBackground" aria-label="Preview background"><option value="checker">Transparency grid</option><option value="dark">Dark background</option><option value="light">Light background</option></select></div><div class="eg-stage" id="egStage"><canvas id="egCanvas" width="1920" height="1080" aria-label="Border effect preview"></canvas><span class="eg-center">Your gameplay stays here</span></div><div class="eg-transport"><button class="btn btn-primary" id="egPlay" disabled>▶ Play preview</button><button class="btn" id="egStop" disabled>Stop</button><label><input id="egLoop" type="checkbox"> Loop</label><label><input id="egSound" type="checkbox" checked> Sound</label><label class="eg-volume">Volume <input id="egVolume" type="range" min="0" max="100" value="65" aria-label="Preview volume"></label></div><div class="eg-timeline"><input id="egSeek" type="range" min="0" max="5" step=".001" value="0" aria-label="Preview timeline"><output id="egTime">0:00 / 0:00</output></div><p id="egNotice" role="status" aria-live="polite"></p></section></div></div>`;
 const $=id=>root.querySelector('#'+id), canvas=$('egCanvas');
 let items=[],selected=null,renderer=null,audio=null,frame=0,playing=false,time=0,duration=5,start=0,group='All',selection=0,disposed=false;
 const imports=Promise.all([import('/effects/art/sound/renderers.js'),import('/effects/art/league/scene.js')]);
 const message=text=>{if(!disposed)$('egNotice').textContent=text;};
 const clock=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
 function readout(){ $('egSeek').max=duration;$('egSeek').value=time;$('egTime').textContent=`${clock(time)} / ${clock(duration)}`; }
 function paint(){if(!renderer||!selected)return;if(selected.group==='Sounds')renderer.draw(time,duration,selected.effect);else renderer.draw({enabled:true,...selected.state,...(selected.effect.key==='death'?{death:{elapsed:time,remaining:Math.max(0,duration-time)}}:{effect:{...selected.effect,elapsed:time}})});readout();}
 function pause(){playing=false;cancelAnimationFrame(frame);frame=0;audio?.pause();$('egPlay').textContent=time>0?'▶ Resume':'▶ Play preview';}
 function releaseAudio(){if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio=null;}}
 function stop(){pause();time=0;renderer?.clear();readout();}
 function tick(){if(!playing||disposed)return;time=audio?audio.currentTime:Math.min(duration,(performance.now()-start)/1000);if(time>=duration){finish();return;}paint();frame=requestAnimationFrame(tick);}
 function finish(){pause();time=duration;renderer?.clear();readout();if($('egLoop').checked)play(true);}
 async function play(restart=false){if(!renderer)return;if(playing){pause();return;}if(restart||time>=duration)time=0;
  const own=selection;try{if(audio){audio.currentTime=time;audio.muted=!$('egSound').checked;audio.volume=Number($('egVolume').value)/100;await audio.play();if(own!==selection||disposed)return;}
  start=performance.now()-time*1000;playing=true;$('egPlay').textContent='Ⅱ Pause';message(selected.has_audio?'Playing the original sound with its border.':'Visual preview · this border has no attached sound.');tick();}catch{message('Audio could not play. Try Play again, or turn Sound off.');}
 }
 function list(){const query=$('egSearch').value.toLocaleLowerCase();const rows=items.filter(row=>(group==='All'||row.group===group)&&`${row.name} ${row.effect.key||''} ${row.effect.style||''}`.toLocaleLowerCase().includes(query));$('egCount').textContent=`${rows.length} effects`;
  $('egList').innerHTML=rows.map(row=>`<button type="button" class="eg-item ${selected?.id===row.id?'selected':''}" data-id="${esc(row.id)}" aria-pressed="${selected?.id===row.id}"><span class="eg-swatch" style="--cue:${/^#[0-9a-f]{6}$/i.test(row.effect.color||'')?row.effect.color:'#7fc8e8'}">${row.group==='Sounds'?'♫':'✦'}</span><span><strong>${esc(row.name)}</strong><small>${row.group} · ${row.has_audio?'with sound':'visual only'}</small></span><span aria-hidden="true">›</span></button>`).join('')||'<p>No effects match your search.</p>';
  $('egList').querySelectorAll('[data-id]').forEach(button=>button.onclick=()=>select(items.find(row=>row.id===button.dataset.id)));
 }
 async function select(row){const own=++selection;stop();releaseAudio();renderer=null;selected=row;list();$('egName').textContent=row.name;$('egMeta').textContent=`${row.group} · ${row.has_audio?'Sound + animated border':'Animated border · visual only'}`;$('egPlay').disabled=$('egStop').disabled=true;message('Preparing artwork…');
  try{const [sound,league]=await imports;if(own!==selection||disposed)return;renderer=row.group==='Sounds'?sound.makeRenderer(canvas,row.effect):new league.ProductionScene(canvas);const show=renderer;await show.ready;if(own!==selection||disposed)return;
   duration=row.duration||5;
   if(row.has_audio){const media=new Audio(row.audio);audio=media;media.preload='metadata';await new Promise((resolve,reject)=>{media.onloadedmetadata=resolve;media.onerror=()=>reject(Error('The attached sound could not be loaded.'));media.load();});if(own!==selection||disposed)return;duration=media.duration;media.onended=()=>{if(own===selection)finish();};}
   time=Math.min(duration*.35,1.5);paint();$('egPlay').textContent='▶ Play preview';$('egPlay').disabled=$('egStop').disabled=false;message('Ready. Play previews from the beginning. Drag the timeline to inspect a moment.');
  }catch(error){if(own===selection&&!disposed)message(error.message);}
 }
 $('egPlay').onclick=()=>play(!playing&&time>0&&$('egPlay').textContent==='▶ Play preview');$('egStop').onclick=stop;
 $('egSeek').oninput=()=>{pause();time=Number($('egSeek').value);if(audio)audio.currentTime=time;paint();$('egPlay').textContent='▶ Resume';};
 $('egSound').onchange=()=>{if(audio)audio.muted=!$('egSound').checked;};$('egVolume').oninput=()=>{if(audio)audio.volume=Number($('egVolume').value)/100;};
 $('egBackground').onchange=()=>{$('egStage').dataset.background=$('egBackground').value;};$('egSearch').oninput=list;
 root.querySelectorAll('[data-group]').forEach(button=>button.onclick=()=>{group=button.dataset.group;root.querySelectorAll('[data-group]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));list();});
 const hide=()=>pause();window.addEventListener('pagehide',hide);
 cleanup=()=>{disposed=true;++selection;pause();releaseAudio();renderer?.clear();window.removeEventListener('pagehide',hide);};
 try{const response=await fetch('/api/effects-gallery');const data=await response.json();if(token!==epoch)return;if(!response.ok)throw Error(data.error||'Could not load effects');items=data.items;list();if(items.length)await select(items[0]);else message('No effects found.');}catch(error){if(token===epoch)message(error.message);}
}
