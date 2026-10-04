import {button,text,titleOf,bind} from './starting-soon-common.js';

export function mountLibrary(ctx){
 let page=0,selected=new Set(),previewVersion=0,previewTimer=null;
 ctx.$('ssLibraryPanel').innerHTML=`<div class="ss-previewbar"><h2>Clip library</h2><button id="ssRefresh" class="ss-button">Refresh library</button></div><p class="ss-muted">Preview privately before adding. Selection and live queue controls never alter the saved video.</p>
 <input id="ssSearch" type="search" placeholder="Search title, filename, game, tag…" aria-label="Search clip library"><div class="ss-fields"><label>Show<select id="ssFilter"><option value="all">All saved media</option><option value="favorite">Favorites</option><option value="cut">Replay cuts</option><option value="highlight">Highlight reels</option></select></label><label>Order<select id="ssSort"><option value="new">Newest first</option><option value="old">Oldest first</option><option value="title">Title A–Z</option></select></label><label>Compilation<select id="ssGroup"></select></label></div>
 <div class="ss-row"><button id="ssAddGroup" class="ss-button">Add compilation</button><button id="ssSelectPage" class="ss-button">Select this page</button><button id="ssAddSelected" class="ss-button primary">Add selected</button><button id="ssClearSelection" class="ss-button">Clear selection</button><span id="ssSelectedCount" class="ss-badge">0 selected</span></div>
 <ul id="ssLibrary" class="ss-list"></ul><div class="ss-previewbar"><span id="ssLibraryCount" class="ss-muted"></span><div class="ss-row"><button id="ssPrevPage" class="ss-button">Previous</button><span id="ssPage" class="ss-muted"></span><button id="ssNextPage" class="ss-button">Next</button></div></div>`;
 function populateGroups(){ctx.$('ssGroup').replaceChildren(...[{id:'',name:'Choose a compilation'},...ctx.groups].map(g=>{const o=document.createElement('option');o.value=g.id;o.textContent=g.name;return o;}));}
 function rows(){const query=ctx.$('ssSearch').value.toLowerCase(),filter=ctx.$('ssFilter').value;return ctx.clips.filter(c=>`${c.title} ${c.name} ${c.game||''} ${c.tag||''}`.toLowerCase().includes(query)).filter(c=>filter==='all'||filter==='favorite'&&c.favorite||filter==='cut'&&(c.path.includes('_ir_trimmed')||/[\\/]clips[\\/]/.test(c.path))||filter==='highlight'&&(c.scope==='highlight reel'||/[\\/]edited[\\/]/.test(c.path))).sort((a,b)=>ctx.$('ssSort').value==='title'?(a.title||a.name).localeCompare(b.title||b.name):(a.saved_at-b.saved_at)*(ctx.$('ssSort').value==='old'?1:-1));}
 function render(){const all=rows(),count=Math.max(1,Math.ceil(all.length/25));page=Math.max(0,Math.min(page,count-1));const visible=all.slice(page*25,(page+1)*25);
  ctx.$('ssLibrary').replaceChildren(...visible.map(c=>{const li=document.createElement('li'),check=document.createElement('input');check.type='checkbox';check.checked=selected.has(c.path);check.setAttribute('aria-label','Select '+(c.title||c.name));check.onchange=()=>{check.checked?selected.add(c.path):selected.delete(c.path);updateSelected();};const copy=text('div','','ss-copy');copy.append(text('strong',(c.favorite?'★ ':'')+(c.title||c.name)),text('small',[c.game,c.tag,c.scope,new Date(c.saved_at*1000).toLocaleDateString()].filter(Boolean).join(' · ')));li.append(check,copy,button('Preview',()=>preview(c.path)),button('Add',()=>ctx.playlists.add([c.path])));return li;}));
  if(!visible.length)ctx.$('ssLibrary').append(text('li','No matching clips. Try another filter or refresh the library.','ss-empty'));
  ctx.$('ssLibraryCount').textContent=all.length+' matches · '+ctx.clips.length+' saved clips';ctx.$('ssPage').textContent=(page+1)+' / '+count;ctx.$('ssPrevPage').disabled=page===0;ctx.$('ssNextPage').disabled=page>=count-1;updateSelected();
 }
 function updateSelected(){ctx.$('ssSelectedCount').textContent=selected.size+' selected';ctx.$('ssAddSelected').disabled=!selected.size;}
 for(const [id,event] of [['ssSearch','input'],['ssFilter','change'],['ssSort','change']])ctx.$(id).addEventListener(event,()=>{page=0;render();});
 bind(ctx,'ssPrevPage',()=>{page--;render();});bind(ctx,'ssNextPage',()=>{page++;render();});bind(ctx,'ssSelectPage',()=>{rows().slice(page*25,(page+1)*25).forEach(c=>selected.add(c.path));render();});
 bind(ctx,'ssClearSelection',()=>{selected.clear();render();});bind(ctx,'ssAddSelected',()=>{ctx.playlists.add([...selected]);selected.clear();render();});
 bind(ctx,'ssAddGroup',()=>{const g=ctx.groups.find(g=>g.id===ctx.$('ssGroup').value);if(g)ctx.playlists.add(g.paths);});
 bind(ctx,'ssRefresh',async()=>{const data=await ctx.request('/api/projects/instant_replay/clips');if(ctx.disposed)return;ctx.clips=data.clips||[];ctx.groups=data.groups||[];populateGroups();render();ctx.playlists.render();});
 function stopPreview(){previewVersion++;clearTimeout(previewTimer);const video=ctx.$('ssClipVideo');video.pause();video.removeAttribute('src');video.load();}
 ctx.$('ssClosePreview').onclick=()=>ctx.$('ssClipDialog').close();ctx.$('ssClipDialog').addEventListener('close',stopPreview);
 async function preview(path){
  stopPreview();const version=previewVersion;const dialog=ctx.$('ssClipDialog');ctx.$('ssClipTitle').textContent=titleOf(ctx,path);ctx.$('ssPreviewStatus').textContent='Preparing a private browser preview…';
  ctx.$('ssPreviewControls').replaceChildren(button('Add to playlist',()=>ctx.playlists.add([path]),{primary:true}),button('Queue next in OBS',()=>ctx.perform(()=>ctx.action('queue-next',{paths:[path]})),{disabled:!ctx.live?.session_queue?.busy}));
  ctx.appearance?.clipPlacement(path,ctx.$('ssClipPlacement'));
  if(!dialog.open)dialog.showModal();const encoded=encodeURIComponent(path);let attempts=0;
  const poll=async()=>{try{const s=await ctx.request('/api/projects/instant_replay/preview?path='+encoded);if(ctx.disposed||version!==previewVersion)return;
   if(s.status==='ready'){ctx.$('ssClipVideo').src='/api/projects/instant_replay/preview-media?path='+encoded;ctx.$('ssPreviewStatus').textContent='Private preview · muted initially. Use the video controls to review this clip.';return;}
   if(s.status==='error')throw Error(s.error);if(++attempts>=150)throw Error('Preview is taking longer than expected. Close and try again shortly.');ctx.$('ssPreviewStatus').textContent=s.status==='busy'?'Other previews are preparing. Waiting…':'Preparing browser-compatible preview…';previewTimer=setTimeout(poll,2000);
  }catch(e){if(!ctx.disposed&&version===previewVersion&&e.name!=='AbortError')ctx.$('ssPreviewStatus').textContent=e.message;}};await poll();
 }
 populateGroups();render();return {preview,stopPreview,dispose:stopPreview};
}
