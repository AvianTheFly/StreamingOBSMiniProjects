'use strict';
const $ = id => document.getElementById(id);
const token = document.querySelector('meta[name="token"]').content;
const labels = {unreviewed:'Unreviewed',reviewing:'In progress',rereview:'Re-review',later:'Maybe / later',keep_full:'Reviewed · keep full',keep_clips:'Reviewed · keep clips',delete:'Reviewed · delete'};
let catalogue={videos:[],jobs:[],roots:[]}, selected=null, view='library', offset=0, proxy=false, editing=null, pendingConfirmation=null, pendingPreview=null, lastPlayback=null, watched=[], dirty=false, toastTimer, switching=false, windowStart=0, customWindowLength=null;
let workflow=null, clipEditor=null, clipPreviewBoundary=null, clipPreviewGeneration=0, draftEditingId=null, draftSerial=0, pendingBoundaryFrame=null;
const player=$('player');
const clipHistory=FootageClipHistory.create({
  read:async(videoId,id)=>{const fresh=await api('/api/library');return fresh.videos.find(v=>v.id===videoId)?.ranges.find(r=>r.id===id);},
  write:range=>api('/api/range',range)
});
function escape(text){return String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function time(n,precise=false){n=Math.max(0,Number(n)||0);const totalMs=Math.round(n*1000),whole=Math.floor(totalMs/1000),h=Math.floor(whole/3600),m=Math.floor(whole/60)%60,sec=whole%60;return [h,m,sec].map(x=>String(x).padStart(2,'0')).join(':')+(precise?'.'+String(totalMs%1000).padStart(3,'0'):'');}
function parse(value){const parts=String(value).trim().split(':').map(Number);if(!parts.length||parts.length>3||parts.some(x=>!Number.isFinite(x)||x<0))throw Error('Enter seconds or HH:MM:SS');return parts.reduce((a,b)=>a*60+b,0);}
function size(n){return n>=1e12?(n/1e12).toFixed(2)+' TB':n>=1e9?(n/1e9).toFixed(1)+' GB':(n/1e6).toFixed(1)+' MB';}
function notify(text,error=false){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').classList.toggle('error',error);$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,error?12000:4500);}
async function api(path,body){const options=body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Footage-Token':token},body:JSON.stringify(body)};const response=await fetch(path,options);const result=await response.json();if(!response.ok)throw Error(result.error||'Request failed');return result;}
async function action(fn){try{await fn();}catch(error){notify(error.message,true);}}
function current(){return selected?Math.min(selected.duration,Math.max(0,player.currentTime+offset)):0;}
function mergeCoverage(existing,added){const all=[...existing,...added].sort((a,b)=>a[0]-b[0]), merged=[];for(const r of all){const last=merged.at(-1);if(last&&r[0]<=last[1]+1)last[1]=Math.max(last[1],r[1]);else merged.push([...r]);}return merged;}
async function savePosition(){if(!selected||selected.availability!=='online'||player.readyState<1)return;const id=selected.id,position=current(),coverage=watched;const status=coverage.length&&selected.status==='unreviewed'?'reviewing':selected.status;if(status!==selected.status){selected.status=status;$('status').value=status;}watched=[];selected.position=position;selected.coverage=JSON.stringify(mergeCoverage(JSON.parse(selected.coverage||'[]'),coverage));try{await api('/api/video',{id,position,coverage,status});$('save-state').textContent='Playback position saved · '+time(position);renderTimeline();}catch(e){watched.push(...coverage);notify('Could not save review progress: '+e.message,true);}}
async function refresh(initial=false){catalogue=await api('/api/library');if((catalogue.session&&catalogue.session!==token)||(catalogue.ui_version&&catalogue.ui_version!==document.querySelector('meta[name=ui-version]').content)){location.reload();return;}if(selected){const fresh=catalogue.videos.find(v=>v.id===selected.id);if(fresh){const locallyCovered=selected.coverage;selected=fresh;if(watched.length)selected.coverage=locallyCovered;renderRanges();renderTimeline();}}updateFilterOptions();renderLibrary();renderJobs();const active=catalogue.videos.filter(v=>v.availability==='online');$('stats').textContent=`${active.length} recordings · ${size(active.reduce((a,v)=>a+v.size,0))} · ${size(catalogue.free)} free for clips`;
workflow?.render();
if(initial){const old=Number(localStorage.getItem('footage-selected'));const video=catalogue.videos.find(v=>v.id===old&&(v.availability==='online'||v.ranges.some(r=>r.exported)))||[...catalogue.videos].filter(v=>v.availability==='online').sort((a,b)=>b.duration-a.duration)[0]||catalogue.videos.find(v=>v.ranges.some(r=>r.exported));if(video)await selectVideo(video.id);}
if(pendingPreview){const job=catalogue.jobs.find(j=>j.id===pendingPreview.job);if(job?.state==='done'){if(selected?.id===pendingPreview.video){offset=job.result.start;proxy=true;lastPlayback=null;player.onloadedmetadata=()=>{player.currentTime=0;player.playbackRate=Number($('speed').value);updateClock();};player.src='/preview?key='+job.result.key;player.load();$('preview-notice').hidden=false;$('preview-notice').textContent=`Compatibility preview · ${time(offset)}–${time(Math.min(selected.duration,offset+120))}. Markers use original recording times. Use the full timeline to preview another section.`;$('player-message').hidden=true;}pendingPreview=null;}else if(job?.state==='error'){notify(job.error,true);pendingPreview=null;}}
}
function matches(v,r=null){const search=$('search').value.toLowerCase().trim();const text=[v.name,v.title,v.path,v.game,v.tags,v.notes,r?.title,r?.tags,r?.collection,r?.notes,r?.purpose].join(' ').toLowerCase();const length=$('length-filter').value,source=$('source-filter').value,collection=$('collection-filter').value;return (!search||text.includes(search))&&(view==='rereview'||!$('filter').value||v.status===$('filter').value)&&(!source||v.path.toLowerCase().startsWith(source.toLowerCase()))&&(!collection||(r?r.collection===collection:v.ranges.some(x=>x.collection===collection)))&&(r||view==='deletion'||view==='trash'||(length==='short'?v.duration<300:v.duration>=Number(length)));}
function renderLibrary(){workflow?.render();const isMoments=view==='moments'||view==='rereview';$('export-matching').hidden=!isMoments;$('moment-filters').hidden=!isMoments;$('filter').hidden=isMoments&&view==='rereview';$('decision-filter').hidden=view==='moments';$('list-title').textContent=({library:'RECORDINGS',moments:'SAVED CLIPS',rereview:'RE-REVIEW & LATER',deletion:'CLEAR SPACE',trash:'TRASH & HISTORY'})[view];const items=[];
const ordered=[...catalogue.videos].sort((a,b)=>({duration:b.duration-a.duration,size:b.size-a.size,newest:b.mtime_ns-a.mtime_ns,name:a.name.localeCompare(b.name)})[$('sort').value]);for(const v of ordered){if(view==='trash'){if(!['trash','deleted'].includes(v.availability)||!matches(v))continue;items.push(`<div class="range-card"><strong>${escape(v.title||v.name)}</strong><p>${size(v.size)} · ${v.availability==='trash'?'In trash — still uses disk space':'Permanently deleted'}</p>${v.availability==='trash'?`<div class="actions"><button data-restore="${v.id}">Restore</button><button class="danger" data-purge="${v.id}">Delete forever…</button></div>`:''}</div>`);continue;}
if(!isMoments&&(v.availability==='deleted'||v.availability==='trash'))continue;
if(view==='deletion'&&!['delete','keep_clips'].includes(v.status))continue;
if(isMoments){for(const r of v.ranges){if(view==='moments'&&r.decision!=='keep')continue;if(view==='rereview'&&!['maybe','rereview'].includes(r.decision))continue;if(!matches(v,r)||(view!=='moments'&&$('decision-filter').value&&r.decision!==$('decision-filter').value)||($('usage-filter').value&&r.usage!==$('usage-filter').value)||($('purpose-filter').value&&r.purpose!==$('purpose-filter').value))continue;items.push(`<button class="library-item ${selected?.id===v.id?'selected':''}" data-video="${v.id}" data-range="${r.id}"><strong>${escape(r.title||'Untitled moment')}</strong><small>${escape(v.game||v.name)} · ${time(r.start)}–${time(r.end)}</small><span class="badge ${r.decision}">${escape(r.decision)} · ${escape(r.usage)}</span><small>${escape(r.tags)} ${escape(r.collection)}</small></button>`);}
if(view==='rereview'&&['later','rereview'].includes(v.status)&&matches(v))items.push(videoItem(v));
}else if(matches(v))items.push(videoItem(v));}
$('library').innerHTML=items.join('')||'<p class="muted small">No matching items.</p>';$('list-count').textContent=items.length;}
function videoItem(v){return `<button class="library-item ${selected?.id===v.id?'selected':''}" data-video="${v.id}"><strong>${escape(v.title||v.name)}</strong><small>${time(v.duration)} · ${size(v.size)} · ${v.ranges.length} moments</small><span class="badge">${escape(labels[v.status])}</span><small>${escape(v.game)} ${v.availability==='missing'?' · Missing file':''}</small></button>`;}
async function selectVideo(id,rangeId,position){pendingBoundaryFrame=null;draftSerial++;cancelClipPreview();draftEditingId=Number(rangeId)||null;if(dirty&&selected)await saveVideo();await savePosition();switching=true;player.pause();selected=catalogue.videos.find(v=>v.id===Number(id));if(!selected)return;localStorage.setItem('footage-selected',selected.id);offset=0;proxy=false;lastPlayback=null;watched=[];dirty=false;pendingPreview=null;player.pause();$('empty').hidden=true;$('workspace').hidden=false;$('source-name').textContent=selected.title||selected.name;$('video-title').value=selected.title||'';$('source-game').textContent=selected.game||'RECORDING';const streams=JSON.parse(selected.streams||'[]');$('source-info').textContent=`${time(selected.duration)} · ${size(selected.size)} · ${streams.filter(s=>s.type==='audio').length} audio track(s) · ${selected.path}`;$('duration').textContent=time(selected.duration);$('status').value=selected.status;$('game').value=selected.game;$('video-tags').value=selected.tags;$('video-notes').value=selected.notes;$('in').value=time(selected.position);$('out').value=time(selected.position);$('thumbs').innerHTML='';$('preview-notice').hidden=true;$('player-message').hidden=true;$('offline').hidden=selected.availability==='online'&&!selected.error;$('offline').textContent=selected.error||'This recording is unavailable. Connect its drive or rescan its folder.';$('audio').innerHTML=streams.filter(s=>s.type==='audio').map((s,i)=>`<option value="${i}">Track ${i+1}${s.tags?.title?' · '+escape(s.tags.title):''}</option>`).join('')||'<option value="0">No audio</option>';
const range=rangeId?selected.ranges.find(r=>r.id===Number(rangeId)):null;if(range){$('in').value=time(range.start,true);$('out').value=time(range.end,true);}const seekTo=position===undefined?(range?range.start:selected.position):position;customWindowLength=null;if($('zoom').value==='custom')$('zoom').value='900';$('zoom').querySelector('[value=custom]').disabled=true;centerWindow(seekTo);if(selected.availability==='online')action(()=>loadFrameRate(selected.id));
player.onloadedmetadata=()=>{player.currentTime=Math.min(seekTo,Math.max(0,player.duration-0.1));player.playbackRate=Number($('speed').value);updateClock();};
if(selected.availability==='online'&&!selected.error){player.src='/media?id='+selected.id;player.load();}else{player.removeAttribute('src');player.load();}
if(selected.availability!=='online'){const retained=range?.exported?range:selected.ranges.find(r=>r.decision==='keep'&&r.exported);if(retained)loadExport(retained);}switching=false;clipEditor?.mode(!!range);clipEditor?.sync(true);if(!range)clipEditor?.navigate(seekTo);renderRanges();renderTimeline();renderLibrary();workflow?.render();if(range)notify('Moment selected: '+(range.title||'Untitled moment'));
}

// Public source-review contract used by derived game and voice candidates.
async function reviewSourceRange(videoId,start,end){
  await selectVideo(videoId,null,start);
  setDraftRange({start,end},true,true);clipEditor?.mode(true);
  showBoundaryFrame(start);
} 

async function reviewSavedRange(videoId,rangeId){
  navigateView('library');await selectVideo(videoId,rangeId);
  const range=selected?.ranges.find(r=>r.id===rangeId);
  if(range){setDraftRange({start:range.start,end:range.end},true);clipEditor?.mode(true);showBoundaryFrame(range.start);}

}

function windowLength(){return Math.max(.1,Math.min(selected?.duration||1,customWindowLength||Number($('zoom').value)||selected?.duration||1));}
function centerWindow(position){const length=windowLength();windowStart=Math.max(0,Math.min((selected?.duration||0)-length,position-length/2));}
function frameRate(){return JSON.parse(selected?.streams||'[]').find(s=>s.type==='video')?.fps||60;}
async function loadFrameRate(id){const metadata=await api('/api/video-metadata?id='+id);if(selected?.id===id){selected.streams=JSON.stringify(metadata.streams);$('fps-info').textContent=frameRate().toFixed(2)+' fps · , / . step frames';}}
function updateClock(){const pos=pendingBoundaryFrame&&pendingBoundaryFrame.videoId===selected?.id?pendingBoundaryFrame.position:current(),length=windowLength();$('clock').textContent=time(pos,true)+' / '+time(selected?.duration||0);const inside=pos>=windowStart&&pos<=windowStart+length;$('playhead').hidden=!inside;$('playhead').style.left=((pos-windowStart)/length*100)+'%';$('overview-playhead').style.left=(selected?.duration?pos/selected.duration*100:0)+'%';clipEditor?.position(pos);}
async function seek(pos,previewing=false,boundary=false){if(!selected)return;if(!boundary)pendingBoundaryFrame=null;if(!previewing)cancelClipPreview();pos=Math.max(0,Math.min(selected.duration-.001,pos));if(pos<windowStart||pos>windowStart+windowLength()){centerWindow(pos);renderTimeline();}if(selected.availability!=='online'){const r=selected.ranges.find(r=>r.exported&&pos>=JSON.parse(r.export_info||'{}').start&&pos<=JSON.parse(r.export_info||'{}').end);if(!r)throw Error('Original unavailable. Choose an exported keeper to play.');loadExport(r,pos);return;}lastPlayback=null;if(proxy&&(pos<offset||pos>=offset+player.duration)){await makePreview(pos);return;}player.currentTime=pos-offset;updateClock();}
function renderTimeline(){if(!selected)return;clipEditor?.sync();const duration=selected.duration||1,length=windowLength(),end=windowStart+length;function bar(start,finish,classes='',title=''){const a=Math.max(start,windowStart),b=Math.min(finish,end);if(b<=a)return '';return `<span class="${classes}" style="left:${(a-windowStart)/length*100}%;width:${(b-a)/length*100}%" title="${escape(title)}"></span>`;}$('range-bars').innerHTML=selected.ranges.map(r=>bar(r.start,r.end,r.decision,r.title+' · '+time(r.start,true)+'–'+time(r.end,true))).join('');const coverage=JSON.parse(selected.coverage||'[]');$('coverage').innerHTML=coverage.map(r=>bar(r[0],r[1])).join('');const percent=Math.min(100,coverage.reduce((a,r)=>a+r[1]-r[0],0)/duration*100);$('coverage-info').textContent=`${percent.toFixed(1)}% watched or explicitly marked reviewed. Skipped sections stay unreviewed. Resume: ${time(selected.position)}. Recording status is your overall decision.`;$('window-start').textContent=time(windowStart,true);$('duration').textContent=time(end,true);$('window-label').textContent=length>=duration?'Full recording':time(length)+' detail window';const closeup=clipEditor?.viewport();$('overview-window').style.left=(closeup?.start??windowStart)/duration*100+'%';$('overview-window').style.width=(closeup?closeup.end-closeup.start:length)/duration*100+'%';updateClock();document.dispatchEvent(new CustomEvent('footage:timeline',{detail:{video_id:selected.id,availability:selected.availability,duration,start:windowStart,length,ranges:selected.ranges,draft:draftRange()}}));}
function renderRanges(){if(!selected)return;workflow?.render();$('range-count').textContent='('+selected.ranges.filter(r=>r.decision!=='reject').length+')';$('ranges').innerHTML=selected.ranges.filter(r=>r.decision!=='reject').map(r=>`<article class="range-card"><div class="card-top"><span class="badge ${r.decision}">${escape(r.decision)}</span><strong>${escape(r.title||'Untitled moment')}</strong><span class="muted small">${time(r.end-r.start)}</span></div><p>${time(r.start)} → ${time(r.end)} · ${escape(r.purpose||'Format undecided')} · ${escape(r.usage)}${r.collection?' · '+escape(r.collection):''}</p>${r.tags?`<p>${escape(r.tags)}</p>`:''}${r.notes?`<p>${escape(r.notes)}</p>`:''}${r.exported?`<p>${FootageWorkflow.exportCurrent(selected,r)?'Extracted':'Cut changed · extract again'}: ${escape(r.exported.split(/[\\/]/).at(-1))}</p>`:''}<div class="actions"><button data-play="${r.id}">▶ Play moment</button><button data-edit="${r.id}">Adjust / notes</button><button data-extract="${r.id}" ${r.decision==='reject'?'disabled':''}>Extract clip</button>${r.exported?`<button data-clip="${r.id}">Show exported clip</button>`:''}</div></article>`).join('')||'<p class="muted">Click a highlight or game above, adjust its boundaries, then keep or extract it.</p>';const pending=FootageWorkflow.progress(selected).pending;$('export-keepers').disabled=selected.availability!=='online'||!pending.length||extractionActive();$('export-keepers').textContent=pending.length?'Extract '+pending.length+' remaining keeper'+(pending.length===1?'':'s'):selected.ranges.some(r=>r.decision==='keep')?'Keepers extracted':'Keep a clip to extract';}
function openRange(range=null,decision='keep'){if(!selected)return;editing=range;let start=range?range.start:parse($('in').value),end=range?range.end:parse($('out').value);if(!(end>start))throw Error('Set IN and OUT first. OUT must come after IN.');$('range-dialog-title').textContent=range?'Edit moment':'Mark a moment';$('range-start').value=time(start,true);$('range-end').value=time(end,true);$('range-title').value=range?.title||'';$('range-decision').value=range?.decision||decision;$('range-tags').value=range?.tags||'';$('range-purpose').value=range?.purpose||'';$('range-usage').value=range?.usage||'unused';$('range-collection').value=range?.collection||'';$('range-notes').value=range?.notes||'';$('remove-range').hidden=!range;$('range-dialog').showModal();$('range-title').focus();}
async function saveRange(){const payload={id:editing?.id,video_id:selected.id,start:parse($('range-start').value),end:parse($('range-end').value),title:$('range-title').value,decision:$('range-decision').value,tags:$('range-tags').value,purpose:$('range-purpose').value,usage:$('range-usage').value,collection:$('range-collection').value,notes:$('range-notes').value};const savedResult=await api('/api/range',payload);if(selected.status==='unreviewed'){await api('/api/video',{id:selected.id,status:'reviewing'});$('status').value='reviewing';}$('range-dialog').close();draftEditingId=savedResult.id;setDraftRange({start:payload.start,end:payload.end},true);await refresh();notify('Moment saved');}
function confirmAction(title,description,expected,fn){pendingConfirmation=fn;$('confirm-title').textContent=title;$('confirm-description').textContent=description;$('confirm-expected').textContent=expected;$('confirm-input').value='';$('confirm-action').disabled=true;$('confirm-dialog').showModal();$('confirm-input').focus();}
async function makePreview(start=current()){if(!selected||selected.availability!=='online')throw Error('Source unavailable');await savePosition();const result=await api('/api/preview',{id:selected.id,start,track:Number($('audio').value)});pendingPreview={job:result.job,video:selected.id};notify('Preparing a short preview. It will open when ready.');await refresh();}
function extractionActive(){return catalogue.jobs.some(j=>j.label==='Extract selected clips'&&['running','queued'].includes(j.state));}
async function extract(ids){if(!ids.length)return;if(extractionActive()){notify('Extraction is already running. Progress is shown above the desk.');return;}await api('/api/export',{ids,padding:Number($('padding').value),mode:$('export-mode').value});notify('Extraction queued. See job progress below.');await refresh();}
function renderJobs(){const active=catalogue.jobs.filter(j=>['running','queued'].includes(j.state));$('active-work').hidden=!active.length;$('active-work-text').textContent=active.map(j=>j.label+' · '+j.state+(j.progress?' · '+j.progress:'')).join(' | ');const jobs=catalogue.jobs.slice(-5).reverse();$('jobs').innerHTML=jobs.map(j=>`<details ${['running','queued','error'].includes(j.state)?'open':''}><summary class="${j.state==='error'?'error':''}">${escape(j.label)} · ${escape(j.state)} ${j.state==='running'?escape(j.progress):''}</summary>${j.error?'<pre>'+escape(j.error)+'</pre>':''}${j.result?.files?`<pre>${escape(j.result.files.join('\n'))}</pre>`:''}${j.result?.errors?.length?`<pre>${escape(j.result.errors.map(e=>typeof e==='string'?e:(e.name||'Recording')+': '+e.error).join('\n'))}</pre>`:''}${['running','queued'].includes(j.state)&&j.label!=='Permanently delete recording'?`<button data-cancel-job="${j.id}">Cancel job</button>`:''}${j.state==='done'&&j.result?.added!==undefined?`<span>${j.result.added} recordings added.</span>`:''}${j.state==='done'&&j.result?.analyses?`<span>${j.result.analyses.reduce((n,a)=>n+a.games,0)} games found in ${j.result.analyses.length} recordings.</span>`:''}</details>`).join('');}
function settings(){ $('roots').value=catalogue.roots.join('\n');$('output-path').value=catalogue.output;$('data-path').textContent='Catalogue and generated previews: '+catalogue.data;$('settings-dialog').showModal();}
$('settings').onclick=settings;$('empty-settings').onclick=settings;
$('save-settings').onclick=()=>action(async()=>{await api('/api/settings',{roots:$('roots').value.split('\n').map(x=>x.trim()).filter(Boolean),output:$('output-path').value.trim()});$('settings-dialog').close();notify('Folders saved. Scan queued.');await refresh();});
$('scan').onclick=()=>action(async()=>{await api('/api/scan',{});notify('Scanning for new or changed recordings');await refresh();});
$('clear-cache').onclick=()=>action(async()=>{await api('/api/clear-cache',{});$('thumbs').innerHTML='';notify('Generated previews cleared. Markers and originals preserved.');});
$('backup').onclick=()=>action(async()=>{const r=await api('/api/backup',{});notify('Catalogue backed up: '+r.path);});
function navigateView(nextView){if(nextView!=='library'){player.pause();action(savePosition);}view=nextView;$('analysis-panel').hidden=true;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));renderLibrary();}document.querySelectorAll('nav button').forEach(button=>button.onclick=()=>navigateView(button.dataset.view));
for(const id of ['search','filter','decision-filter','usage-filter','purpose-filter','length-filter','sort','source-filter','collection-filter'])$(id).addEventListener(id==='search'?'input':'change',renderLibrary);
$('library').onclick=e=>action(async()=>{const button=e.target.closest('button');if(!button)return;if(button.dataset.video){navigateView('library');await selectVideo(Number(button.dataset.video),button.dataset.range);}if(button.dataset.restore)await restoreOriginal(Number(button.dataset.restore));if(button.dataset.purge)purgeOriginal(Number(button.dataset.purge));});
$('next').onclick=()=>action(async()=>{const next=[...catalogue.videos].sort((a,b)=>b.duration-a.duration).find(v=>matches(v)&&v.availability==='online'&&v.status==='unreviewed'&&v.id!==selected?.id)||catalogue.videos.find(v=>v.availability==='online'&&v.status==='reviewing'&&v.id!==selected?.id);if(next){navigateView('library');await selectVideo(next.id);}else notify('No other unreviewed or in-progress recordings');});
$('reveal').onclick=()=>action(()=>api('/api/open',{id:selected.id}));$('output').onclick=()=>action(()=>api('/api/open',{kind:'output'}));
$('back').onclick=()=>action(()=>seek(current()-30));$('forward').onclick=()=>action(()=>seek(current()+30));$('jump-go').onclick=()=>action(()=>seek(parse($('jump').value)));$('jump').onkeydown=e=>{if(e.key==='Enter')$('jump-go').click();};$('speed').onchange=()=>player.playbackRate=Number($('speed').value);$('preview').onclick=()=>action(()=>makePreview());$('audio').onchange=()=>action(()=>makePreview());
$('original').onclick=()=>action(async()=>{const pos=current();await savePosition();offset=0;proxy=false;lastPlayback=null;player.onloadedmetadata=()=>{player.currentTime=pos;player.playbackRate=Number($('speed').value);};player.src='/media?id='+selected.id;player.load();$('preview-notice').hidden=true;});
player.onerror=()=>{if(selected?.availability==='online')$('player-message').hidden=false;};player.onended=()=>{if(proxy)notify('Preview ended. Jump ahead or make the next preview.');};player.onseeking=()=>lastPlayback=null;
player.addEventListener('timeupdate',()=>{if(!selected)return;const now=current(),wall=performance.now();if(clipPreviewBoundary&&FootageClipEditor.previewFinished(clipPreviewBoundary,selected.id,now)){player.pause();cancelClipPreview();}if(!player.paused&&!player.seeking&&lastPlayback){const delta=now-lastPlayback.pos,expected=(wall-lastPlayback.wall)/1000*player.playbackRate;if(delta>0&&delta<=Math.max(2,expected+1)){watched.push([lastPlayback.pos,now]);}}lastPlayback={pos:now,wall};if($('follow-window').checked&&(now<windowStart||now>windowStart+windowLength())){centerWindow(now);renderTimeline();}updateClock();});player.onpause=()=>{lastPlayback=null;cancelClipPreview();};
$('timeline').onclick=e=>action(()=>{const rect=$('timeline').getBoundingClientRect();return seek(windowStart+(e.clientX-rect.left)/rect.width*windowLength());});
$('mark-in').onclick=()=>{$('in').value=time(current(),true);cancelClipPreview();clipEditor?.sync(true);};$('mark-out').onclick=()=>{$('out').value=time(current(),true);cancelClipPreview();clipEditor?.sync(true);};document.querySelectorAll('[data-new]').forEach(b=>b.onclick=()=>action(()=>editDraft(b.dataset.new)));
$('mark-reviewed').onclick=()=>action(async()=>{const start=parse($('in').value),end=parse($('out').value);if(!(end>start&&end<=selected.duration))throw Error('Set a valid IN / OUT range first');await api('/api/video',{id:selected.id,coverage:[[start,end]]});await refresh();notify('Section marked reviewed');});
$('save-range').onclick=()=>action(saveRange);$('remove-range').onclick=()=>{const r=editing;$('range-dialog').close();confirmAction('Remove this marker?','This removes the range from your catalogue. Exported files remain on disk.','REMOVE',async()=>{await api('/api/remove-range',{id:r.id});await refresh();});};
$('ranges').onclick=e=>action(async()=>{const b=e.target.closest('button');if(!b)return;const ident=Number(b.dataset.play||b.dataset.edit||b.dataset.extract||b.dataset.clip),r=selected.ranges.find(x=>x.id===ident);if(b.dataset.play){if(selected.availability!=='online'&&r.exported)loadExport(r);else await seek(r.start);if(!pendingPreview)await player.play();}if(b.dataset.edit){await reviewSavedRange(selected.id,r.id);$('clip-notes').hidden=false;}if(b.dataset.extract)await extract([ident]);if(b.dataset.clip)await api('/api/open',{kind:'clip',id:ident});});
$('export-keepers').onclick=()=>action(()=>extract(FootageWorkflow.progress(selected).pending.map(r=>r.id)));
async function saveVideo(){await api('/api/video',{id:selected.id,status:$('status').value,title:$('video-title').value,game:$('game').value,tags:$('video-tags').value,notes:$('video-notes').value});dirty=false;await refresh();$('source-game').textContent=selected.game||'RECORDING';$('source-name').textContent=selected.title||selected.name;notify('Recording details saved');}
$('save-video').onclick=()=>action(saveVideo);$('status').onchange=()=>action(async()=>{await api('/api/video',{id:selected.id,status:$('status').value});await refresh();notify('Review status saved');});
for(const id of ['video-title','game','video-tags','video-notes'])$(id).addEventListener('input',()=>{dirty=true;$('save-state').textContent='Recording details have unsaved edits';});
// Persist detail edits on blur as well as the explicit Save button.
for(const id of ['video-title','game','video-tags','video-notes'])$(id).addEventListener('change',()=>action(saveVideo));
async function moveToTrash(id){
  if(selected?.id===id){await savePosition();if(dirty)await saveVideo();}
  const v=catalogue.videos.find(v=>v.id===id);if(!v)throw Error('Recording no longer available');
  await api('/api/check-delete',{id:v.id});
  confirmAction('Move original to trash?',`${size(v.size)} will move into reversible trash on the same drive. Your extracted clips stay in place. This does not free space until you delete permanently in Trash & history.`,v.name,async()=>{
    if(selected?.id===v.id){player.pause();player.removeAttribute('src');player.load();}
    await api('/api/trash',{id:v.id,confirmation:v.name});await refresh();notify('Original moved to trash. Restore it or permanently delete it in Trash & history.');navigateView('trash');
  });
}
async function restoreOriginal(id){await api('/api/restore',{id});await refresh();notify('Recording restored');}
function purgeOriginal(id){const v=catalogue.videos.find(v=>v.id===id);if(!v)throw Error('Recording no longer available');confirmAction('Permanently delete original?',`This reclaims ${size(v.size)}. The full recording cannot be restored afterward. Kept exports are checked again before deletion.`,'DELETE '+v.name,async()=>{await api('/api/purge',{id:v.id,confirmation:'DELETE '+v.name});await refresh();notify('Permanent deletion queued. Check job result.');});}
$('trash').onclick=()=>action(()=>moveToTrash(selected.id));
$('confirm-input').oninput=()=>{$('confirm-action').disabled=$('confirm-input').value!==$('confirm-expected').textContent;};$('confirm-action').onclick=()=>action(async()=>{if($('confirm-action').disabled)return;$('confirm-action').disabled=true;try{if($('confirm-input').value!==$('confirm-expected').textContent)throw Error('Confirmation does not match');await pendingConfirmation();$('confirm-dialog').close();}finally{$('confirm-action').disabled=$('confirm-input').value!==$('confirm-expected').textContent;}});
$('thumbnails').onclick=()=>action(()=>{if(!selected||selected.availability!=='online')throw Error('Source unavailable');const nearby=$('thumb-scope').value==='nearby',start=nearby?Math.max(0,current()-300):0,end=nearby?Math.min(selected.duration,start+600):selected.duration;$('thumbs').innerHTML=Array.from({length:12},(_,i)=>{const t=Math.min(selected.duration-1,start+(end-start)*(i+.5)/12);return `<button data-seek="${t}"><img loading="lazy" src="/thumb?id=${selected.id}&t=${t.toFixed(1)}" alt="Frame at ${time(t)}"><small>${time(t)}</small></button>`;}).join('');});$('thumbs').onclick=e=>{const b=e.target.closest('button');if(b)action(()=>seek(Number(b.dataset.seek)));};
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.altKey||e.metaKey||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||document.querySelector('dialog[open]')||!selected||$('workspace').hidden)return;const k=e.key.toLowerCase();if(k===' '&&['BUTTON','VIDEO'].includes(e.target.tagName))return;if(k===' '){e.preventDefault();action(()=>player.paused?player.play():player.pause());}if(k==='arrowleft'){e.preventDefault();action(()=>seek(current()-(e.shiftKey?1:10)));}if(k==='arrowright'){e.preventDefault();action(()=>seek(current()+(e.shiftKey?1:10)));}if(k===','){e.preventDefault();player.pause();action(()=>seek(current()-1/frameRate()));}if(k==='.'){e.preventDefault();player.pause();action(()=>seek(current()+1/frameRate()));}if(k==='i')$('mark-in').click();if(k==='o')$('mark-out').click();const decision={k:'keep',m:'maybe',r:'rereview',x:'reject'}[k];if(decision)action(()=>editDraft(decision));});
document.addEventListener('visibilitychange',()=>{if(document.hidden)action(()=>savePosition());});
window.addEventListener('pagehide',()=>{if(!selected||selected.availability!=='online'||player.readyState<1)return;fetch('/api/video',{method:'POST',headers:{'Content-Type':'application/json','X-Footage-Token':token},body:JSON.stringify({id:selected.id,position:current(),coverage:watched}),keepalive:true}).catch(()=>{});});
setInterval(()=>action(()=>savePosition()),5000);setInterval(()=>action(()=>refresh()),3000);
action(()=>refresh(true));

