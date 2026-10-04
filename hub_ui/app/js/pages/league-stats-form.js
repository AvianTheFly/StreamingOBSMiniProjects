// Recent-game chart and review shortcuts for the active dashboard filters.
import {esc} from '../utils.js';
const metrics={cs_per_minute:'CS / min',kills:'Kills',deaths:'Deaths',vision_score:'Vision score',damage_per_minute:'Damage / min'};
const n=v=>v==null?'—':Number(v).toLocaleString(undefined,{maximumFractionDigits:2});
const known=v=>typeof v==='number'&&Number.isFinite(v);
export function createForm(root,onReview){
 const $=id=>root.querySelector('#'+id);let state=null,signature='';
 if(!document.getElementById('lsStyles')){const link=document.createElement('link');link.id='lsStyles';link.rel='stylesheet';link.href='/css/league-stats.css';document.head.append(link);}
 const nav=document.createElement('nav');nav.className='ls-jumps';nav.setAttribute('aria-label','League stats sections');
 nav.innerHTML=[['lsCards','Overview'],['lsLive','Live & helpers'],['lsForm','Recent form'],['lsMatchups','Matchups'],['lsMatches','History'],['lsSetup','Setup']].map(([id,name])=>`<button class="btn" data-jump="${id}">${name}</button>`).join('');
 $('lsCards').before(nav);nav.querySelectorAll('button').forEach(b=>b.onclick=()=>{const target=$(b.dataset.jump);if(target?.tagName==='DETAILS')target.open=true;target?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});});
 const section=document.createElement('section');section.id='lsForm';section.className='card ls-form';
 section.innerHTML=`<div class="ls-section-heading"><div><div class="card-title">Your recent form</div><p class="ls-muted">Last 12 completed games in this view. Select a game to open its review.</p></div><label>Chart statistic<select id="lsFormMetric" class="input">${Object.entries(metrics).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label></div><div class="ls-chart" id="lsFormChart"></div><p id="lsFormCoverage" class="ls-muted"></p><div id="lsFormMatches" class="ls-form-matches"></div>`;
 $('lsMatchups').closest('section').before(section);
 $('lsFormMetric').onchange=()=>render();
 function render(){
  if(!state)return;const rows=state.form||[],metric=$('lsFormMetric').value,target=state.settings.cs_goal||7;
  const key=JSON.stringify([rows,metric,target]);if(signature===key)return;signature=key;
  const covered=rows.filter(r=>known(r.metrics?.[metric]));
  $('lsFormCoverage').textContent=`${covered.length}/${rows.length} games reported ${metrics[metric].toLowerCase()}. ${metric==='cs_per_minute'?'Dashed line = your '+n(target)+' CS/min goal. ':''}Missing values remain gaps.`;
  if(!rows.length){$('lsFormChart').innerHTML='<div class="ls-empty">🎮 Your next completed games will build this chart.</div>';$('lsFormMatches').replaceChildren();return;}
  const ceiling=Math.max(1,metric==='cs_per_minute'?target:0,...covered.map(r=>r.metrics[metric]))*1.15;
  const x=i=>42+(rows.length===1?316:i*632/(rows.length-1)),y=v=>130-v/ceiling*106;
  let path='',gap=true;rows.forEach((r,i)=>{const v=r.metrics?.[metric];if(!known(v)){gap=true;return;}path+=(gap?'M':'L')+x(i).toFixed(2)+' '+y(v).toFixed(2)+' ';gap=false;});
  const grid=[0,ceiling/2,ceiling].map(v=>`<line x1="42" y1="${y(v)}" x2="674" y2="${y(v)}" class="ls-chart-grid"/><text x="34" y="${y(v)+4}" text-anchor="end">${esc(n(v))}</text>`).join('');
  const goal=metric==='cs_per_minute'?`<line x1="42" y1="${y(target)}" x2="674" y2="${y(target)}" class="ls-chart-goal"/>`:'';
  const points=rows.map((r,i)=>{const v=r.metrics?.[metric];return known(v)?`<circle cx="${x(i)}" cy="${y(v)}" r="4.5" class="${r.win===true?'ls-win':r.win===false?'ls-loss':'ls-neutral'}"><title>${esc(r.champion)} · ${r.win===true?'Win':r.win===false?'Loss':'Finished'} · ${esc(n(v))} ${esc(metrics[metric])}</title></circle>`:'';}).join('');
  $('lsFormChart').innerHTML=`<svg viewBox="0 0 710 160" role="img" aria-label="${esc(metrics[metric])} across ${rows.length} recent completed games"><title>${esc(metrics[metric])} across recent games</title><desc>Games are ordered oldest to newest. Missing statistics leave gaps. Individual values are listed below.</desc>${grid}${goal}<path d="${path}" class="ls-chart-line"/>${points}<text x="42" y="151">OLDEST</text><text x="674" y="151" text-anchor="end">LATEST</text></svg>`;
  $('lsFormMatches').innerHTML=rows.map(r=>`<button class="ls-match ${r.win===true?'ls-match-win':r.win===false?'ls-match-loss':''}" data-review-id="${esc(r.id)}" aria-label="Review ${esc(r.champion)} · ${r.win===true?'Win':r.win===false?'Loss':'Finished'} · ${known(r.metrics?.[metric])?esc(n(r.metrics[metric]))+' '+esc(metrics[metric]):'Statistic not reported'}"><span class="ls-match-result">${r.win===true?'W':r.win===false?'L':'?'}</span><strong>${esc(r.champion)}</strong><span>${esc(n(r.metrics?.[metric]))}</span></button>`).join('');
  $('lsFormMatches').querySelectorAll('button').forEach(b=>b.onclick=()=>onReview(b.dataset.reviewId));
 }
 return {element:section,navigation:nav,render(s){state=s;render();}};
}
