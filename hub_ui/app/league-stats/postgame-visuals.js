// Broadcast-only visual summaries of measured facts. No inferred skill grades.
import {icon} from './postgame-stories.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=(v,d=0)=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:d}):'—';
const short=v=>Number.isFinite(v)&&Math.abs(v)>=1000?n(v/1000,1)+'k':n(v);
const time=v=>Number.isFinite(v)?`${Math.floor(v/60)}:${String(Math.floor(v%60)).padStart(2,'0')}`:'—';
const ring=(value,label,tone='mint')=>`<div class="visual-ring ${tone}" role="img" aria-label="${esc(label)}: ${n(value)} percent" style="--value:${Number.isFinite(value)?Math.max(0,Math.min(100,value)):0}"><div><strong>${n(value)}${Number.isFinite(value)?'<small>%</small>':''}</strong><span>${label}</span></div></div>`;
const bar=(label,value,max,tone='mint')=>`<div class="visual-bar ${tone}"><span>${esc(label)}</span><div><i style="width:${Number.isFinite(value)?Math.max(0,Math.min(100,value/Math.max(1,max)*100)):0}%"></i></div><b>${short(value)}</b></div>`;
const fact=(value,label)=>`<div class="visual-fact"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`;

export function overview(s){const m=s.match.metrics||{},story=s.stories||{};
 return `<div class="visual-overview"><div class="ring-trio">${ring(m.kill_participation,'Kill participation')}${ring(m.damage_share_pct,'Team damage','gold')}${ring(story.alive_pct,'Time alive','blue')}</div><div class="visual-feats">${(story.badges||[]).slice(0,3).map(b=>`<div>${icon(b.icon)}<strong>${n(b.value)}</strong><span>${esc(b.label)}</span></div>`).join('')||fact(n(m.cs_per_minute,1),'CS / min')+fact(short(m.gold_earned),'Gold')+fact(n(m.vision_score),'Vision')}</div></div>`;
}

export function teamDamage(s,art){const m=s.match.metrics||{},team=(s.visuals?.team||[]).filter(p=>Number.isFinite(p.damage)).sort((a,b)=>b.damage-a.damage),max=Math.max(1,...team.map(p=>p.damage));
 const parts=[['Physical',m.physical_damage_champions,'gold'],['Magic',m.magic_damage_champions,'blue'],['True',m.true_damage_champions,'mint']],total=parts.every(p=>Number.isFinite(p[1]))?parts.reduce((sum,p)=>sum+p[1],0):0;
 return `<div class="visual-combat"><article class="panel"><h2>Team damage</h2><div class="damage-ranking">${team.map(p=>`<div class="damage-player ${p.own?'own':''}">${art('champions',p.champion_id,p.champion)}${bar(p.own?'YOU':p.champion,p.damage,max,p.own?'mint':'blue')}</div>`).join('')||'<div class="quiet">Team totals unavailable</div>'}</div></article><article class="panel damage-profile"><h2>Your damage</h2><div class="visual-total">${short(m.damage_champions)}</div><div class="damage-stack">${total?parts.map(([label,value,tone])=>`<i class="${tone}" style="width:${value/total*100}%" title="${label}: ${n(value)}"></i>`).join(''):''}</div><div class="visual-legend">${parts.map(([label,value,tone])=>`<div class="${tone}"><i></i>${label}<b>${short(value)}</b></div>`).join('')}</div><div class="support-facts">${fact(short(m.damage_mitigated),'Blocked')}${fact(Number.isFinite(m.cc_seconds)?n(m.cc_seconds)+'s':'—','Crowd control')}</div></article></div>`;
}

function eventRail(events,start,end){return `<div class="moment-rail" role="img" aria-label="Recorded takedown times">${events.map(e=>`<i class="${e.kind==='kill'?'gold':'mint'}" style="left:${Math.max(0,Math.min(98,(e.time-start)/Math.max(1,end-start)*98))}%" title="${esc(e.kind)} · ${time(e.time)}">${e.kind==='kill'?'⚔':'✦'}</i>`).join('')}</div><div class="rail-times"><span>${time(start)}</span><span>${time(end)}</span></div>`;}

export function visualStory(s,cycle){
 const m=s.match.metrics||{},a=s.analysis||{},story=s.stories||{},cards=[];
 const burst=story.burst;if(burst)cards.push({id:'burst',title:'Your busiest minute',value:n(burst.kills+burst.assists),unit:'takedowns',visual:eventRail(burst.events||[],burst.start,burst.end),facts:fact(n(burst.kills),'Kills')+fact(n(burst.assists),'Assists')});
 for(const c of story.comparisons||[])cards.push({id:'baseline-'+c.key,title:c.label,value:(c.change>=0?'+':'')+n(c.change)+'%',unit:'vs your usual',visual:bar('This game',c.value,Math.max(c.value,c.average))+bar('Your usual',c.average,Math.max(c.value,c.average),'blue'),facts:`<span class="visual-evidence">${c.games} prior games · same champion, role & queue · ${esc(c.unit)}</span>`});
 if(a.farm_window){const f=a.farm_window;cards.push({id:'farm',title:'Fastest farming stretch',value:n(f.rate,1),unit:'CS / min',visual:bar('This stretch',f.rate,Math.max(f.rate,m.cs_per_minute||0))+bar('Whole game',m.cs_per_minute,Math.max(f.rate,m.cs_per_minute||0),'blue'),facts:fact(time(f.start)+' → '+time(f.end),'Sampled window')+fact(n(f.cs),'CS')});}
 const casts=['q','w','e','r'].map(k=>m[k+'_casts']);if(casts.some(Number.isFinite))cards.push({id:'casts',title:'Your buttons',value:casts.every(Number.isFinite)?n(casts.reduce((a,b)=>a+b,0)):'—',unit:'casts',visual:`<div class="spell-columns">${casts.map((v,i)=>`<div><strong>${n(v)}</strong><div><i style="height:${Number.isFinite(v)?v/Math.max(1,...casts.filter(Number.isFinite))*100:0}%"></i></div><b>${'QWER'[i]}</b></div>`).join('')}</div>`,facts:''});
 if(Number.isFinite(m.dead_seconds)&&s.match.duration>0)cards.push({id:'alive',title:'Time in the game',value:time(Math.max(0,s.match.duration-m.dead_seconds)),unit:'alive',visual:ring(story.alive_pct,'Time alive','blue'),facts:fact(time(m.dead_seconds),'Dead')+fact(n(m.deaths),'Deaths')});
 const card=cards[cycle%Math.max(1,cards.length)];if(!card)return overview(s);
 return `<article class="visual-story" data-story="${esc(card.id)}"><div class="visual-lead"><h2>${esc(card.title)}</h2><strong>${esc(card.value)}</strong><span>${esc(card.unit)}</span><div class="story-facts">${card.facts}</div></div><div class="visual-proof">${card.visual}</div><small class="story-count">${cycle%cards.length+1} / ${cards.length}</small></article>`;
}
