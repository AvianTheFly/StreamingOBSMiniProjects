'use strict';
// Approximate background cues use the existing source navigation contract.
(() => {
  let viewport=null, result=null, revision=0, requestedAt=0, controller=null;
  function render(){
    if(!viewport)return;
    const markers=result?.markers||[];
    $('between-games-panel').hidden=!markers.length;
    $('between-games-list').innerHTML=markers.map((marker,index)=>
      `<button data-between-marker="${index}" ${viewport.availability!=='online'?'disabled':''}>${time(marker.start)}–${time(marker.end)}</button>`).join('');
  }
  async function load(){
    const ident=viewport.video_id, generation=++revision;
    controller?.abort();controller=new AbortController();requestedAt=Date.now();
    try{
      const response=await fetch('/api/analysis-between-marks?id='+ident,{signal:controller.signal});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||'Could not load between-game markers');
      if(generation!==revision||viewport.video_id!==ident)return;
      result=data;render();
    }catch(error){
      if(generation!==revision||error.name==='AbortError')return;
      $('between-games-panel').hidden=true;
    }
  }
  document.addEventListener('footage:timeline',event=>{
    const changed=viewport?.video_id!==event.detail.video_id;
    viewport=event.detail;
    if(changed){result=null;render();load();}
    else if(Date.now()-requestedAt>=8000)load();
  });
  $('between-games-list').onclick=event=>{
    const button=event.target.closest('[data-between-marker]');
    const marker=button&&result?.markers[Number(button.dataset.betweenMarker)];
    if(marker&&viewport.availability==='online')action(()=>reviewSourceRange(viewport.video_id,marker.start,Math.min(viewport.duration,marker.start+30)));
  };
  window.addEventListener('pagehide',()=>controller?.abort());
})();
