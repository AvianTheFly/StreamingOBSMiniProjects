// Session/review controls and evidence-based insights for the League Stats page.
import {esc} from '../utils.js';
import {toast} from '../toast.js';
import {createExperience} from './league-stats-experience.js';
import {createChat} from './league-stats-chat.js';
import {createForm} from './league-stats-form.js';
import {createOverlayBuilder} from './league-stats-overlay-builder.js';
const fmt=v=>v==null?'—':Number(v).toLocaleString(undefined,{maximumFractionDigits:2});
const label=k=>k.replaceAll('_',' ').replace(/\bcs\b/gi,'CS');
const table=(headers,rows)=>`<div style="overflow-x:auto"><table style="width:100%;text-align:left;border-collapse:collapse"><thead><tr>${headers.map(h=>`<th style="padding:9px;border-bottom:1px solid var(--line)">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td style="padding:9px;border-bottom:1px solid var(--line)">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
export function createTools(root,request,refresh){
 const $=id=>root.querySelector('#'+id);let loaded=false,reviewSignature='';
 const section=document.createElement('section');section.className='card';section.style.marginBottom='18px';
 section.innerHTML=`<div class="card-title">Stream sessions</div><p id="lsSessionStatus"></p><div style="display:flex;gap:12px;flex-wrap:wrap"><label>New session name<input id="lsSessionName" class="input" maxlength="80" placeholder="Friday ranked climb"></label><button id="lsNewSession" class="btn">Start new session</button><label>Saved session<select id="lsSession" class="input"><option value="">Current session</option></select></label></div><p style="color:var(--muted)">Session boundaries survive Hub restarts. Start the next one between games; previous sessions and lifetime history stay available.</p>`;
 $('lsCards').before(section);
 const experience=createExperience(root,request,refresh);
 const chat=createChat(root,request,refresh);
 const form=createForm(root,id=>{if(matches.some(r=>r.id===id)){const same=$('lsReviewMatch').value===id;$('lsReviewMatch').value=id;selectedReview(reviewDirty&&same);$('lsReviewMatch').closest('section').scrollIntoView({block:'center'});$('lsReviewMatch').focus({preventScroll:true});}else{toast.error('Choose a narrower filter to review this older game.');}});
 const builder=createOverlayBuilder(root);
 const pace=document.createElement('div');pace.id='lsLivePace';pace.className='ls-pace';$('lsLive').after(pace);
 const helperFeed=document.createElement('div');helperFeed.id='lsHelperFeed';helperFeed.className='ls-helper-feed';$('lsHelper').after(helperFeed);
 const insight=document.createElement('section');insight.className='card';insight.style.marginBottom='18px';
 insight.innerHTML=`<div class="card-title">Records &amp; recent progress</div><p id="lsStreak"></p><details open><summary>Personal bests in this view</summary><div id="lsBests"></div></details><details><summary>Last 10 games vs the previous 10</summary><div id="lsTrends"></div></details>`;
 $('lsMetrics').closest('section').before(insight);
 const search=document.createElement('input');search.className='input';search.id='lsMetricSearch';search.type='search';search.placeholder='Find a stat: damage, gold, casts, difference…';search.style.cssText='width:100%;margin:10px 0';search.setAttribute('aria-label','Search statistics');$('lsMetrics').before(search);
 const prefs=document.createElement('div');prefs.innerHTML=`<label style="display:block;margin:12px 0">Custom counters (one key = label per line)<textarea id="lsCustomCounters" class="input" rows="3" style="width:100%" placeholder="bad_recall = Bad recalls&#10;missed_hook = Missed hooks"></textarea></label><p style="color:var(--muted)">Trusted helpers use <code>!count bad_recall</code>. These are labelled manual observations and share the missed-minion cooldown.</p><label>Blocked helper logins<input id="lsBlockedHelpers" class="input" style="width:100%" placeholder="login, another_login"></label><label style="display:block;margin:12px 0"><input id="lsViewerRequests" type="checkbox" style="width:auto;margin-right:8px"> Let viewers request stat cards on the overlay</label><label>Request cooldown <input id="lsRequestCooldown" class="input" type="number" min="5" max="60" style="width:75px"> seconds</label>`;
 $('lsSave').before(prefs);
 const community=document.createElement('section');community.className='card';community.style.marginBottom='18px';community.innerHTML=`<div class="card-title">Viewer stat requests</div><p>Anyone can request a 12-second overlay card: <code>!stats cs</code>, <code>!stats kda</code>, <code>!stats record</code>, <code>!stats dragons</code>, <code>!stats misses</code>, <code>!stats damage</code>, <code>!stats vision</code>, <code>!stats streak</code>.</p><p style="color:var(--muted)">Cards show the current saved session. Requests are limited globally and to one per viewer per minute. They do not modify counts.</p><p id="lsSpotlight" role="status"></p><button id="lsDismissSpotlight" class="btn">Dismiss card</button><div id="lsCustomButtons" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"></div></section>`;
 insight.before(community);
 const review=document.createElement('section');review.className='card';review.style.marginTop='18px';review.innerHTML=`<div class="card-title">Match review</div><p style="color:var(--muted)">Exclude a match from calculations or add a note. The original record remains in the archive and export. Re-include it at any time.</p><label>Match<select id="lsReviewMatch" class="input" style="width:100%"></select></label><label style="display:block;margin:12px 0"><input id="lsExcludeMatch" type="checkbox" style="width:auto;margin-right:8px"> Exclude from summaries</label><label>Review note<textarea id="lsReviewNote" class="input" rows="3" maxlength="1000" style="width:100%"></textarea></label><button class="btn" id="lsSaveReview">Save match review</button><div id="lsTimelineReview"></div><div id="lsObservationReview"></div>`;
 $('lsMatches').after(review);
 const draftState=document.createElement('p');draftState.id='lsReviewDraftState';draftState.className='ls-muted';draftState.setAttribute('role','status');$('lsSaveReview').after(draftState);
 let matches=[],revision=0,reviewDirty=false,reviewId='',reviewSaving=false;const reviewDrafts=new Map();
 async function act(path,body){try{await request('/api/league-stats/'+path,body);toast.success('Saved');await refresh();}catch(e){toast.error(e.message);}}
 $('lsNewSession').onclick=()=>act('session',{name:$('lsSessionName').value});
 $('lsSession').onchange=()=>{$('lsPeriod').value='session';refresh();};
 $('lsDismissSpotlight').onclick=()=>act('dismiss-spotlight',{});
 $('lsSaveReview').onclick=async()=>{
  if(reviewSaving)return;reviewSaving=true;$('lsSaveReview').disabled=true;
  const payload={id:$('lsReviewMatch').value,revision,note:$('lsReviewNote').value,excluded:$('lsExcludeMatch').checked};
  try{
   const result=await request('/api/league-stats/review',payload),nextRevision=result.revision??payload.revision+1;
   const draft=reviewDrafts.get(payload.id);
   if(draft){if(draft.note===payload.note&&draft.excluded===payload.excluded)reviewDrafts.delete(payload.id);else draft.revision=nextRevision;}
   if(reviewId===payload.id){revision=nextRevision;reviewDirty=$('lsReviewNote').value!==payload.note||$('lsExcludeMatch').checked!==payload.excluded;reviewSignature='';}
   toast.success('Saved');await refresh();
  }catch(e){toast.error(e.message);}
  finally{reviewSaving=false;$('lsSaveReview').disabled=!matches.length;draftStatus();}
 };
 function draftStatus(){draftState.textContent=reviewDirty?'Unsaved review · kept while you browse games on this page.':'Review saved · notes change only when you press Save.';}
 $('lsReviewNote').oninput=()=>{reviewDirty=true;draftStatus();};$('lsExcludeMatch').onchange=()=>{reviewDirty=true;draftStatus();};
 function selectedReview(preserveDraft=false){
  const r=matches.find(r=>r.id===$('lsReviewMatch').value);
  if(reviewDirty&&reviewId&&reviewId!==r?.id){reviewDrafts.set(reviewId,{revision,note:$('lsReviewNote').value,excluded:$('lsExcludeMatch').checked});while(reviewDrafts.size>50)reviewDrafts.delete(reviewDrafts.keys().next().value);}
  if(!preserveDraft){const draft=reviewDrafts.get(r?.id),values=draft||r?.review||{};reviewDirty=!!draft;revision=values.revision||0;$('lsReviewNote').value=values.note||'';$('lsExcludeMatch').checked=!!values.excluded;}
  reviewId=r?.id||'';draftStatus();
  if(!r){$('lsTimelineReview').replaceChildren();$('lsObservationReview').replaceChildren();return;}
  const points=Object.entries(r.timeline_checkpoints||{});
  $('lsTimelineReview').innerHTML=points.length?'<h4>Lane checkpoints</h4>'+table(['Minute','Sample time','CS','CS difference','Gold difference','XP difference'],points.map(([minute,p])=>[esc(minute),fmt(p.sample_seconds)+'s',fmt(p.cs),fmt(p.cs_difference),fmt(p.gold_difference),fmt(p.xp_difference)])):'<p style="color:var(--muted)">Lane checkpoints require a returned Match-v5 timeline and a confirmed opponent.</p>';
  const purchases=r.purchase_events||[];
  if(purchases.length)$('lsTimelineReview').innerHTML+='<details><summary>Purchase / sale / undo journal</summary>'+table(['Time','Event','Item'],purchases.map(e=>[fmt(e.time)+'s',esc(e.type.replace('ITEM_','')),esc(e.name)+(e.type==='ITEM_UNDO'?` (${esc(String(e.before_id??''))} → ${esc(String(e.after_id??''))})`:'')]))+'</details>';
  $('lsObservationReview').replaceChildren();
  for(const o of r.observations||[]){const row=document.createElement('div');row.style.cssText='display:flex;gap:10px;align-items:center;margin:8px 0';const text=document.createElement('span');text.textContent=`${o.actor}: ${o.label||label(o.metric)} at ${Math.round(o.game_time)}s${o.undone?' · undone':''}`;row.append(text);if(!o.undone){const undo=document.createElement('button');undo.className='btn';undo.textContent='Undo this entry';undo.onclick=()=>act('correct-observation',{match_id:r.id,observation_id:o.id});row.append(undo);}$('lsObservationReview').append(row);}
 }
 $('lsReviewMatch').onchange=()=>selectedReview();
 // Put daily controls first; configuration remains available through a direct jump.
 const liveRow=$('lsLive').closest('section').parentElement;
 const setup=document.createElement('details');setup.id='lsSetup';setup.className='card ls-setup';setup.innerHTML='<summary>Session &amp; stream setup</summary>';
 setup.append(experience.readiness,section,builder.element);root.append(setup);
 $('lsStatus').closest('.card').after(form.navigation);form.navigation.after($('lsCards'));
 $('lsCards').after(experience.focus);experience.focus.after(liveRow);liveRow.after(chat.element);chat.element.after(form.element);
 return {
  preferences(){const counters={};for(const line of $('lsCustomCounters').value.split('\n').filter(s=>s.trim())){const at=line.indexOf('=');if(at<1)throw Error('Use key = label for each custom counter');const key=line.slice(0,at).trim();if(Object.hasOwn(counters,key))throw Error('Each counter key must be unique');counters[key]=line.slice(at+1).trim();}return {custom_counters:counters,blocked_helpers:$('lsBlockedHelpers').value.split(/[\s,]+/).filter(Boolean),viewer_requests:$('lsViewerRequests').checked,request_cooldown_seconds:Number($('lsRequestCooldown').value)};},
  render(s){
   form.render(s);
   chat.render(s);
   experience.render(s);
   const pace=s.live_progress||{};
   $('lsLivePace').innerHTML=pace.available?`<div class="ls-pace-heading"><strong>CS pace · ${esc(fmt(pace.target))}/min target</strong><span>${pace.on_target?'On target':'Behind target'}</span></div><progress max="100" value="${Math.min(100,Math.max(0,100*pace.cs/pace.expected_cs))}" aria-label="Live CS goal progress"></progress><p>${pace.on_target?'+'+fmt(pace.difference)+' CS above pace':fmt(pace.needed)+' more CS to reach target at this game time'} · ${esc(fmt(pace.cs_per_minute))} CS/min now</p>`:'<span class="ls-muted">Your CS goal pace appears during a live game.</span>';
   $('lsHelperFeed').innerHTML=(s.current?.observations||[]).slice(-5).reverse().map(o=>`<div class="ls-helper-entry"><span>${o.undone?'↩️':'✓'} ${esc(o.label||label(o.metric))} · ${esc(o.actor)}${o.undone?' · undone':''}</span><time>${Math.floor((o.game_time||0)/60)}:${String(Math.floor((o.game_time||0)%60)).padStart(2,'0')}</time></div>`).join('');
   const session=s.sessions?.current;$('lsSessionStatus').textContent=session?`${session.name} · started ${new Date(session.started_at*1000).toLocaleString()}`:'Current session';
   const select=$('lsSession'),chosen=select.value,html='<option value="">Current session</option>'+(s.sessions?.history||[]).slice().reverse().map(v=>`<option value="${esc(v.id)}">${esc(v.name)} · ${esc(new Date(v.started_at*1000).toLocaleDateString())}</option>`).join('');if(select.innerHTML!==html){select.innerHTML=html;select.value=chosen;}
   if(!loaded){const c=s.settings;$('lsCustomCounters').value=Object.entries(c.custom_counters||{}).map(([k,v])=>`${k} = ${v}`).join('\n');$('lsBlockedHelpers').value=(c.blocked_helpers||[]).join(', ');$('lsViewerRequests').checked=c.viewer_requests!==false;$('lsRequestCooldown').value=c.request_cooldown_seconds||10;loaded=true;}
   const i=s.insights||{},st=i.streak||{};$('lsStreak').textContent=`Current streak: ${st.current||0} ${st.kind||'results'} · Best win streak: ${st.longest_wins||0} · Longest loss streak: ${st.longest_losses||0} · Deathless games: ${i.deathless_games||0} / ${i.deathless_coverage||0} with coverage`;
   $('lsBests').innerHTML=(i.records||[]).length?table(['Stat','Personal best','Champion','Covered games'],i.records.map(r=>[esc(label(r.metric)),fmt(r.value),esc(r.champion),fmt(r.games)])):'<p>Complete or import matches to build your personal records.</p>';
   $('lsTrends').innerHTML=(i.trends||[]).length?table(['Stat','Recent mean','Previous mean','Change','Samples'],i.trends.map(r=>[esc(label(r.metric)),fmt(r.recent),fmt(r.previous),r.change==null?'—':(r.change>0?'+':'')+fmt(r.change),`${r.recent_games} / ${r.previous_games}`])):'<p>More completed matches are needed.</p>';
   $('lsSpotlight').textContent=s.spotlight?`${s.spotlight.requested_by} requested ${s.spotlight.title}: ${s.spotlight.text}`:'No active viewer request.';
   $('lsCustomButtons').replaceChildren(...Object.entries(s.settings.custom_counters||{}).map(([key,name])=>{const b=document.createElement('button');b.className='btn';b.textContent='+ '+name;b.disabled=!s.current?.connected||!s.settings.helper_enabled;b.onclick=()=>act('observe',{metric:'custom_'+key});return b;}));
   matches=s.matches||[];const signature=JSON.stringify(matches.map(r=>[r.id,r.review?.revision,r.observations?.map(o=>[o.id,o.undone]),r.timeline_version]));
   if(signature!==reviewSignature){const previous=$('lsReviewMatch').value;$('lsReviewMatch').innerHTML=matches.map(r=>`<option value="${esc(r.id)}">${esc(r.champion)} · ${esc(new Date(r.started_at*1000).toLocaleString())}${r.review?.excluded?' · excluded':''}</option>`).join('');if(matches.some(r=>r.id===previous))$('lsReviewMatch').value=previous;reviewSignature=signature;selectedReview(reviewDirty&&previous===$('lsReviewMatch').value);}
   $('lsSaveReview').disabled=reviewSaving||!matches.length;
  }
 };
}
