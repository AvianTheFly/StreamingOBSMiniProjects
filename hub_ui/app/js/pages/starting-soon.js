import {base,request,bind,button,text,clock} from './starting-soon-common.js';
import {mountPlaylists} from './starting-soon-playlists.js';
import {mountLibrary} from './starting-soon-library.js';
import {mountAppearance} from './starting-soon-appearance.js';
import {mountProduction} from './starting-soon-production.js';
import {toast} from '../toast.js';

let current=null;
export async function mount(root){
 const abort=new AbortController();
 const ctx={root,abort,config:null,clips:[],groups:[],live:null,dirty:new Set(),disposed:false,
  $:id=>root.querySelector('#'+id),request:(p,b)=>request(p,b,abort.signal),
  perform:async fn=>{try{return await fn();}catch(e){if(e.name!=='AbortError'&&!ctx.disposed)toast.error(e.message);}},
  changed:section=>{ctx.dirty.add(section);ctx.$('ssUnsaved').textContent='Unsaved '+[...ctx.dirty].join(' & ')+' changes';},
  preview:values=>ctx.$('ssStage').contentWindow?.postMessage({startingSoonPreview:values},location.origin),
  action:async(name,body={})=>{const result=await ctx.request(base+'/'+name,body);toast.info('Control sent');return result;},
  save:async patch=>{
   const saved=await ctx.request(base+'/settings',{...patch,revision:ctx.config.revision});
   ctx.config={...ctx.config,...saved};return saved;
  },
  saved:section=>{ctx.dirty.delete(section);ctx.$('ssUnsaved').textContent=ctx.dirty.size?'Unsaved '+[...ctx.dirty].join(' & ')+' changes':'All changes saved';toast.success('Saved');}
 };
 current=ctx;
 if(!document.querySelector('link[data-starting-desk]')){const l=document.createElement('link');l.rel='stylesheet';l.href='/starting-soon/desk.css';l.dataset.startingDesk='';document.head.append(l);}
 root.innerHTML=`<div id="ssDesk">
 <div class="ss-top"><div><div class="ss-kicker">Broadcast waiting room</div><h1>Starting Soon</h1><p class="ss-muted">Curate the moments. Set the scene. Keep an eye on what comes next.</p></div>
 <div class="ss-row"><button id="ssMessageToggle" class="ss-button" disabled>Hide Starting Soon text</button><button id="ssStart" class="ss-button primary">Open in OBS</button><button id="ssFinish" class="ss-button">Finish & return</button><button id="ssInstall" class="ss-button">Check OBS scene</button></div></div>
 <div id="ssProduction" class="ss-production"></div>
 <div class="ss-monitor">
 <section class="ss-card"><div class="ss-previewbar"><span class="ss-kicker">Layout preview · off stream</span><div class="ss-row"><button id="ssPreviewMode" class="ss-button">Preview clip window</button><button id="ssFollow" class="ss-button">Follow live layout</button></div></div><iframe id="ssStage" title="Waiting room layout preview" src="/starting-soon/overlay.html?demo=1"></iframe><p class="ss-muted">Artwork and layout can be previewed here before saving. Highlights are an optional layer over the scenery.</p></section>
 <section class="ss-card"><span id="ssState" class="ss-status" role="status">Connecting to the Hub…</span><h2 id="ssNowTitle">Your waiting room is ready</h2><progress id="ssProgress" value="0" max="1"></progress><div class="ss-times"><span id="ssElapsed">0:00</span><span id="ssDuration">0:00</span></div>
 <div class="ss-row" style="margin:14px 0"><button id="ssPause" class="ss-button">Pause clips</button><button id="ssSkip" class="ss-button">Next clip</button><button id="ssStop" class="ss-button">Stop clips</button><button id="ssNextArt" class="ss-button">Next artwork</button></div>
 <div class="ss-previewbar"><h3>Up next <span id="ssQueueCount" class="ss-badge">0</span></h3><span id="ssQueueMode" class="ss-muted"></span></div><ul id="ssQueue" class="ss-queue"></ul><p id="ssRuntimeNotice" class="ss-warning"></p><details><summary class="ss-muted">Recently played</summary><ul id="ssHistory" class="ss-queue"></ul></details></section>
 </div>
 <div class="ss-previewbar"><div class="ss-tabs" role="tablist"><button id="ssClipsTab" role="tab" aria-selected="true" class="ss-button">Clips & playlists</button><button id="ssArtTab" role="tab" aria-selected="false" class="ss-button">Artwork & placement</button></div><span id="ssUnsaved" class="ss-notice"></span></div>
 <div id="ssClipsPanel" class="ss-workspace"><section id="ssPlaylistPanel" class="ss-card"></section><section id="ssLibraryPanel" class="ss-card"></section></div>
 <div id="ssArtPanel" class="ss-appearance" hidden></div>
 <dialog id="ssClipDialog"><div class="ss-previewbar"><div><span class="ss-kicker">Private clip preview</span><h2 id="ssClipTitle"></h2></div><button id="ssClosePreview" class="ss-button">Close</button></div><video id="ssClipVideo" controls muted playsinline preload="metadata"></video><p id="ssPreviewStatus" class="ss-muted"></p><div id="ssPreviewControls" class="ss-row"></div><div id="ssClipPlacement"></div></dialog>
 </div>`;
 bind(ctx,'ssStart',()=>ctx.action('start'));bind(ctx,'ssFinish',()=>ctx.action('finish'));bind(ctx,'ssInstall',()=>ctx.action('install'));
 bind(ctx,'ssMessageToggle',async()=>{
  const saved=await ctx.save({show_message:!(ctx.live?.show_message??ctx.config.show_message??true)});
  ctx.live={...ctx.live,show_message:saved.show_message};ctx.preview({show_message:saved.show_message});
  ctx.appearance?.syncVisibility(saved);ctx.updateLive(ctx.live);toast.success(saved.show_message?'Starting Soon text shown':'Starting Soon text hidden');
 });
 for(const [id,action] of [['ssSkip','skip'],['ssStop','stop'],['ssNextArt','next-art']])bind(ctx,id,()=>ctx.action(action));
 bind(ctx,'ssPause',()=>ctx.action(ctx.live?.session_queue?.paused?'resume':'pause'));
 let previewClip=false;ctx.$('ssStage').addEventListener('load',()=>ctx.preview({demo:previewClip}));
 bind(ctx,'ssPreviewMode',()=>{previewClip=!previewClip;ctx.preview({demo:previewClip,highlights_enabled:previewClip?true:(ctx.live?.highlights_enabled??true)});ctx.$('ssPreviewMode').textContent=previewClip?'Hide clip window':'Preview clip window';});
 bind(ctx,'ssFollow',()=>{ctx.preview({reset:true});ctx.preview({demo:previewClip,...(previewClip?{highlights_enabled:true}:{})});});
 for(const [id,art] of [['ssClipsTab',false],['ssArtTab',true]])bind(ctx,id,()=>{
  ctx.$('ssClipsPanel').hidden=art;ctx.$('ssArtPanel').hidden=!art;
  ctx.$('ssClipsTab').setAttribute('aria-selected',String(!art));ctx.$('ssArtTab').setAttribute('aria-selected',String(art));
 });
 await ctx.perform(async()=>{
  const [config,library]=await Promise.all([ctx.request(base),ctx.request('/api/projects/instant_replay/clips')]);
  if(ctx.disposed)return;ctx.config=config;ctx.clips=library.clips||[];ctx.groups=library.groups||[];
  ctx.playlists=mountPlaylists(ctx);ctx.library=mountLibrary(ctx);ctx.appearance=mountAppearance(ctx);
  ctx.refreshAppearance=()=>{ctx.appearance=mountAppearance(ctx);};ctx.production=mountProduction(ctx);
 });
 let queueKey='',historyKey='';
 ctx.updateLive=s=>{
  if(ctx.disposed)return;ctx.live=s;const q=s.session_queue||{};
  ctx.production?.update(s);
  ctx.$('ssMessageToggle').disabled=!ctx.config;
  ctx.$('ssMessageToggle').textContent=(s.show_message??true)?'Hide Starting Soon text':'Show Starting Soon text';
  ctx.$('ssState').textContent=s.active?'● STARTING SOON IS ON OBS':s.ready?'OBS scene installed · waiting room is off air':'Open in OBS to prepare the waiting room';
  ctx.$('ssNowTitle').textContent=q.paused?'Paused — '+(s.clip_title||'waiting for clips'):s.loading?'Loading '+s.clip_title:s.playing?s.clip_title:s.gap_remaining?'Scenery break · '+Math.ceil(s.gap_remaining)+'s':s.active?'Enjoy the scenery':'Your waiting room is ready';
  ctx.$('ssProgress').max=Math.max(1,s.duration_ms||0);ctx.$('ssProgress').value=s.position_ms||0;
  ctx.$('ssElapsed').textContent=clock(s.position_ms);ctx.$('ssDuration').textContent=clock(s.duration_ms);
  ctx.$('ssPause').textContent=q.paused?'Resume clips':'Pause clips';for(const id of ['ssPause','ssSkip','ssStop'])ctx.$(id).disabled=!q.busy;
  ctx.$('ssQueueCount').textContent=q.busy?(q.upcoming||[]).length:0;
  ctx.$('ssQueueMode').textContent=q.busy?[q.loop?'Loop':'Once',q.shuffle?'Shuffled':'In order'].join(' · '):'No running playlist';
  ctx.$('ssRuntimeNotice').textContent=s.error||(s.missing_clips?.length?s.missing_clips.length+' unavailable clips skipped. Their playlist entries are kept.':'');
  const key=JSON.stringify([q.busy,q.upcoming]);if(key!==queueKey){queueKey=key;const rows=q.busy?(q.upcoming||[]):[];ctx.$('ssQueue').replaceChildren(...rows.map((r,i)=>{
   const li=document.createElement('li');li.append(text('span',(i+1)+'. '+r.title),button('Next',()=>ctx.perform(()=>ctx.action('queue-first',{entry_id:r.entry_id}))),button('Remove',()=>ctx.perform(()=>ctx.action('queue-remove',{entry_id:r.entry_id}))));return li;
  }));if(!rows.length)ctx.$('ssQueue').append(text('li','Start a saved playlist, then manage upcoming clips here.','ss-muted'));}
  const history=JSON.stringify(q.history);if(history!==historyKey){historyKey=history;ctx.$('ssHistory').replaceChildren(...(q.history||[]).map(r=>{const li=document.createElement('li');li.append(text('span',r.title+' · '+r.outcome));return li;}));}
 };
 const poll=async()=>{if(ctx.disposed)return;await ctx.perform(async()=>{const s=await ctx.request(base);ctx.updateLive(s);});if(!ctx.disposed)ctx.timer=setTimeout(poll,1000);};
 await poll();
 ctx.beforeUnload=e=>{if(ctx.dirty.size){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',ctx.beforeUnload);
}
export function beforeLeave(){return !current?.dirty.size||confirm('Leave without saving your waiting-room edits?');}
export function unmount(){if(!current)return;current.disposed=true;clearTimeout(current.timer);current.abort.abort();current.library?.dispose();window.removeEventListener('beforeunload',current.beforeUnload);current=null;}

