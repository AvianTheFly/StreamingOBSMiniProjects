import {worlds,loadWorld} from './worlds.js';
const preview=document.querySelector('#preview'),picker=document.querySelector('#world'),send=data=>preview.contentWindow.postMessage({type:'living-lobby',...data},location.origin);let paused=false,revision=0;
for(const world of worlds){const option=document.createElement('option');option.value=world.id;option.textContent=world.label;picker.append(option);}
async function choose(id){
 const intent=++revision,world=await loadWorld(id);if(intent!==revision)return;
 picker.value=id;paused=false;document.querySelector('#auto').checked=true;document.querySelector('#pause').textContent='Pause motion';document.querySelector('#pause').setAttribute('aria-pressed','false');
 document.title=world.label+' · Living lobby';document.querySelector('h1').textContent=world.title;document.querySelector('#intro').textContent='The original '+world.label+' painting, with a little life of its own.';document.querySelector('#description').textContent=world.description;
 document.querySelector('#status').textContent='Visitors arrive on their own.';document.querySelector('footer').textContent='The original painting and your stream layout are preserved. Each world has its own motion and surprises.';
 document.querySelector('#fullscreen').href='index.html?preview=1&world='+id;preview.title='Animated '+world.label;
 const list=document.querySelector('#cues');list.replaceChildren();for(const spec of world.cues){const button=document.createElement('button');button.type='button';button.dataset.cue=spec.id;button.append(document.createTextNode(spec.label));const description=document.createElement('span');description.textContent=spec.description;button.append(description);button.addEventListener('click',()=>send({cue:spec.id,id:crypto.randomUUID()}));list.append(button);}
 preview.src='index.html?preview=1&world='+id;const url=new URL(location.href);url.searchParams.set('world',id);history.replaceState(null,'',url);
}
picker.addEventListener('change',()=>choose(picker.value));
document.querySelector('#auto').addEventListener('change',e=>{send({automatic:e.target.checked});document.querySelector('#status').textContent=e.target.checked?'Visitors arrive on their own.':'Current visitors finish; the world keeps moving.';});
document.querySelector('#pause').addEventListener('click',e=>{paused=!paused;send({paused});e.currentTarget.textContent=paused?'Resume motion':'Pause motion';e.currentTarget.setAttribute('aria-pressed',String(paused));});
const selected=new URLSearchParams(location.search).get('world');await choose(worlds.some(w=>w.id===selected)?selected:'reef');
