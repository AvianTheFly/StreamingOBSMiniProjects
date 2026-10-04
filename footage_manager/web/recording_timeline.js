'use strict';
// Source-scoped game/saved-clip visuals. Navigation and persistence belong to app.js.
(() => {
  let viewport=null,result=null,revision=0,requestedAt=0,controller=null;
  function render(){
    if(!viewport)return;
    const duration=viewport.duration||1,disabled=viewport.availability!=='online'?'disabled':'';
    $('game-overview').innerHTML=(result?.games||[]).map(game=>
      `<button class="game-block ${game.outcome==='victory'?'victory':game.outcome==='defeat'?'defeat':''}" data-game-index="${game.index}" ${disabled} style="left:${game.start/duration*100}%;width:${(game.end-game.start)/duration*100}%" title="Game ${game.index+1} · ${time(game.start)}–${time(game.end)} · ${escape(game.outcome)}" aria-label="Game ${game.index+1}, ${time(game.start)} to ${time(game.end)}, ${escape(game.outcome)}">Game ${game.index+1}</button>`).join('');
    $('saved-overview').innerHTML=(viewport.ranges||[]).filter(range=>range.decision==='keep').map(range=>
      `<button class="saved-block ${range.decision==='reject'?'rejected':''}" data-saved-range="${range.id}" style="left:${range.start/duration*100}%;width:${(range.end-range.start)/duration*100}%" title="${escape(range.title||range.decision)} · ${time(range.start)}–${time(range.end)}" aria-label="${escape(range.title||range.decision)}, ${time(range.start)} to ${time(range.end)}"></button>`).join('');
    const state=result?.state;
    $('game-timeline-note').textContent=state==='source_changed'?'Recording changed; earlier game boundaries are hidden.':state==='pending'?'No game boundaries available for this recording yet.':state==='outdated'?'Approximate game boundaries · earlier analysis.':state==='current'?'Approximate game boundaries. Click a game to select it.':'';
    $('whole-duration').textContent=time(duration);
    const draft=viewport.draft,valid=FootageClipEditor.valid(draft,duration);
    $('full-selection').hidden=!valid;
    if(valid){$('full-selection').style.left=draft.start/duration*100+'%';$('full-selection').style.width=(draft.end-draft.start)/duration*100+'%';}
  }
  async function load(){
    const id=viewport.video_id,generation=++revision;
    controller?.abort();controller=new AbortController();requestedAt=Date.now();
    try{
      const response=await fetch('/api/analysis-game-marks?id='+id,{signal:controller.signal});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||'Could not load games');
      if(generation!==revision||viewport.video_id!==id)return;
      result=data;render();
    }catch(error){if(generation===revision&&error.name!=='AbortError')$('game-timeline-note').textContent=error.message;}
  }
  document.addEventListener('footage:timeline',event=>{
    const changed=viewport?.video_id!==event.detail.video_id;viewport=event.detail;
    if(changed){result=null;render();load();}else{render();if(Date.now()-requestedAt>=8000)load();}
  });
  $('game-overview').onclick=event=>{
    const button=event.target.closest('[data-game-index]'),game=button&&result?.games.find(g=>g.index===Number(button.dataset.gameIndex));
    if(game&&viewport.availability==='online')action(()=>reviewSourceRange(viewport.video_id,game.start,game.end));
  };
  $('saved-overview').onclick=event=>{
    const button=event.target.closest('[data-saved-range]');
    if(button)action(()=>reviewSavedRange(viewport.video_id,Number(button.dataset.savedRange)));
  };
  window.addEventListener('pagehide',()=>controller?.abort());
})();
