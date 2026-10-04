import {button,text,bind,titleOf} from './starting-soon-common.js';

export function mountAppearance(ctx){
 const draft={title:ctx.config.title,subtitle:ctx.config.subtitle,show_message:ctx.config.show_message??true,show_footer:ctx.config.show_footer??true,highlights_enabled:ctx.config.highlights_enabled??true,transition_style:ctx.config.transition_style??'dissolve',motion:ctx.config.motion??'still',artwork:[...ctx.config.artwork],rotation_seconds:ctx.config.rotation_seconds,rotate_artwork:ctx.config.rotate_artwork,layout:ctx.config.layout,custom_box:{...ctx.config.custom_box}};
 const names={preserve:'Keep current OBS placement',right:'Right stage',left:'Left stage',cinema:'Cinema · larger central clip',corner:'Scenery + corner clip',custom:'Custom 16:9 placement'};
 ctx.$('ssArtPanel').innerHTML=`<section class="ss-card"><div class="ss-previewbar"><div><h2>Choose your worlds</h2><p class="ss-muted">Preview any background. Checked worlds rotate in the numbered order.</p></div><button id="ssAllArt" class="ss-button">Include all</button></div><div id="ssArtGrid" class="ss-art-grid"></div></section>
 <section class="ss-card"><h2>Message & clip placement</h2><label class="ss-check"><input id="ssShowMessage" type="checkbox">Show Starting Soon message</label><label>Heading<input id="ssTitle" maxlength="180"></label><label>Subheading<input id="ssSubtitle" maxlength="180"></label><label class="ss-check"><input id="ssShowFooter" type="checkbox">Show scenery caption & rotation dots</label><div class="ss-fields"><label>Seconds per world<input id="ssSeconds" type="number" min="10" max="600"></label><label class="ss-check"><input id="ssRotate" type="checkbox">Rotate artwork</label></div><h3 style="margin-top:20px">Default clip window</h3><div id="ssDefaultPlacement"></div><p class="ss-muted">Per-clip placements take priority. Changes preview privately until you save. The native OBS source and frame move together.</p><button id="ssSaveAppearance" class="ss-button primary">Save scene design</button><div id="ssPlacementNotice" class="ss-notice"></div></section>
 <section class="ss-card ss-reuse"><h2>Reuse the art & message</h2><p class="ss-muted">Every original PNG is free of text. Open a clean PNG below any artwork, or use these independent browser layers in another OBS scene at 1920 × 1080. Both follow this editor; the text layer follows the Show Starting Soon message switch.</p><div id="ssLayerLinks"></div></section>`;
 ctx.$('ssTitle').value=draft.title;ctx.$('ssSubtitle').value=draft.subtitle;ctx.$('ssSeconds').value=draft.rotation_seconds;ctx.$('ssRotate').checked=draft.rotate_artwork;
 const motionControls=document.createElement('div');motionControls.className='ss-fields';
 motionControls.innerHTML=`<label>Artwork transition<select id="ssTransitionStyle"><option value="dissolve">Cinematic dissolve</option><option value="portal">Celestial aperture</option><option value="gates">Stormglass gates</option><option value="embers">Ember sweep</option></select></label><label>Scenery motion<select id="ssWorldMotion"><option value="still">Still painting</option><option value="drift">Gentle camera drift</option></select></label>`;
 ctx.$('ssDefaultPlacement').parentElement.insertBefore(motionControls,ctx.$('ssDefaultPlacement').previousElementSibling);
 const nextTransition=button('Preview next transition',()=>{const art=draft.artwork.length>1?draft.artwork:ctx.config.artwork_catalog.map(a=>a.file);ctx.preview({...draft,art:art[(++previewIndex)%art.length],demo:false});});let previewIndex=0;nextTransition.id='ssPreviewTransition';motionControls.append(nextTransition);
 ctx.$('ssTransitionStyle').value=draft.transition_style;ctx.$('ssWorldMotion').value=draft.motion;
 ctx.$('ssShowMessage').checked=draft.show_message;ctx.$('ssShowFooter').checked=draft.show_footer;
 for(const [mode,labelText] of [['artwork','Artwork only · no text or clip frame'],['message','Message only · transparent background'],['frame','Highlight frame only · transparent background']]){
  const url=new URL('/starting-soon/overlay.html',location.origin);url.searchParams.set('layer',mode);
  const label=text('label',labelText),input=document.createElement('input');input.readOnly=true;input.value=url.href;input.addEventListener('click',()=>input.select());label.append(input);
  const link=text('a','Open layer preview','ss-button');link.href=url.href;link.target='_blank';link.rel='noopener';ctx.$('ssLayerLinks').append(label,link);
 }
 function geometry(value){if(value.layout==='custom')return [Number(value.custom_box.x),Number(value.custom_box.y),Number(value.custom_box.width),Number(value.custom_box.width)*9/16];return ctx.config.layout_catalog?.[value.layout]?.box||ctx.live?.clip_box||[690,320,1144,643.5];}
 function placementEditor(host,value,change,inherit=false){
  host.replaceChildren();const label=text('label','Placement'),select=document.createElement('select');
  for(const [key,name] of Object.entries(inherit?{inherit:'Use scene default',...names}:names)){const o=document.createElement('option');o.value=key;o.textContent=name;select.append(o);}select.value=value.layout;label.append(select);host.append(label);
  const fields=text('div','','ss-layout-fields'),inputs={};for(const key of ['x','y','width']){const l=text('label',key==='width'?'Width (height follows 16:9)':key.toUpperCase()+' position');const input=document.createElement('input');input.type='number';input.step='1';input.value=value.custom_box?.[key]??({x:690,y:320,width:1144}[key]);l.append(input);fields.append(l);inputs[key]=input;}host.append(fields);
  const hint=text('p','1920 × 1080 design coordinates. Keep x ≥ 24, y ≥ 190, and the right/bottom edges inside 1896 / 1004.','ss-muted');host.append(hint);
  function update(){value.layout=select.value;value.custom_box=Object.fromEntries(Object.entries(inputs).map(([k,v])=>[k,Number(v.value)]));fields.hidden=hint.hidden=value.layout!=='custom';change({...value,custom_box:{...value.custom_box}});}
  select.onchange=update;for(const input of Object.values(inputs))input.oninput=update;fields.hidden=hint.hidden=value.layout!=='custom';
  return {choose:layout=>{select.value=layout;update();}};
 }
 const editor=placementEditor(ctx.$('ssDefaultPlacement'),draft,value=>{Object.assign(draft,value);ctx.changed('scene design');ctx.preview({clip_box:geometry(draft)});});
 for(const [id,key] of [['ssTitle','title'],['ssSubtitle','subtitle'],['ssSeconds','rotation_seconds'],['ssRotate','rotate_artwork'],['ssShowMessage','show_message'],['ssShowFooter','show_footer'],['ssTransitionStyle','transition_style'],['ssWorldMotion','motion']]){
  const input=ctx.$(id),check=input.type==='checkbox';input.addEventListener(check||input.tagName==='SELECT'?'change':'input',()=>{draft[key]=check?input.checked:id==='ssSeconds'?Number(input.value):input.value;ctx.changed('scene design');ctx.preview({title:draft.title,subtitle:draft.subtitle,show_message:draft.show_message,show_footer:draft.show_footer,transition_style:draft.transition_style,motion:draft.motion});});
 }
 function renderArt(){ctx.$('ssArtGrid').replaceChildren(...ctx.config.artwork_catalog.map(art=>{
  const card=text('article','','ss-art'+(draft.artwork.includes(art.file)?' selected':'')),img=document.createElement('img');img.src='/starting-soon/art/'+encodeURIComponent(art.file);img.alt=art.title;img.loading='lazy';card.append(img);
  const copy=text('div','','ss-art-copy'),label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=draft.artwork.includes(art.file);check.setAttribute('aria-label','Include '+art.title);check.onchange=()=>{draft.artwork=check.checked?[...draft.artwork,art.file]:draft.artwork.filter(f=>f!==art.file);ctx.changed('scene design');renderArt();};label.className='ss-check';label.append(check,text('strong',art.title));copy.append(label,text('p',art.mood,'ss-muted'));const index=draft.artwork.indexOf(art.file);if(index>=0)copy.append(text('span','Rotation '+(index+1),'ss-badge'));
  const controls=text('div','','ss-row');controls.append(button('Preview',()=>{ctx.preview({art:art.file,clip_box:geometry(draft)});ctx.$('ssPlacementNotice').textContent='Previewing '+art.title+'. Suggested clip side: '+art.recommended_layout+'.';}),button('Show now',()=>ctx.perform(()=>ctx.action('set-art',{file:art.file}))));
  controls.append(button('Use '+art.recommended_layout+' layout',()=>{editor.choose(art.recommended_layout);ctx.preview({art:art.file,clip_box:geometry(draft)});}));
  const clean=text('a','Open clean PNG','ss-button');clean.href=img.src;clean.target='_blank';clean.rel='noopener';controls.append(clean);
  if(index>=0)for(const [symbol,d] of [['←',-1],['→',1]])controls.append(button(symbol,()=>{[draft.artwork[index],draft.artwork[index+d]]=[draft.artwork[index+d],draft.artwork[index]];ctx.changed('scene design');renderArt();},{disabled:index+d<0||index+d>=draft.artwork.length,title:'Change rotation order'}));
  copy.append(controls);card.append(copy);return card;
 }));}
 bind(ctx,'ssAllArt',()=>{draft.artwork=ctx.config.artwork_catalog.map(a=>a.file);ctx.changed('scene design');renderArt();});
 bind(ctx,'ssSaveAppearance',async()=>{await ctx.save(draft);ctx.saved('scene design');ctx.$('ssPlacementNotice').textContent='Saved. Clip-specific placements still take priority.';});
 function clipPlacement(path,host){
  host.replaceChildren(text('h3','Placement for this clip'));const value=structuredClone(ctx.config.clip_layouts[path]||{layout:'inherit',custom_box:ctx.config.custom_box});const area=document.createElement('div');host.append(area);
  placementEditor(area,value,v=>Object.assign(value,v),true);
  const notice=text('p','This setting belongs to '+titleOf(ctx,path)+'.','ss-muted');host.append(notice);
  host.append(button('Save this clip’s placement',()=>ctx.perform(async()=>{const map=structuredClone(ctx.config.clip_layouts);if(value.layout==='inherit')delete map[path];else map[path]=value;await ctx.save({clip_layouts:map});notice.textContent='Clip placement saved.';})),button('Preview placement',()=>{const effective=value.layout==='inherit'?draft:value;ctx.preview({clip_box:geometry(effective)});ctx.$('ssClipDialog').close();}));
 }
 function syncVisibility(saved){draft.show_message=saved.show_message;ctx.$('ssShowMessage').checked=draft.show_message;}
 function syncLive(saved){for(const [key,id] of [['show_message','ssShowMessage'],['show_footer','ssShowFooter'],['highlights_enabled',null]])if(key in saved){draft[key]=saved[key];if(id)ctx.$(id).checked=saved[key];}}
 renderArt();return {clipPlacement,syncVisibility,syncLive,snapshot:()=>structuredClone(draft)};
}
