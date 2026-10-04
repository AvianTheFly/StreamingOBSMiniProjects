// Asset authoring UI calls the shared library; OBS follows saved display choices.
const fields={main:'background',left:'leftScreen',right:'rightScreen',booth:'boothScreen'};
const textKeys=['title','subtitle','leftTitle','leftSubtitle','rightTitle','rightSubtitle'];
export class ScreenStudio {
  constructor(form,update){
    this.form=form;this.update=update;this.state=null;this.status=document.querySelector('#screen-status');
    document.querySelector('#screen-upload').addEventListener('change',e=>this.import(e.target));
    document.querySelector('#apply-screens').addEventListener('click',()=>this.apply());
    document.querySelector('#refresh-library').addEventListener('click',()=>this.load(false));
  }
  async request(path,options){const r=await fetch('/api/spirit-lobby'+path,options),data=await r.json();if(!r.ok)throw new Error(data.error||'Could not update the screens');return data;}
  async load(initial=true){
    try{const state=await this.request('');this.show(state,initial);this.status.textContent='Screen media is shared with OBS. Original files stay untouched.';}
    catch(e){this.status.textContent=e.message;}
  }
  show(state,initial=false){
    this.state=state;
    for(const [target,field] of Object.entries(fields)){
      const select=this.form.elements[field],value=initial?(new URLSearchParams(location.search).get(field)||state.selected[target]):select.value;
      select.replaceChildren();
      for(const asset of state.assets){
        if(target==='main'?asset.kind==='text':asset.kind==='program')continue;
        const option=document.createElement('option');option.value=asset.id;option.textContent=asset.name;select.append(option);
      }
      select.value=[...select.options].some(o=>o.value===value)?value:state.selected[target];
    }
    if(initial)for(const key of textKeys)if(typeof state.texts[key]==='string'&&!new URLSearchParams(location.search).has(key))this.form.elements[key].value=state.texts[key];
    document.querySelector('#screen-storage').textContent=state.storage;
    const list=document.querySelector('#screen-assets');list.replaceChildren();
    const imported=state.assets.filter(a=>a.kind==='image'||a.kind==='video');
    if(!imported.length){const empty=document.createElement('p');empty.textContent='Add art, GIFs or looping videos here. Pick a screen and choose a visual to preview it.';list.append(empty);}
    for(const asset of imported){
      const card=document.createElement('article'),preview=document.createElement(asset.kind==='image'?'img':'div');
      if(asset.kind==='image'){preview.src=asset.url;preview.alt='';preview.loading='lazy';}else{preview.className='video-badge';preview.textContent='VIDEO';}
      const title=document.createElement('p');title.textContent=asset.name;
      const use=document.createElement('button');use.type='button';use.textContent='Use on selected screen';
      use.addEventListener('click',()=>{const target=document.querySelector('#screen-target').value;this.form.elements[fields[target]].value=asset.id;this.update();this.status.textContent='Preview updated. Apply screens to use this in OBS.';});
      const remove=document.createElement('button');remove.type='button';remove.textContent='Remove from library';remove.className='quiet';
      remove.addEventListener('click',async()=>{try{const state=await this.request('/remove',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:asset.id})});this.show(state);this.status.textContent='Removed from the library. Original and imported files were preserved.';}catch(e){this.status.textContent=e.message;}});
      card.append(preview,title,use,remove);list.append(card);
    }this.update();
  }
  async import(input){
    const file=input.files[0];if(!file)return;input.disabled=true;
    try{
      if(file.size>(this.state?.maxBytes||80*1024*1024))throw new Error('Choose a file up to 80 MB.');
      this.status.textContent='Adding '+file.name+'…';
      const state=await this.request('/import?name='+encodeURIComponent(file.name),{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});
      this.show(state);this.form.elements[fields[document.querySelector('#screen-target').value]].value=state.imported;this.update();
      this.status.textContent='Added and previewing. Apply screens to show it in OBS.';
    }catch(e){this.status.textContent=e.message;}finally{input.disabled=false;input.value='';}
  }
  async apply(){
    const button=document.querySelector('#apply-screens');button.disabled=true;
    try{
      const selected=Object.fromEntries(Object.entries(fields).map(([target,name])=>[target,this.form.elements[name].value]));
      const texts=Object.fromEntries(textKeys.map(name=>[name,this.form.elements[name].value]));
      await this.request('/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({selected,texts})});
      this.status.textContent='Saved. Active OBS screens update within five seconds; hidden screens update when opened.';
    }catch(e){this.status.textContent=e.message;}finally{button.disabled=false;}
  }
}