$('losslesscut').onclick=()=>action(()=>api('/api/losslesscut',{id:selected.id}));
$('export-matching').onclick=()=>action(async()=>{const ids=catalogue.videos.filter(v=>v.availability==='online').flatMap(v=>v.ranges.filter(r=>r.decision==='keep'&&matches(v,r)&&(!$('usage-filter').value||r.usage===$('usage-filter').value)&&(!$('purpose-filter').value||r.purpose===$('purpose-filter').value)).map(r=>r.id));if(!ids.length)throw Error('No matching keepers');confirmAction('Extract matching keepers?',`${ids.length} clips will be exported from the matching recordings, with your chosen padding and export mode. Originals stay in place.`,'EXPORT',()=>extract(ids));});

function updateFilterOptions(){for(const [id,items,label] of [['source-filter',catalogue.roots,'All source folders'],['collection-filter',[...new Set(catalogue.videos.flatMap(v=>v.ranges.map(r=>r.collection)).filter(Boolean))].sort(),'All collections']]){const element=$(id),value=element.value||localStorage.getItem('footage-filter-'+id)||'';const options=[['',label],...items.map(x=>[x,x])];const signature=JSON.stringify(options);if(element.dataset.signature!==signature){element.innerHTML=options.map(([v,l])=>`<option value="${escape(v)}">${escape(l)}</option>`).join('');element.value=value;element.dataset.signature=signature;}}}
$('help').onclick=()=>$('help-dialog').showModal();
for(const id of ['search','filter','decision-filter','usage-filter','purpose-filter','length-filter','sort','source-filter','collection-filter']){const saved=localStorage.getItem('footage-filter-'+id);if(saved!==null&&id!=='source-filter'&&id!=='collection-filter')$(id).value=saved;$(id).addEventListener(id==='search'?'input':'change',()=>localStorage.setItem('footage-filter-'+id,$(id).value));}

