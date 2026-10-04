'use strict';
// Derived voice cues consume the source owner's timeline/review contracts.
// No marker becomes a keeper until the user saves the proposed range.
(() => {
  let viewport=null, result=null, revision=0, requestedAt=0, controller=null;
  const label=marker=>`${time(marker.time)} · +${marker.above_baseline_db.toFixed(1)} dB · Game ${marker.game_index+1}`;

  function renderTrack(id,start,length){
    const markers=result?.markers||[];
    $(id).innerHTML=markers.filter(marker=>marker.time>=start&&marker.time<start+length).map(marker=>
      `<button class="voice-tick" data-voice-marker="${marker.id}" ${viewport.availability!=='online'?'disabled':''} style="left:${Math.max(0,marker.start-start)/length*100}%;width:${Math.max(.15,(Math.min(start+length,marker.end)-Math.max(start,marker.start))/length*100)}%" title="Voice spike ${label(marker)}" aria-label="Voice spike ${label(marker)}"></button>`).join('');
  }

  function render(){
    if(!viewport)return;
    const markers=result?.markers||[];
    const hidden=result?.state==='ineligible';
    $('voice-overview').hidden=hidden;$('voice-detail').hidden=hidden;
    $('voice-marker-caption').hidden=hidden;
    $('voice-marker-count').textContent=`${markers.length} spike${markers.length===1?'':'s'}`;
    renderTrack('voice-overview',0,viewport.duration);
    renderTrack('voice-detail',viewport.start,viewport.length);
    $('voice-spikes-panel').hidden=hidden;
    const state=result?.state;
    $('voice-marker-note').textContent=state==='source_changed'?'Source changed — reanalyze to refresh voice markers.':
      state==='pending'?'Voice markers appear after this recording finishes analysis.':
      !result?'Loading voice markers…':
      `${state==='outdated'?'Earlier analysis · awaiting refresh. ':''}${result.audio_label||''} Click a pink marker or timestamp to review a clip with 10 seconds before the burst and 15 seconds afterward.`;
    const ordered=[...markers].sort($('voice-marker-sort').value==='time'?
      (a,b)=>a.time-b.time:(a,b)=>b.above_baseline_db-a.above_baseline_db||a.time-b.time);
    $('voice-spike-list').innerHTML=ordered.map(marker=>
      `<button data-voice-marker="${marker.id}" ${viewport.availability!=='online'?'disabled':''}>◆ ${label(marker)}</button>`).join('')||
      `<p class="muted small">${state==='current'||state==='outdated'?'No voice spikes detected in the analyzed games.':'Analysis has not supplied current voice markers yet.'}</p>`;
  }

  async function load(){
    const ident=viewport.video_id, generation=++revision;
    controller?.abort();controller=new AbortController();requestedAt=Date.now();
    try{
      const response=await fetch('/api/analysis-voice-marks?id='+ident,{signal:controller.signal});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||'Could not load voice markers');
      if(generation!==revision||viewport.video_id!==ident)return;
      result=data;render();
    }catch(error){
      if(generation!==revision||error.name==='AbortError')return;
      $('voice-marker-note').textContent=error.message;
    }
  }

  document.addEventListener('footage:timeline',event=>{
    const changed=viewport?.video_id!==event.detail.video_id;
    viewport=event.detail;
    if(changed){result=null;render();load();}
    else{render();if(Date.now()-requestedAt>=8000)load();}
  });
  $('voice-marker-sort').onchange=render;
  for(const id of ['voice-overview','voice-detail','voice-spike-list']){
    $(id).onclick=event=>{
      const button=event.target.closest('[data-voice-marker]');
      if(!button)return;
      event.stopPropagation();
      const marker=result?.markers.find(item=>item.id===button.dataset.voiceMarker);
      if(marker&&viewport.availability==='online')action(()=>reviewSourceRange(viewport.video_id,marker.start,marker.end));
    };
  }
  window.addEventListener('pagehide',()=>controller?.abort());
})();
