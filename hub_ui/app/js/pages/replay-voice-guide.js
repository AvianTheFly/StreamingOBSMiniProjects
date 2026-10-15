// Render the feature's reference once; disposal rejects late results.
import { api } from '../api.js';

export function mountVoiceGuide(container) {
  let disposed=false;
  const heading=document.createElement('p');heading.textContent='Loading voice commands…';container.append(heading);
  api.getReplayCommands().then(guide=>{
    if(disposed)return;
    if(!Array.isArray(guide.groups))throw Error('Voice reference unavailable');
    heading.textContent=guide.instructions;
    const grid=document.createElement('div');grid.className='ir-help-grid';
    for(const group of guide.groups){
      const section=document.createElement('div'),title=document.createElement('h3');title.textContent=group.title;section.append(title);
      for(const command of group.commands){
        const p=document.createElement('p'),code=document.createElement('code');code.textContent=command.say;p.append(code,document.createTextNode(` — ${command.description}`));section.append(p);
      }
      grid.append(section);
    }
    const compatibility=document.createElement('p');compatibility.className='ir-muted';compatibility.textContent=guide.compatibility;container.append(grid,compatibility);
  }).catch(()=>{if(!disposed)heading.textContent='Voice reference unavailable. Close and reopen Manage clips to retry.';});
  return ()=>{disposed=true;};
}
