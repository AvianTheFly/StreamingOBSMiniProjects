'use strict';
// Small queue launcher. Detection, worker lifetime and persistence stay on the server.
(() => {
  let plan=null, busy=false, sourceId=null;
  const dialog=$('find-moments-dialog');
  function render(){
    const pending=plan?.pending_ids||[], eligible=plan?.eligible_ids||[];
    const blocked=busy||!plan||!!plan.missing_dependencies.length;
    $('find-current').disabled=blocked||!pending.includes(sourceId);
    $('find-new').disabled=blocked||!pending.length;
    $('find-new').textContent=pending.length?`Find in ${pending.length} new / changed recording${pending.length===1?'':'s'}`:'No new recordings to analyze';
    $('find-current-note').textContent=!sourceId?'Choose a recording to analyze it on its own.':
      !eligible.includes(sourceId)?'This recording is unavailable or shorter than 10 minutes.':
      !pending.includes(sourceId)?'This recording already has estimates. Review its timeline below.':'Use the recording you have open.';
    $('find-status').textContent=!plan?'Checking recordings…':plan.missing_dependencies.length?
      'Install the local detectors once: py -3.11 -m pip install -r footage_manager/requirements-analysis.txt':
      `${pending.length} ready to analyze · ${eligible.length-pending.length} already analyzed. Scan folders first if you just added footage.`;
  }
  async function open(){
    sourceId=selected?.id??null;plan=null;render();dialog.showModal();
    try{plan=await api('/api/analysis-plan');render();}
    catch(error){$('find-status').textContent=error.message;}
  }
  async function queue(ids){
    if(busy)return;
    busy=true;render();let failure='';
    try{
      await api('/api/analyze',{sample_seconds:60,audio:true,audio_track:'auto',only_new:true,...(ids?{ids}:{})});
      dialog.close();notify('Finding moments locally. Markers appear on the timeline as each recording finishes.');
      await refresh();
    }catch(error){failure=error.message;}
    finally{busy=false;render();if(failure)$('find-status').textContent=failure;}
  }
  $('find-moments').onclick=()=>action(open);
  $('find-current').onclick=()=>action(()=>queue([sourceId]));
  $('find-new').onclick=()=>action(()=>queue());
  $('find-details').onclick=()=>{dialog.close();$('show-analysis').click();};
})();
