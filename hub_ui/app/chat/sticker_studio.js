// Catalog browser: only visible thumbnails animate; offscreen rows release playback.
import {safeImage} from './protocol.js';
const list=document.querySelector('#sticker-list'),search=document.querySelector('#sticker-search'),filter=document.querySelector('#sticker-category'),more=document.querySelector('#sticker-more');
let replacements={},emotes={},aliases={},signature='',visibleLimit=60;
const observer=new IntersectionObserver(entries=>{
 for(const {target,isIntersecting} of entries){target.dataset.visible=String(isIntersecting);if(isIntersecting&&!document.hidden){if(target.getAttribute('src')!==target.dataset.animation)target.src=target.dataset.animation;}else target.removeAttribute('src');}
},{threshold:.01});
document.addEventListener('visibilitychange',()=>{for(const img of list.querySelectorAll('img')){if(!document.hidden&&img.dataset.visible==='true')img.src=img.dataset.animation;else img.removeAttribute('src');}});
function draw(){
 const query=search.value.toLowerCase().trim(),groups=new Map();
 const add=(code,url,asset={})=>{if(!safeImage(url))return;if(!groups.has(url))groups.set(url,{codes:[],...asset,url});groups.get(url).codes.push(code);};
 for(const [code,asset] of Object.entries(emotes)){if(Object.hasOwn(replacements,code))continue;add(code,asset.url,asset);}
 for(const [code,url] of Object.entries({...aliases,...replacements}))add(code,url,{provider:'Custom phrases',category:'Custom phrases'});
 observer.disconnect();list.replaceChildren();
 const matches=[...groups.values()].filter(group=>(!query||group.codes.some(code=>code.toLowerCase().includes(query)))&&(!filter.value||group.category===filter.value));
 for(const group of matches.slice(0,visibleLimit)){
  const row=document.createElement('button');row.type='button';row.className='sticker-entry';
  const img=document.createElement('img');img.dataset.animation=group.url;img.alt='';img.loading='lazy';img.onerror=()=>{if(img.hasAttribute('src')){observer.unobserve(img);img.remove();}};
  const label=document.createElement('span');label.textContent=group.codes.join(' · ');
  const meta=document.createElement('small');meta.textContent=(group.animated?'Animated · ':'')+(group.category||group.provider||'Custom');label.append(document.createElement('br'),meta);
  row.title='Preview '+group.codes[0];row.append(img,label);list.append(row);
  observer.observe(img);
  const preview=()=>{document.querySelector('#test-message').value=group.codes[0];document.querySelector('#test-sticker').click();};
  row.onclick=preview;row.onpointerenter=preview;row.onfocus=preview;
 }
 if(!matches.length)list.textContent=query?'No matching stickers.':'No stickers in this category.';
 more.hidden=matches.length<=visibleLimit;
 document.querySelector('#sticker-count').textContent=[...groups.values()].reduce((n,g)=>n+g.codes.length,0)+' codes & phrases · '+groups.size+' stickers';
 document.querySelector('#sticker-shown').textContent=Math.min(visibleLimit,matches.length)+' of '+matches.length+' matches · visible stickers animate; hover for a larger preview';
}
export function updateDictionary(value){
 const next=JSON.stringify(value);if(next===signature)return;
 signature=next;replacements=value;draw();
}
export function updateCatalog(value,phrases){emotes=value;aliases=phrases;draw();}
search.addEventListener('input',()=>{visibleLimit=60;draw();});
filter.addEventListener('change',()=>{visibleLimit=60;draw();});
more.onclick=()=>{visibleLimit+=60;draw();};
