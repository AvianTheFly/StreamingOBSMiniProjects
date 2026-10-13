// Draft semantics only. Initial/hidden snapshots are baselines, not events.
// IDs are compared without retaining chat text or player information.
export class DraftCues {
  constructor(){this.reset();}
  reset(){this.previous=null;this.chatIds=new Set();}
  observe(state) {
    const draft=state.draft||{},next={theme:state.theme,generation:state.generation,phase:draft.phase};
    for(const key of ['allies','enemies','allyBans','enemyBans'])
      next[key]=Array.from({length:5},(_,i)=>{const s=draft[key]?.[i];return s?.locked?Number(s.championId)||0:0;});
    const messages=(state.chat||[]).filter(m=>m.id!==undefined&&m.id!==null);
    if(!state.visible){this.reset();return [];}
    const before=this.previous,baseline=!before||before.theme!==next.theme||before.generation!==next.generation;
    this.previous=next;
    if(baseline){this.chatIds=new Set(messages.map(m=>String(m.id)));return [];}
    const events=[];
    for(const key of ['allies','enemies','allyBans','enemyBans']) {
      const ban=key.endsWith('Bans');
      next[key].forEach((id,index)=>{
        if(id&&(ban?!before[key].includes(id):id!==before[key][index]))
          events.push({kind:ban?'ban':'lock',key,index,championId:id,enemy:key.startsWith('enem')});
      });
    }
    let fresh=0;
    for(const message of messages){const id=String(message.id);if(!this.chatIds.has(id)){fresh++;this.chatIds.add(id);}}
    while(this.chatIds.size>80)this.chatIds.delete(this.chatIds.values().next().value);
    if(fresh)events.push({kind:'chat',count:Math.min(fresh,3)});
    if(next.phase==='FINALIZATION'&&before.phase!==next.phase)events.push({kind:'ready'});
    return events;
  }
}
