let generation=0;
export async function mount(container) {
  const current=++generation;
  container.innerHTML='<div class="page-header"><div><div class="page-title">League API Alerts</div><div class="page-subtitle">Event explanations, media library, custom rules and live OBS volume</div></div></div><p id="alerts-loading">Connecting to the alert editor…</p>';
  if(current!==generation)return;
  container.querySelector('#alerts-loading').remove();
  const frame=document.createElement('iframe');frame.title='League API Alerts editor';
  frame.src='http://127.0.0.1:7431/';frame.style.cssText='width:100%;height:calc(100vh - 160px);min-height:650px;border:0;border-radius:10px;background:#0d141e';
  frame.addEventListener('error',()=>{
    if(current===generation) container.innerHTML='<p>The League API module did not start. Restart Run Hub.bat and reopen this page.</p>';
  });
  container.append(frame);
}
export function unmount(){generation++}
