import {objectiveName,objectiveIcon,icon} from './postgame-stories.js';
import {highlights,tempo,combat,economy,vision} from './postgame-analysis.js';
const el=id=>document.getElementById(id);
export const time=v=>Number.isFinite(v)?`${Math.floor(v/60)}:${String(Math.floor(v%60)).padStart(2,'0')}`:'—';
const num=(v,d=0)=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d}):'—';
const short=v=>Number.isFinite(v)&&v>=1000?num(v/1000,1)+'k':num(v);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let catalog={champions:{},items:{}};
export async function loadArt(){try{const r=await fetch('art/catalog.json');if(r.ok)catalog=await r.json();}catch{/* Text alternatives remain available offline. */}}
function art(kind,id,name,cls=''){const c=catalog[kind]?.[id]||Object.values(catalog[kind]||{}).find(c=>c.name===name);return c?`<img class="art ${cls}" src="${esc(c.local||c.image)}" alt="${esc(name||c.name)}" title="${esc(name||c.name)}">`:`<span class="art ${cls}" title="${esc(name)}">${esc((name||'?').slice(0,2))}</span>`;}
const metric=(label,value)=>`<div class="score"><strong>${value}</strong><small>${label}</small></div>`;
const labels={damage_share_pct:'Team damage %',damage_taken:'Damage taken',damage_mitigated:'Damage blocked',healing:'Healing',healing_allies:'Ally healing',shielding_allies:'Ally shielding',cc_seconds:'CC · seconds',dead_seconds:'Dead · seconds',q_casts:'Q casts',w_casts:'W casts',e_casts:'E casts',r_casts:'R casts'};
const detail=([k,v])=>`<div class="detail-stat"><span title="${esc(labels[k]||k.replaceAll('_',' '))}">${esc(labels[k]||k.replaceAll('_',' '))}</span><b>${num(v,Number.isInteger(v)?0:1)}</b></div>`;
const quiet=t=>`<div class="quiet">${t}</div>`;
export function renderReport(s){const r=s.match,m=r.metrics||{},l=s.lifetime;
 el('chronicle').classList.toggle('loss',r.win===false);
 const champion=catalog.champions?.[r.champion_id];el('backdrop').style.backgroundImage=champion?.splash?`url("${champion.splash}")`:'';
 el('portrait').innerHTML=art('champions',r.champion_id,r.champion,'portrait');
 el('identity').textContent=r.champion||'Match recap';el('role').textContent=r.role||'';el('duration').textContent=time(r.duration);el('outcome').textContent=r.win==null?'Partial':'◆';el('outcome').setAttribute('aria-label',r.win===true?'Win':r.win===false?'Loss':'Partial capture');
 el('kda').innerHTML=`${num(m.kills)} <span class="deaths">/ ${num(m.deaths)}</span> / ${num(m.assists)}`;
 el('scoreline').innerHTML=metric('Kill participation',Number.isFinite(m.kill_participation)?num(m.kill_participation)+'%':'—')+metric('CS / min',num(m.cs_per_minute,1))+metric('Champion damage',short(m.damage_champions))+metric('Gold earned',short(m.gold_earned))+metric('Vision score',num(m.vision_score));
 el('items').innerHTML=(r.items||[]).slice(0,7).map(i=>art('items',i.id,i.name)).join('')||'<span class="quiet">Inventory unavailable</span>';
 el('lifetime').innerHTML=`<small>${num(l.games)} RECORDED GAMES ↗</small>${num(l.wins)} W <span style="color:var(--muted)">/ ${num(l.losses)} L</span> · ${num(l.win_rate)}%`;
 el('coverage').textContent=(s.coverage||'')+' · — unavailable';
 el('fullStats').innerHTML=Object.entries(m).sort(([a],[b])=>a.localeCompare(b)).map(detail).join('');
 el('fullEvents').innerHTML=(s.events||[]).map(eventHTML).join('')||quiet('No timeline captured');
}
function build(s,cycle){const v=s.visuals||{},p=v.build||[],skills=v.skills||[],pages=Math.max(1,Math.ceil(p.length/10),Math.ceil(skills.length/18)),page=cycle%pages,skillPage=cycle%Math.max(1,Math.ceil(skills.length/18));
 return `<div class="panel"><div class="build-head"><h2>${v.exact_build?'Purchase order':'First observed items'} · ${page+1}/${pages}</h2><span class="build-note">${v.exact_build?'Exact timestamps':'≈ observed timestamps'}</span></div><div class="purchase-grid">${p.slice(page*10,page*10+10).map(i=>`<div class="purchase">${art('items',i.id,i.name)}<time>${time(i.time)}</time></div>`).join('')||quiet('No purchases recorded')}</div><div class="skill-section"><h2>Ability upgrades</h2><div class="skills">${skills.slice(skillPage*18,skillPage*18+18).map(e=>`<div class="skill" data-slot="${esc(e.detail)}"><b>${esc(e.detail)}</b><small>${time(e.time)}</small></div>`).join('')||`<span class="build-note">${v.exact_skills?'No upgrades recorded':'Available after Riot timeline arrives'}</span>`}</div></div></div>`;
}
const glyph={kill:'⚔',death:'×',assist:'✦',objective:'◆',vision:'◉',skill:'↑',level:'↑',milestone:'★',item:'▣'};
function eventHTML(e){const labels={kill:'Kill',death:'Death',assist:'Assist',skill:'Upgrade'};return `<div class="event" data-kind="${esc(e.kind)}" data-side="${esc(e.side)}"><span class="event-icon" aria-hidden="true">${e.item_id?art('items',e.item_id,e.detail):e.kind==='objective'?icon(objectiveIcon(e.label)):glyph[e.kind]||'◆'}</span><div><time>${time(e.time)}${e.source==='observed'?' ≈':''}</time><b title="${esc(e.label)}">${esc(e.kind==='objective'?objectiveName(e.label):labels[e.kind]||e.label)}</b><small title="${esc(e.detail)}">${esc(e.detail)}</small></div></div>`;}
export const views=['Highlights','Tempo','Combat','Build','Economy','Vision','Moments'];
export function renderView(s,index,cycle=0){let content,pageNote='';
 if(index===0){content=highlights(s,cycle);pageNote=cycle%2?'Your recent baseline':'Your match highlights';}
 if(index===1){content=tempo(s,cycle);pageNote='Progress over time';}
 if(views[index]==='Build'){content=build(s,cycle);pageNote='Purchase & upgrade order';}
 if(views[index]==='Moments'){const events=s.stories?.moments||s.events||[],count=Math.max(1,Math.ceil(events.length/6)),page=cycle%count;content=`<div class="events-grid">${events.slice(page*6,page*6+6).map(eventHTML).join('')||quiet('No personal combat or objectives recorded')}</div>`;pageNote=`${page+1}/${count} · ${events.length} moments`;}
 if(views[index]==='Combat'){content=combat(s);pageNote='Damage, survival & spell use';}
 if(views[index]==='Economy'){content=economy(s);pageNote='Gold flow';}
 if(views[index]==='Vision'){content=vision(s,cycle);pageNote='Wards & objective timings';}
 el('view').innerHTML=content;el('pageLabel').textContent=pageNote;
 // Keep focused controls mounted while the shared playhead updates.
 if(!el('tabs').children.length)el('tabs').innerHTML=views.map((v,i)=>`<button data-view="${i}" aria-current="false">${v}</button>`).join('');
 el('tabs').querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-current',String(i===index)));
}
