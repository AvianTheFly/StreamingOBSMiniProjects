// Setup readiness and compact current-session controls.
import {toast} from '../toast.js';
const fmt=v=>v==null?'—':Number(v).toLocaleString(undefined,{maximumFractionDigits:2});
export function createExperience(root,request,refresh){
 const $=id=>root.querySelector('#'+id);let loaded=false;
 const card=document.createElement('section');card.className='card';card.style.cssText='margin-bottom:18px';
 card.innerHTML=`<div class="card-title">Tracker readiness</div><p id="lsReadiness" role="status"></p><details><summary>Optional Riot enrichment</summary><p id="lsRiotStatus"></p><p>Open the <a href="https://developer.riotgames.com/" target="_blank" rel="noopener">Riot Developer Portal</a>, create a key, and add <code>RIOT_API_KEY=your_key</code> to this checkout’s root <code>.env</code>. The tracker reads key changes automatically. Keep the key out of chat and overlays. Development keys expire every 24 hours; a personal key suits your own tracker.</p><p>Set your Riot platform in preferences and open League once so the tracker can confirm your name and tag. Enrichment adds richer post-game stats and lane timelines; local tracking remains available without it.</p><button id="lsRetryRiot" class="btn">Refresh enrichment</button><p id="lsCoverage" style="color:var(--muted)"></p></details>`;
 $('lsStatus').closest('.card').after(card);
 const focus=document.createElement('section');focus.className='card';focus.style.cssText='margin-bottom:18px';
 focus.innerHTML=`<div class="card-title">Current stream at a glance</div><p id="lsRank"></p><p id="lsRecap"></p><p id="lsGoalProgress"></p><label>Farming goal <input class="input" id="lsCsGoal" type="number" min="1" max="15" step="0.1" style="width:85px"> CS/min</label> <button id="lsSaveGoal" class="btn">Save goal</button><p style="color:var(--muted)">Rank movement starts at this session’s first rank check. It describes observed ladder movement, including divisions; it is not a per-game LP award.</p><div style="display:flex;gap:12px;flex-wrap:wrap"><a href="/league-stats/overlay.html?view=rank" target="_blank">Rank overlay ↗</a><a href="/league-stats/overlay.html?view=recap" target="_blank">Last-game overlay ↗</a><a href="/league-stats/overlay.html?view=goal" target="_blank">Farming-goal overlay ↗</a></div><p>Viewers can request <code>!stats rank</code>, <code>!stats recap</code>, or <code>!stats goal</code> with the existing request cooldowns.</p>`;
 $('lsCards').before(focus);
 $('lsRetryRiot').onclick=async()=>{try{const r=await request('/api/league-stats/enrichment',{});toast.success(r.message);await refresh();}catch(e){toast.error(e.message);}};
 $('lsSaveGoal').onclick=async()=>{try{await request('/api/league-stats/settings',{cs_goal:Number($('lsCsGoal').value)});toast.success('Farming goal saved');await refresh();}catch(e){toast.error(e.message);}};
 return {focus,readiness:card,render(s){
  const c=s.coverage||{},e=s.enrichment||{},chat=s.chat?.connected?'Chat connected':'Chat reconnecting';
  $('lsReadiness').textContent=`${s.current?.connected?'Game tracking live':'Waiting for League game'} · ${chat} · ${e.configured?'Riot key configured':'Local tracking; Riot key optional'}`;
  $('lsRiotStatus').textContent=`${e.message||'Checking optional enrichment'}${e.retry_seconds?` · retry in ${e.retry_seconds}s`:''} · ${e.pending||0} queued${e.detail?' · '+e.detail:''}`;
  $('lsCoverage').textContent=`${c.recorded||0} archived games · ${c.official||0} verified official records · ${c.timelines||0} timelines. Optional enrichment checks the latest 100 archived games and resumes when the client is closed.`;
  const ranks=s.ranked||[];$('lsRank').textContent=ranks.length?ranks.map(r=>`${r.label}: ${r.tier==='NONE'||r.tier==='UNRANKED'?'Unranked':r.tier+' '+r.division+' · '+fmt(r.lp)+' LP'}${r.provisional?' · placements':''}${r.session_movement!=null?' · '+(r.session_movement>=0?'+':'')+fmt(r.session_movement)+' ladder movement':''} · checked ${new Date((r.checked_at||r.at)*1000).toLocaleTimeString()}`).join(' / '):'Rank: open League to record Solo/Duo and Flex progress.';
  const r=s.recap,m=r?.metrics||{};$('lsRecap').textContent=r?`Last completed game: ${r.champion} · ${r.win===true?'Win':r.win===false?'Loss':'Finished'} · ${[m.kills,m.deaths,m.assists].map(fmt).join('/')} · ${fmt(m.cs_per_minute)} CS/min`:'Last game: no completed game in this saved session yet.';
  const p=s.progress||{};if(!loaded){$('lsCsGoal').value=p.cs_target||s.settings.cs_goal||7;loaded=true;}
  $('lsGoalProgress').textContent=`Farming target: ${fmt(p.cs_target)} CS/min · ${p.reached_games||0} / ${p.covered_games||0} completed games reached it${p.success_rate!=null?' · '+fmt(p.success_rate)+'%':''}`;
 }};
}
