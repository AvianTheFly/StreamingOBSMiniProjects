// Event-owned alternatives. All edits remain drafts until Save event.
let poolDraft=[];
function readPoolDraft(){return {media_pool:poolDraft.map(x=>({...x})),pool_enabled:$('#poolEnabled')?.checked??true}}
function poolEditor(){
  poolDraft=(settings.config.events[selected]?.media_pool||[]).map(x=>({...x}));
  const section=document.createElement('details');section.open=poolDraft.length>0;
  section.className='reaction-pool';
  section.innerHTML='<summary>Variety · random media pool</summary><label class="check"><input id="poolEnabled" type="checkbox">Pick a random reaction each time</label><p class="muted">Includes the main file above plus these alternatives. Avoids repeating the last pick. Each file has its own display time; event volume and companion sound apply to all. Turn this off to use only the main file.</p><div id="poolCards" class="pool-cards"></div><div id="poolDrop" class="asset-drop" tabindex="0" role="button">Drop files here to add alternatives · or click to upload</div><input id="poolUpload" type="file" multiple hidden accept=".webm,.mp4,.mov,.png,.jpg,.jpeg,.gif,.webp,.mp3,.wav,.ogg,.m4a"><label for="poolLibrary">Add an existing file</label><select id="poolLibrary"></select><button type="button" id="poolAdd">Add to pool</button><p id="poolCount" class="muted"></p>';
  $('#companionMount').before(section);
  $('#poolEnabled').checked=settings.config.events[selected]?.pool_enabled!==false;
  $('#poolEnabled').onchange=markDirty;
  const fillLibrary=()=>{$('#poolLibrary').innerHTML='<option value="">Choose a library file</option>'+options(settings.library.map(a=>[a.path,a.name]),'')};
  const add=path=>{if(!path)return;if(path===$('#media').value||poolDraft.some(x=>x.media===path))throw Error('That file is already in this event.');if(poolDraft.length>=30)throw Error('Maximum 30 alternatives.');poolDraft.push({media:path,duration:2,start_time:0,loop:false});markDirty();render()};
  function render(){
    const root=$('#poolCards');for(const m of root.querySelectorAll('video,audio')){m.pause();m.removeAttribute('src');m.load()}root.replaceChildren();
    poolDraft.forEach((item,index)=>{
      const card=document.createElement('div');card.className='pool-card';
      card.innerHTML=`<div class="pool-preview"></div><strong>${esc(item.media.split(/[\\/]/).pop())}</strong><div class="fields two"><label>Show for (seconds)<input aria-label="Alternative ${index+1} duration" type="number" min="1" max="60" step="0.1" value="${item.duration}"></label><label>Start at (seconds)<input aria-label="Alternative ${index+1} start" type="number" min="0" max="86400" step="0.1" value="${item.start_time}"></label></div><label class="check"><input type="checkbox" ${item.loop?'checked':''}>Repeat until time ends</label><button type="button">Remove from pool</button>`;
      const kind=/\.(png|jpg|jpeg|gif|webp)$/i.test(item.media)?'img':/\.(mp3|wav|ogg|m4a)$/i.test(item.media)?'audio':'video';
      const media=document.createElement(kind);media.src='/asset?path='+encodeURIComponent(item.media);
      if(kind==='video'&&/^media\/meme-[a-z0-9-]+\.mp4$/.test(item.media))media.poster='/meme-thumbnails/'+item.media.slice(11,-4)+'.jpg';
      if(kind!=='img'){media.controls=true;media.preload='none';media.volume=Math.max(0,Math.min(1,Number($('#gain').value)/100));media.onloadedmetadata=()=>{if(media.isConnected&&Number.isFinite(media.duration))media.currentTime=Math.min(item.start_time,Math.max(0,media.duration-.1))};media.onplay=()=>{for(const other of document.querySelectorAll('#editor video,#editor audio'))if(other!==media)other.pause()}}
      card.querySelector('.pool-preview').append(media);
      const inputs=card.querySelectorAll('input');inputs[0].oninput=()=>{item.duration=Number(inputs[0].value);markDirty()};inputs[1].oninput=()=>{item.start_time=Number(inputs[1].value);markDirty()};inputs[2].onchange=()=>{item.loop=inputs[2].checked;markDirty()};
      card.querySelector('button').onclick=()=>{poolDraft.splice(index,1);markDirty();render()};root.append(card);
    });
    $('#poolCount').textContent=poolDraft.length+' alternative(s) · Save event to apply. Removing a card keeps its file in your library.';
  }
  $('#poolAdd').onclick=act(()=>add($('#poolLibrary').value));
  async function upload(files){
    if(poolDraft.length+files.length>30)throw Error('Maximum 30 alternatives.');
    for(const file of files){
      if(!/\.(webm|mp4|mov|png|jpg|jpeg|gif|webp|mp3|wav|ogg|m4a)$/i.test(file.name)||file.size>256*1024*1024)throw Error('Choose supported media files under 256 MB.');
      const r=await fetch('/upload?name='+encodeURIComponent(file.name),{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});const data=await r.json();if(!r.ok)throw Error(data.error||'Upload failed');
      settings.library=data.library;
      if(!section.isConnected){notice('File uploaded to library. Select the intended event to add it.');return}
      fillLibrary();add(data.path);
    }
    notice('Alternatives added. Save event to apply.');
  }
  const input=$('#poolUpload'),drop=$('#poolDrop');input.onchange=act(()=>upload([...input.files]));drop.onclick=()=>input.click();drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click()}};drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag-over')};drop.ondragleave=()=>drop.classList.remove('drag-over');drop.ondrop=async e=>{e.preventDefault();drop.classList.remove('drag-over');try{const path=e.dataTransfer.getData('application/x-league-asset');if(path){if(!settings.library.some(x=>x.path===path))throw Error('Choose a file from the library.');add(path)}else await upload([...e.dataTransfer.files])}catch(error){notice(error.message,true)}};
  $('#gain').addEventListener('input',()=>{for(const m of section.querySelectorAll('video,audio'))m.volume=Math.max(0,Math.min(1,Number($('#gain').value)/100))});
  fillLibrary();render();
}
const editBeforePool=edit;edit=function(...args){editBeforePool(...args);poolEditor()};
if(settings&&selected)poolEditor();
