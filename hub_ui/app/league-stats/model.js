// Pure overlay views. Unknown telemetry stays unknown; rotation uses available views.
export const n=v=>v==null?'—':Number(v).toLocaleString(undefined,{maximumFractionDigits:2});
export function chooseView(params,s,now=Date.now()){
 const view=params.get('view')||'live';
 if(view!=='rotate')return ['live','session','rank','recap','goal'].includes(view)?view:'live';
 const seconds=Math.max(8,Math.min(30,Number(params.get('cycle'))||12));
 const views=[...(s.current?.connected?['live']:[]),'session',...((s.ranked||[]).length?['rank']:[]),...(s.recap?['recap']:[]),...(s.progress?.covered_games||s.live_progress?.available?['goal']:[])];
 return views[Math.floor(now/(seconds*1000))%views.length];
}
export function focus(s,view){
 if(view==='live')return null;
 if(view==='session'){
  const a=s.session_summary||s.summary,i=s.session_insights||s.insights||{},st=i.streak||{};
  return {title:'SAVED SESSION',text:`${a.wins} W · ${a.losses} L · ${a.win_rate==null?'—':n(a.win_rate)+'%'} WR`,scope:`${n(a.cs_per_minute)} CS/min · ${a.completed_games} completed${st.current?' · '+st.current+' '+st.kind:''}`,kind:'session'};
 }
 if(view==='rank'){
  const r=(s.ranked||[]).find(r=>r.queue==='RANKED_SOLO_5x5');
  return {title:'SOLO / DUO',text:r?['NONE','UNRANKED'].includes(r.tier)?'Unranked':`${r.tier} ${r.division} · ${n(r.lp)} LP`:'Rank not observed yet',scope:r?.session_movement!=null?`${r.session_movement>=0?'+':''}${n(r.session_movement)} observed ladder movement`:'Open League to observe rank',kind:'rank'};
 }
 if(view==='recap'){
  const r=s.recap,m=r?.metrics||{};
  return {title:r?`${r.champion} · ${r.win===true?'WIN':r.win===false?'LOSS':'FINISHED'}`:'LAST GAME',text:r?`${[m.kills,m.deaths,m.assists].map(n).join(' / ')} · ${n(m.cs_per_minute)} CS/min`:'No completed game this session',scope:'Current saved session',kind:'recap'};
 }
 const p=s.progress||{},live=s.live_progress;
 if(live?.available)return {title:`LIVE CS GOAL · ${n(live.target)}/min`,text:`${n(live.cs_per_minute)} CS/min · ${live.on_target?'On target':n(live.needed)+' CS behind'}`,scope:live.on_target?`+${n(live.difference)} CS above target pace`:'CS needed to reach target at this game time',progress:Math.min(100,Math.max(0,100*live.cs/live.expected_cs)),kind:'goal'};
 return {title:`FARMING GOAL · ${n(p.cs_target)} CS/min`,text:p.covered_games?`${p.reached_games||0} / ${p.covered_games} games reached it`:'No completed games with CS yet',scope:'Current saved session · completed games with CS coverage',progress:p.success_rate??null,kind:'goal'};
}