$('jobs').onclick=e=>{const b=e.target.closest('[data-cancel-job]');if(b)action(async()=>{await api('/api/cancel',{id:b.dataset.cancelJob});await refresh();});};

function loadExport(range,position=range.start){const info=JSON.parse(range.export_info||'{}');offset=info.start||0;proxy=true;lastPlayback=null;player.onloadedmetadata=()=>{player.currentTime=Math.max(0,Math.min(player.duration-.1,position-offset));player.playbackRate=Number($('speed').value);updateClock();};player.src='/exported?id='+range.id;player.load();$('preview-notice').hidden=false;$('preview-notice').textContent='Playing retained export · '+range.title+'. Your catalogue still uses original recording timestamps.';$('player-message').hidden=true;}

const savedZoom=localStorage.getItem('footage-zoom');if(savedZoom!==null)$('zoom').value=savedZoom;
$('zoom').onchange=()=>{if($('zoom').value!=='custom'){customWindowLength=null;$('zoom').querySelector('[value=custom]').disabled=true;}centerWindow(current());renderTimeline();localStorage.setItem('footage-zoom',$('zoom').value);};
$('center-window').onclick=()=>{centerWindow(current());renderTimeline();};
$('pan-back').onclick=()=>{windowStart=Math.max(0,windowStart-windowLength()*.75);renderTimeline();};
$('pan-next').onclick=()=>{windowStart=Math.min(Math.max(0,selected.duration-windowLength()),windowStart+windowLength()*.75);renderTimeline();};
$('fit-range').onclick=()=>action(()=>{const start=parse($('in').value),end=parse($('out').value);if(end<=start)throw Error('Set start and end first');customWindowLength=Math.min(selected.duration,Math.max(5,(end-start)*1.5));$('zoom').querySelector('[value=custom]').disabled=false;$('zoom').value='custom';centerWindow((start+end)/2);renderTimeline();});
$('overview').onclick=e=>action(()=>{const rect=$('overview').getBoundingClientRect(),pos=(e.clientX-rect.left)/rect.width*selected.duration;clipEditor.navigate(pos);showBoundaryFrame(pos);});
for(const [id,delta] of [['minus-second',-1],['plus-second',1]])$(id).onclick=()=>action(()=>{player.pause();return seek(current()+delta);});
for(const [id,delta] of [['minus-frame',-1],['plus-frame',1]])$(id).onclick=()=>action(()=>{player.pause();return seek(current()+delta/frameRate());});
$('go-in').onclick=()=>action(()=>seek(parse($('in').value)));$('go-out').onclick=()=>action(()=>seek(parse($('out').value)));

