// Presentation controls share the event editor's revision checks and media library.
let layoutDraft=false, layoutDrawing=false;
const layoutKeys=['x','y','width','height'];
function layoutValues(){return Object.fromEntries(layoutKeys.map(k=>[k,Number($('#layout_'+k).value)]))}
function setLayout(l){for(const k of layoutKeys)$('#layout_'+k).value=Math.round(l[k]);drawLayout()}
function drawLayout(){layoutDrawing=true;const l=layoutValues(),b=$('#layoutBox');Object.assign(b.style,{left:l.x/19.2+'%',top:l.y/10.8+'%',width:l.width/19.2+'%',height:l.height/10.8+'%'});requestAnimationFrame(()=>layoutDrawing=false)}
function showPresentation(){if(!settings)return;const c=settings.config;$('#overlayToggle').textContent=c.overlay_enabled===false?'League alerts: OFF · turn on':'League alerts: ON · turn off';$('#overlayToggle').setAttribute('aria-pressed',String(c.overlay_enabled!==false));$('#presentation').value=c.presentation||'memes';$('#presentationStatus').textContent='Active: '+(c.presentation==='personal'?'My setup':'Meme pack')+' · edits are saved separately';if(!layoutDraft)setLayout(c.layout||{x:1305,y:86,width:557,height:248})}
const loadBeforePresentation=load;load=async function(){await loadBeforePresentation();showPresentation()};
$('#overlayToggle').onclick=act(async()=>{settings=await req('/options',{revision:settings.config.revision,overlay_enabled:settings.config.overlay_enabled===false});showPresentation();notice(settings.config.overlay_enabled?'League alerts on.':'League alerts off. All playing League media stopped.')});
$('#presentation').onchange=act(async()=>{const target=$('#presentation').value;if(dirty||layoutDraft){showPresentation();throw Error('Save or discard your event and layout edits before switching setups.')}settings=await req('/options',{revision:settings.config.revision,presentation:target});showPresentation();if(selected)edit(selected);notice('Switched setup. Your previous media and layout are retained; volumes are unchanged.')});
for(const k of layoutKeys)$('#layout_'+k).oninput=()=>{layoutDraft=true;drawLayout()};
$('#layoutSave').onclick=act(async()=>{settings=await req('/options',{revision:settings.config.revision,layout:layoutValues()});layoutDraft=false;showPresentation();notice('Size and position saved for this setup.')});
$('#layoutUndo').onclick=()=>{layoutDraft=false;showPresentation()};
$('#layoutFull').onclick=()=>{layoutDraft=true;setLayout({x:0,y:0,width:1920,height:1080})};
const box=$('#layoutBox'),canvas=$('#layoutCanvas');let dragging=null;
box.onpointerdown=e=>{const r=box.getBoundingClientRect();if(e.clientX>r.right-20&&e.clientY>r.bottom-20)return;dragging={x:e.clientX,y:e.clientY,l:layoutValues()};box.setPointerCapture(e.pointerId)};
box.onpointermove=e=>{if(!dragging)return;const scale=1920/canvas.clientWidth,l=dragging.l;layoutDraft=true;setLayout({...l,x:Math.max(0,Math.min(1920-l.width,l.x+(e.clientX-dragging.x)*scale)),y:Math.max(0,Math.min(1080-l.height,l.y+(e.clientY-dragging.y)*scale))})};
box.onpointerup=box.onpointercancel=()=>dragging=null;
new ResizeObserver(()=>{if(layoutDrawing||!settings)return;const l=layoutValues(),w=Math.round(box.offsetWidth/canvas.clientWidth*1920),h=Math.round(box.offsetHeight/canvas.clientHeight*1080);if(Math.abs(w-l.width)<5&&Math.abs(h-l.height)<5)return;layoutDraft=true;$('#layout_width').value=Math.min(1920-l.x,Math.max(32,w));$('#layout_height').value=Math.min(1080-l.y,Math.max(32,h))}).observe(box);
window.addEventListener('beforeunload',e=>{if(layoutDraft){e.preventDefault();e.returnValue=''}});
function companionEditor(){const rule=settings.config.events[selected]||{},section=document.createElement('section');section.innerHTML='<h3>Optional companion sound</h3><p class="muted">Play a sound alongside this visual, using the event clip volume and OBS master fader. Sound stops when the alert ends. Choose No companion sound to remove it.</p><select id="companionAudio" aria-label="Companion sound"></select><label for="audioUpload">Add audio (MP3, WAV, OGG, M4A)</label><input id="audioUpload" type="file" accept=".mp3,.wav,.ogg,.m4a"><audio id="audioPreview" controls preload="none"></audio>';
$('#mediaPreview').after(section);
const fill=value=>{$('#companionAudio').innerHTML='<option value="">No companion sound</option>'+options(settings.library.filter(a=>/\.(mp3|wav|ogg|m4a)$/i.test(a.path)).map(a=>[a.path,a.name]),value);if(value&&!Array.from($('#companionAudio').options).some(o=>o.value===value))$('#companionAudio').add(new Option(value,value,true,true));preview()};
const preview=()=>{const a=$('#audioPreview'),path=$('#companionAudio').value;a.pause();a.hidden=!path;if(path)a.src='/asset?path='+encodeURIComponent(path);else a.removeAttribute('src')};
$('#companionAudio').onchange=()=>{markDirty();preview()};
$('#audioUpload').onchange=act(async()=>{const f=$('#audioUpload').files[0],key=selected;if(!f)return;if(f.size>256*1024*1024)throw Error('File exceeds 256 MB');const r=await fetch('/upload?name='+encodeURIComponent(f.name),{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:f}),data=await r.json();if(!r.ok)throw Error(data.error);settings.library=data.library;if(key!==selected){notice('Audio uploaded to library. Choose the intended event to assign it.');return}fill(data.path);markDirty();notice('Audio ready. Save event to apply.')});fill(rule.audio||'')}
const editBeforeCompanion=edit;edit=function(...args){editBeforeCompanion(...args);companionEditor()};
if(settings){showPresentation();if(selected)companionEditor()}
