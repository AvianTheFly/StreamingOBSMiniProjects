let generation=0;
export async function mount(container) {
  const current=++generation;
  container.innerHTML='<div class="page-header"><div><div class="page-title">League production</div><div class="page-subtitle">Dragon atmosphere, objective celebrations and optional clip alerts</div></div></div><p id="alerts-loading">Connecting to production controls…</p>';
  if(current!==generation)return;
  container.querySelector('#alerts-loading').remove();
  const frame=document.createElement('iframe');frame.title='League production controls';
  frame.src='http://127.0.0.1:7431/production';frame.style.cssText='width:100%;height:calc(100vh - 160px);min-height:650px;border:0;border-radius:10px;background:#0d141e';
  frame.addEventListener('error',()=>{
    if(current===generation) container.innerHTML='<p>The League API module did not start. Restart Run Hub.bat and reopen this page.</p>';
  });
  container.append(frame);
}
export function unmount(){generation++}