workflow=FootageWorkflow.mount({
  snapshot:()=>({catalogue,selected,view,extracting:extractionActive()}), action,time,size,label:status=>labels[status],
  filters:()=>['search','filter','usage-filter','purpose-filter','source-filter','collection-filter','length-filter'].map(id=>$(id).value),
  matches:(v,r)=>matches(v,r)&&(!r||((!$('usage-filter').value||r.usage===$('usage-filter').value)&&(!$('purpose-filter').value||r.purpose===$('purpose-filter').value))),
  navigate:navigateView,findGames:()=> $('show-analysis').click(),
  review:reviewSavedRange,
  watch:async(id,rangeId)=>{navigateView('library');await selectVideo(id,rangeId);loadExport(selected.ranges.find(r=>r.id===rangeId));await player.play();},
  extract,reveal:id=>api('/api/open',{kind:'clip',id}),trash:moveToTrash,restore:restoreOriginal,purge:purgeOriginal,
  decide:async status=>{if(!selected||selected.availability!=='online')return;await savePosition();if(dirty)await saveVideo();await api('/api/video',{id:selected.id,status});$('status').value=status;await refresh();notify(status==='keep_full'?'Full recording kept.':status==='keep_clips'?'Recording reviewed. Extract remaining keepers, then clear the original.':'Recording reviewed. Find it in Clear space.');},
  quickKeep:()=>saveDraft('keep')
});
workflow.render();

