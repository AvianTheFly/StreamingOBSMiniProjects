import {button,text} from './starting-soon-common.js';
const fields=['title','subtitle','show_message','show_footer','artwork','rotation_seconds','rotate_artwork','highlights_enabled','transition_style','motion','layout','custom_box'];
const uid=()=>crypto.randomUUID?.()||'look-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);

export function mountProduction(ctx){
 const host=ctx.$('ssProduction');
 host.innerHTML=`<section class="ss-card"><h2>What viewers see</h2><p class="ss-muted">Scenery fills the screen until you choose to play highlights.</p><label class="ss-check"><input id="ssHighlightSwitch" type="checkbox">Enable highlight overlay</label><div class="ss-row"><button id="ssSceneryOnly" class="ss-button">Scenery only</button><button id="ssWaitingRoom" class="ss-button">Waiting room & message</button></div><p id="ssProductionMode" class="ss-notice"></p></section>
 <section class="ss-card"><h2>Saved looks</h2><p class="ss-muted">Keep an opening, break or clean lobby look. Applying one never starts clips.</p><label>Choose look<select id="ssLookSelect"></select></label><div class="ss-row"><button id="ssLookPreview" class="ss-button">Preview</button><button id="ssLookApply" class="ss-button">Apply look</button><button id="ssLookSave" class="ss-button">Save current design as…</button><button id="ssLookDelete" class="ss-button">Delete look</button></div></section>`;
 const select=ctx.$('ssLookSelect'),toggle=ctx.$('ssHighlightSwitch');
 function render(){const selected=select.value;select.replaceChildren(new Option('Choose a saved look',''),...(ctx.config.saved_looks||[]).map(l=>new Option(l.name,l.id)));select.value=(ctx.config.saved_looks||[]).some(l=>l.id===selected)?selected:'';for(const id of ['ssLookPreview','ssLookApply','ssLookDelete'])ctx.$(id).disabled=!select.value;}
 function chosen(){const look=ctx.config.saved_looks.find(v=>v.id===select.value);if(!look)throw Error('Choose a saved look.');return look;}
 async function apply(patch,replace=false){const saved=await ctx.save(patch);ctx.live={...ctx.live,...saved};if(replace){ctx.refreshAppearance();ctx.saved('scene design');}else ctx.appearance.syncLive(patch);ctx.preview({...ctx.appearance.snapshot(),art:saved.artwork[0],demo:false});ctx.updateLive(ctx.live);}
 toggle.onchange=()=>ctx.perform(async()=>{toggle.disabled=true;try{const saved=await ctx.save({highlights_enabled:toggle.checked});ctx.live={...ctx.live,...saved};ctx.appearance.syncLive({highlights_enabled:saved.highlights_enabled});ctx.preview({highlights_enabled:saved.highlights_enabled,demo:false});update(saved);}finally{toggle.disabled=false;toggle.checked=ctx.live?.highlights_enabled??ctx.config.highlights_enabled??true;}});
 ctx.$('ssSceneryOnly').onclick=()=>ctx.perform(()=>apply({show_message:false,show_footer:false,highlights_enabled:false}));
 ctx.$('ssWaitingRoom').onclick=()=>ctx.perform(()=>apply({show_message:true,highlights_enabled:false}));
 select.onchange=render;
 ctx.$('ssLookPreview').onclick=()=>ctx.perform(()=>{const v=chosen().settings;ctx.preview({...v,art:v.artwork?.[0],demo:false});});
 ctx.$('ssLookApply').onclick=()=>ctx.perform(()=>apply(Object.fromEntries(Object.entries(chosen().settings).filter(([key])=>fields.includes(key))),true));
 ctx.$('ssLookSave').onclick=()=>ctx.perform(async()=>{const name=prompt('Name this look (for example: Midnight opening or Be right back)');if(!name?.trim())return;const source=ctx.appearance.snapshot(),look={id:uid(),name:name.trim(),settings:Object.fromEntries(fields.filter(key=>key in source).map(key=>[key,structuredClone(source[key])]))};await ctx.save({saved_looks:[...(ctx.config.saved_looks||[]),look]});render();select.value=look.id;render();});
 ctx.$('ssLookDelete').onclick=()=>ctx.perform(async()=>{const look=chosen();if(!confirm('Delete the saved look “'+look.name+'”?'))return;await ctx.save({saved_looks:ctx.config.saved_looks.filter(v=>v.id!==look.id)});render();});
 function update(s){toggle.checked=s.highlights_enabled??true;ctx.$('ssProductionMode').textContent=toggle.checked?'Highlights available · play a playlist when ready':'Scenery mode · highlight playback disabled';}
 render();update(ctx.config);return {update};
}
