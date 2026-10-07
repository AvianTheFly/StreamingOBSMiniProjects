// Read-only presentation transport. Hidden documents own no request or timer;
// activation refreshes immediately, and late responses cannot repaint old state.
export function pollVisible({url, interval, onData, onError=()=>{}, onVisibility=()=>{}, timeout=3000}) {
  let disposed=false, pageShown=true, sourceVisible=true, active=false;
  let timer=0, request=null;
  const visible=()=>!disposed&&pageShown&&sourceVisible&&!document.hidden;
  function cancel() {
    clearTimeout(timer);timer=0;
    const old=request;request=null;old?.abort();
  }
  async function refresh() {
    if(!visible()||request)return;
    clearTimeout(timer);timer=0;
    const owned=new AbortController();request=owned;
    const deadline=setTimeout(()=>owned.abort(),timeout);
    try {
      const response=await fetch(url,{cache:'no-store',signal:owned.signal});
      if(!response.ok)throw Error(`HTTP ${response.status}`);
      const data=await response.json();
      if(owned.signal.aborted)throw Error('Request deadline exceeded');
      if(request===owned&&visible())onData(data);
    } catch(error) {
      if(request===owned&&visible())onError(error);
    } finally {
      clearTimeout(deadline);
      if(request===owned) {
        request=null;
        if(visible())timer=setTimeout(refresh,interval);
      }
    }
  }
  function sync() {
    const next=visible();
    if(next===active)return;
    active=next;
    if(!next)cancel();
    onVisibility(next);
    if(next)refresh();
  }
  const source=e=>{sourceVisible=e.detail?.visible!==false;sync();};
  const hide=()=>{pageShown=false;sync();};
  const show=()=>{pageShown=true;sync();};
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('obsSourceVisibleChanged',source);
  window.addEventListener('pagehide',hide);
  window.addEventListener('pageshow',show);
  onVisibility(false);sync();
  return {refresh,dispose() {
    if(disposed)return;
    disposed=true;cancel();onVisibility(false);
    document.removeEventListener('visibilitychange',sync);
    window.removeEventListener('obsSourceVisibleChanged',source);
    window.removeEventListener('pagehide',hide);
    window.removeEventListener('pageshow',show);
  }};
}