function editDraft(decision='keep'){const saved=selected?.ranges.find(r=>r.id===draftEditingId);const draft=draftRange();if(saved&&draft)openRange({...saved,...draft,decision},decision);else openRange(null,decision);}
function draftRange(){try{return {start:parse($('in').value),end:parse($('out').value)};}catch{return null;}}
function cancelClipPreview(){const playing=clipPreviewBoundary;clipPreviewBoundary=null;clipPreviewGeneration++;if(playing&&!player.paused)player.pause();}
function setDraftRange(range,reframe=false,newDraft=false){cancelClipPreview();if(newDraft){draftEditingId=null;draftSerial++;}$('in').value=time(range.start,true);$('out').value=time(range.end,true);clipEditor?.sync(reframe);renderTimeline();}
function startCustomClip(position){
  if(!selected||selected.availability!=='online')throw Error('Choose an available recording');
  const range=FootageClipEditor.fit(position,20,selected.duration);
  setDraftRange(range,true,true);clipEditor?.mode(true);showBoundaryFrame(position);
}
async function undoClipDecision(){
  const videoId=selected?.id,restored=await clipHistory.undo(videoId);
  if(!restored)return;
  await refresh();
  if(selected?.id===videoId){draftEditingId=restored.id;setDraftRange(restored,true);clipEditor.restoreNotes(restored);showBoundaryFrame(restored.start);}
  notify('Clip decision undone');
}
async function previewDraft(){
  if(!selected||selected.availability!=='online')throw Error('Choose an available recording');
  const range=draftRange();if(!FootageClipEditor.valid(range,selected.duration))throw Error('Choose a valid clip start and end');
  cancelClipPreview();const generation=clipPreviewGeneration,id=selected.id;
  await seek(range.start,true);
  if(generation!==clipPreviewGeneration||selected?.id!==id)return;
  if(pendingPreview){notify('A playback preview is being prepared. Press Preview clip again when it is ready.');return;}
  clipPreviewBoundary={videoId:id,end:range.end};
  try{await player.play();}catch(error){cancelClipPreview();throw error;}
}
clipEditor=FootageClipEditor.mount({
  snapshot:()=>({video:selected,range:draftRange(),position:pendingBoundaryFrame&&pendingBoundaryFrame.videoId===selected?.id?pendingBoundaryFrame.position:(player.readyState>=1?current():selected?.position||0),editing:selected?.ranges.find(r=>r.id===draftEditingId),draftKey:draftSerial,extracting:extractionActive(),undo:clipHistory.available(selected?.id)}),
  setRange:setDraftRange,scrub:showBoundaryFrame,custom:startCustomClip,action,preview:previewDraft,extract:extractDraft,remove:()=>saveDraft('reject'),undo:undoClipDecision,time:n=>time(n,true),
  duration:n=>n<60?Number(n.toFixed(1))+(Math.abs(n-1)<.001?' second':' seconds'):time(n)+' clip'
});
for(const id of ['in','out'])$(id).addEventListener('input',()=>{cancelClipPreview();renderTimeline();});
clipEditor.sync();

