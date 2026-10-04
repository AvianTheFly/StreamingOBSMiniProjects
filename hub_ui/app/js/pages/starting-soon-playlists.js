import {button,text,titleOf,bind} from './starting-soon-common.js';

export function mountPlaylists(ctx){
 let lists=structuredClone(ctx.config.playlists),active=ctx.config.active_playlist_id,drag=-1;
 const get=()=>lists.find(p=>p.id===active), mark=()=>ctx.changed('playlists');
 ctx.$('ssPlaylistPanel').innerHTML=`<div class="ss-previewbar"><h2>Saved playlists</h2><span id="ssPlaylistCount" class="ss-badge"></span></div>
 <label>Choose playlist<select id="ssListSelect"></select></label><div class="ss-row"><button id="ssListNew" class="ss-button">New</button><button id="ssListDuplicate" class="ss-button">Duplicate</button><button id="ssListDelete" class="ss-button danger">Delete playlist</button></div>
 <label>Playlist name<input id="ssListName" maxlength="80"></label><p class="ss-muted">Drag to reorder, or use the arrows. Play from any entry. Saved edits are used the next time you start this playlist.</p>
 <ol id="ssPlaylist" class="ss-list"></ol><div class="ss-fields"><label class="ss-check"><input type="checkbox" id="ssLoop">Loop</label><label class="ss-check"><input type="checkbox" id="ssShuffle">Shuffle</label><label>Scenery break (seconds)<input type="number" id="ssGap" min="0" max="120"></label></div>
 <div class="ss-row"><button id="ssSavePlaylist" class="ss-button">Save playlist</button><button id="ssPlay" class="ss-button primary">Play playlist in OBS</button><button id="ssClear" class="ss-button">Clear entries</button></div>`;
 ctx.$('ssLoop').checked=ctx.config.loop;ctx.$('ssShuffle').checked=ctx.config.shuffle;ctx.$('ssGap').value=ctx.config.gap_seconds;
 const renderSelect=()=>{ctx.$('ssListSelect').replaceChildren(...lists.map(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.name;return o;}));ctx.$('ssListSelect').value=active;ctx.$('ssListName').value=get().name;};
 async function save(){const saved=await ctx.save({playlists:lists,active_playlist_id:active,loop:ctx.$('ssLoop').checked,shuffle:ctx.$('ssShuffle').checked,gap_seconds:Number(ctx.$('ssGap').value)});lists=structuredClone(saved.playlists);ctx.saved('playlists');renderSelect();}
 async function play(index=0){if(!(ctx.live?.highlights_enabled??true))throw Error('Enable the highlight overlay before playing a playlist.');if(!get().paths.length)throw Error('Add clips to this playlist first.');if(!ctx.live?.active)throw Error('Open Starting Soon in OBS first.');ctx.library?.stopPreview();await save();await ctx.action('play',{paths:get().paths,start_index:index});}
 function render(){
  ctx.$('ssPlaylistCount').textContent=get().paths.length+' clips';ctx.$('ssListDelete').disabled=lists.length<=1;
  ctx.$('ssPlaylist').replaceChildren(...get().paths.map((path,i)=>{
   const li=document.createElement('li');li.draggable=true;li.dataset.index=i;
   li.ondragstart=e=>{drag=i;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(i));};li.ondragover=e=>e.preventDefault();li.ondrop=e=>{e.preventDefault();if(drag>=0&&drag!==i){const [p]=get().paths.splice(drag,1);get().paths.splice(i,0,p);mark();render();}drag=-1;};
   const copy=text('div','','ss-copy'),known=ctx.clips.find(c=>c.path===path);copy.append(text('strong',(i+1)+'. '+titleOf(ctx,path)),text('small',known?(known.game||known.scope||'Saved clip'):'Unavailable — remove or replace this entry',known?'':'ss-warning'));
   li.append(copy,button('Preview',()=>ctx.library.preview(path)),button('▶',()=>ctx.perform(()=>play(i)),{title:'Start playback from this entry',disabled:!known}));
   for(const [label,delta] of [['↑',-1],['↓',1],['×',0]])li.append(button(label,()=>{if(delta)[get().paths[i],get().paths[i+delta]]=[get().paths[i+delta],get().paths[i]];else get().paths.splice(i,1);mark();render();},{title:delta?'Move clip':'Remove entry',disabled:delta!==0&&(i+delta<0||i+delta>=get().paths.length)}));
   return li;
  }));if(!get().paths.length)ctx.$('ssPlaylist').append(text('li','Select clips from the library to build this playlist.','ss-empty'));
 }
 ctx.$('ssListSelect').onchange=()=>{active=ctx.$('ssListSelect').value;ctx.$('ssListName').value=get().name;mark();render();};
 ctx.$('ssListName').oninput=()=>{get().name=ctx.$('ssListName').value;mark();};ctx.$('ssListName').onchange=renderSelect;
 for(const id of ['ssLoop','ssShuffle','ssGap'])ctx.$(id).onchange=mark;
 function create(duplicate){const name=prompt(duplicate?'Name the duplicate playlist':'Name your playlist',duplicate?get().name+' copy':'New playlist');if(!name?.trim())return;const id=crypto.randomUUID?.()||'list-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);const p={id,name:name.trim(),paths:duplicate?[...get().paths]:[]};lists.push(p);active=p.id;mark();renderSelect();render();}
 bind(ctx,'ssListNew',()=>create(false));bind(ctx,'ssListDuplicate',()=>create(true));
 bind(ctx,'ssListDelete',()=>{if(lists.length>1&&confirm('Delete this saved playlist? The video files will remain.')){lists=lists.filter(p=>p.id!==active);active=lists[0].id;mark();renderSelect();render();}});
 bind(ctx,'ssSavePlaylist',save);bind(ctx,'ssPlay',()=>play());bind(ctx,'ssClear',()=>{if(!get().paths.length||confirm('Clear the entries in this playlist?')){get().paths=[];mark();render();}});
 renderSelect();render();return {save,render,add:paths=>{const add=paths.filter(p=>!get().paths.includes(p));get().paths.push(...add);mark();render();return add.length;}};
}
