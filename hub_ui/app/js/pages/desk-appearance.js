// A focused appearance chooser. Browsing never changes the stream or saved selection.
import {api} from '../api.js';
import {esc} from '../utils.js';
export function mountStageAppearance(root,onSaved){
  const dialog=document.createElement('dialog');dialog.className='stage-appearance-dialog';
  dialog.innerHTML='<header><h2 id="appearanceTitle">Change image</h2><button class="btn btn-secondary" data-close>Cancel</button></header><div class="stage-image-grid"></div><footer><label class="btn btn-secondary" id="stageUploadLabel">Upload image<input id="stageUpload" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><span role="status" id="appearanceMessage"></span><button class="btn btn-primary" id="useStageImage" disabled>Use image</button></footer>';
  dialog.setAttribute('aria-labelledby','appearanceTitle');root.append(dialog);
  const get=s=>dialog.querySelector(s),grid=get('.stage-image-grid'),use=get('#useStageImage'),upload=get('#stageUpload');
  let generation=0,disposed=false,stage='',data=null,items=[],chosen='',opener=null,busy=false;
  function paint(){
    grid.replaceChildren(...items.map(item=>{const b=document.createElement('button');b.className='stage-image-option';b.dataset.image=item.id;b.setAttribute('aria-pressed',String(item.id===chosen));b.disabled=busy;b.innerHTML=`<img src="${esc(item.url)}" alt="" loading="lazy"><span>${esc(item.title)}</span>`;b.onclick=()=>{chosen=item.id;paint();};return b;}));
    use.disabled=busy||!chosen;upload.disabled=busy;get('[data-close]').disabled=busy;
  }
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  dialog.addEventListener('close',()=>{generation++;if(!disposed)opener?.focus();});
  get('[data-close]').onclick=()=>dialog.close();
  function images(catalog){return catalog.images.map(i=>({id:i.id,title:i.title,url:i.image_url}));}
  async function open(kind,button,context){
    const token=++generation;stage=kind;opener=button;chosen='';items=[];busy=false;data=null;
    get('#appearanceTitle').textContent=['lobby','ending'].includes(stage)?'Choose lobby':stage==='draft'?'Champion select appearance':'Change image';
    get('#stageUploadLabel').hidden=stage!=='loading';get('#appearanceMessage').textContent='Loading images…';use.textContent=['lobby','ending'].includes(stage)?'Use lobby':'Use image';paint();dialog.showModal();
    try{
      if(stage==='loading'){data=await api.getStageAppearance();if(token!==generation||disposed)return;items=images(data);chosen=data.selected;}
      else if(stage==='starting'){data=await api.getStartingScreen();if(token!==generation||disposed)return;items=(data.artwork_catalog||[]).map(i=>({id:i.file,title:i.title,url:'/starting-soon/art/'+encodeURIComponent(i.file)}));chosen=data.artwork?.[data.artwork_index||0];}
      else if(stage==='draft'){const selected=context.projects?.find(p=>p.name==='league_api')?.workflow?.draft_theme;items=['bear','turtle','ram','phoenix'].map(id=>({id,title:id[0].toUpperCase()+id.slice(1),url:'http://127.0.0.1:7431/champ-select/backgrounds/'+id+'.jpg'}));chosen=selected;}
      else {data=await api.getLobbyCatalog();if(token!==generation||disposed)return;items=(data.locations||[]).map(i=>({id:i.source,title:i.label||i.source,url:i.art_url}));chosen=context[stage+'Choice']||context.lobbyData?.selection?.source;}
      get('#appearanceMessage').textContent=stage==='loading'?'PNG, JPEG or WebP · up to 12 MB':'';paint();
    }catch(error){if(token===generation&&!disposed)get('#appearanceMessage').textContent=error.message;}
  }
  upload.onchange=async()=>{
    const file=upload.files?.[0],token=generation;if(!file)return;
    if(file.size>12*1024*1024){get('#appearanceMessage').textContent='Choose an image under 12 MB';upload.value='';return;}
    busy=true;paint();get('#appearanceMessage').textContent='Uploading…';
    try{const result=await api.uploadStageImage(file);if(disposed||generation!==token)return;data=result;items=images(data);chosen=data.uploaded;get('#appearanceMessage').textContent='Uploaded · choose Use image to apply';}
    catch(error){if(!disposed&&generation===token)get('#appearanceMessage').textContent=error.message;}
    finally{busy=false;if(!disposed&&generation===token){upload.value='';paint();}}
  };
  use.onclick=async()=>{
    if(busy||!chosen)return;busy=true;paint();get('#appearanceMessage').textContent='Saving…';const token=generation;
    try{
      let result;
      if(stage==='loading')result=await api.selectStageImage(chosen,data.revision);
      else if(stage==='draft')result=await api.setDraftTheme(chosen);
      else if(stage==='lobby')result=await api.setLobbySelection('fixed',chosen);
      else if(stage==='starting'){
        const fresh=await api.getStartingScreen();
        if(!fresh.artwork.includes(chosen))await api.saveStartingScreen({artwork:[...fresh.artwork,chosen],revision:fresh.revision});
        result=await api.startingScreenAction('set-art',{file:chosen});
      }
      if(result?.error||result?.ok===false)throw Error(result.error||'Could not save image');
      if(!disposed&&token===generation){onSaved(stage,chosen,result,items.find(i=>i.id===chosen));dialog.close();}
    }catch(error){if(!disposed&&token===generation)get('#appearanceMessage').textContent=error.message;}
    finally{busy=false;if(!disposed&&token===generation)paint();}
  };
  return {open,dispose(){disposed=true;generation++;dialog.remove();}};
}