// Range persistence stays here; timeline modules only propose cuts.
async function saveDraft(decision){
  if(!selected||selected.availability!=='online')throw Error('Choose an available recording');
  const video=selected,range=draftRange();
  if(!FootageClipEditor.valid(range,video.duration))throw Error('Choose a highlight or drag a valid start and end');
  const saved=video.ranges.find(r=>r.id===draftEditingId)||video.ranges.find(r=>Math.abs(r.start-range.start)<.001&&Math.abs(r.end-range.end)<.001);
  const detail=clipEditor.notes();
  const payload={...(saved||{}),video_id:video.id,...range,...detail,decision,title:saved?.title||'Moment at '+time(range.start)};
  const result=await api('/api/range',payload);
  clipHistory.remember(saved,{...payload,id:result.id});
  if(selected?.id===video.id)draftEditingId=result.id;
  if(video.status==='unreviewed')await api('/api/video',{id:video.id,status:'reviewing'});
  await refresh();notify(decision==='keep'?'Clip kept · Undo is available':'Clip removed from kept clips · Undo is available');return result.id;
}
async function extractDraft(){const id=await saveDraft('keep');await extract([id]);}
function showBoundaryFrame(position){
  if(!selected)return;cancelClipPreview();player.pause();
  pendingBoundaryFrame={videoId:selected.id,position:Math.max(0,Math.min(selected.duration-.001,position))};
  updateClock();flushBoundaryFrame();
}
function flushBoundaryFrame(){
  const pending=pendingBoundaryFrame;
  if(!pending||pending.videoId!==selected?.id||player.readyState<1||player.seeking)return;
  if(Math.abs(current()-pending.position)<.001){pendingBoundaryFrame=null;updateClock();return;}
  action(()=>seek(pending.position,false,true));
}
player.addEventListener('seeked',()=>{
  const pending=pendingBoundaryFrame;
  if(pending&&pending.videoId===selected?.id&&Math.abs(current()-pending.position)<.001)pendingBoundaryFrame=null;
  flushBoundaryFrame();updateClock();
});
player.addEventListener('loadedmetadata',()=>queueMicrotask(()=>{
  if(pendingBoundaryFrame&&pendingBoundaryFrame.videoId===selected?.id){player.pause();flushBoundaryFrame();}
}));
