// Preview controls encode a reusable URL; no personal settings or OBS APIs.
import {readConfig} from './config.js';
import {ScreenStudio} from './screen-studio.js';
import {PartyStudio} from './party-studio.js';
const form=document.querySelector('#controls'),preview=document.querySelector('#preview'),url=document.querySelector('#url');
let paused=false;
const initial=readConfig();if(initial.quality==='high')initial.quality='standard';
for(const name of ['mode','party','title','subtitle','energy','palette','background','speed','quality','penguinOpacity','leftTitle','leftSubtitle','rightTitle','rightSubtitle'])form.elements[name].value=initial[name];
function update(){
  const params=new URLSearchParams(new FormData(form));const link=new URL('index.html',location.href);link.search=params.toString();
  document.querySelector('#open').href=link.href;
  // OBS links follow shared display choices, so future asset/text edits need
  // only Apply screens. The full-screen preview still shows unsaved choices.
  for(const name of ['background','leftScreen','rightScreen','boothScreen','title','subtitle','leftTitle','leftSubtitle','rightTitle','rightSubtitle'])link.searchParams.delete(name);
  link.searchParams.set('layer','background');url.value=link.href;
  link.searchParams.set('layer','foreground');document.querySelector('#foreground-url').value=link.href;
  params.set('cameraGuide','1');
  document.querySelector('#energy-value').value=Math.round(Number(form.elements.energy.value)*100)+'%';
  document.querySelector('#opacity-value').value=Math.round(Number(form.elements.penguinOpacity.value)*100)+'%';
  document.querySelector('#speed-value').value=Number(form.elements.speed.value).toFixed(2).replace(/0+$/,'').replace(/\.$/,'')+'×';
  if(paused)params.set('paused','1');
  preview.contentWindow.postMessage({type:'spirit-lobby',query:params.toString()},location.origin);
}
form.addEventListener('submit',e=>e.preventDefault());
form.addEventListener('input',update);
form.elements.mode.addEventListener('change',()=>{
  const defaults=readConfig('?mode='+form.elements.mode.value);form.elements.title.value=defaults.title;form.elements.subtitle.value=defaults.subtitle;update();
});
preview.addEventListener('load',update);
document.querySelector('#pause').addEventListener('click',e=>{paused=!paused;e.currentTarget.textContent=paused?'Resume motion':'Pause motion';e.currentTarget.setAttribute('aria-pressed',String(paused));update();});
const partyStudio=new PartyStudio(preview);partyStudio.load();
document.querySelector('#copy').addEventListener('click',async()=>{
  const feedback=document.querySelector('#feedback');try{await navigator.clipboard.writeText(url.value);feedback.textContent='Copied. Paste into your OBS browser source.';}catch{url.focus();url.select();feedback.textContent='Press Ctrl+C to copy the selected link.';}
});
update();
const screenStudio=new ScreenStudio(form,update);screenStudio.load();

document.querySelector('#copy-front').addEventListener('click',async()=>{const field=document.querySelector('#foreground-url');try{await navigator.clipboard.writeText(field.value);document.querySelector('#feedback').textContent='Foreground link copied.';}catch{field.focus();field.select();}});
