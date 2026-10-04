// A visible document owns one existing Hub event stream and bounded requests.
export class ActionLink {
  constructor(receive=()=>{}){this.receive=receive;this.source=null;this.pending=new Set();this.disposed=false;}
  start(){if(this.disposed||this.source||document.hidden)return;this.source=new EventSource('/api/events');this.source.onmessage=e=>{
    try{const message=JSON.parse(e.data),cue=message.payload;if(message.type==='spirit_lobby_action'&&cue&&Math.abs(Date.now()/1000-cue.issuedAt)<4)this.receive(cue);}catch{ /* Ignore unrelated malformed events. */ }
  };}
  async publish(cue){
    if(this.disposed||this.pending.size>=8)return {ok:false,reason:'Give the buttons a moment to catch up.'};
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);this.pending.add(controller);
    try{const response=await fetch('/api/spirit-lobby/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cue),signal:controller.signal});const result=await response.json();return response.ok?result:{ok:false,reason:result.error||'Live controls unavailable'};}
    catch{return {ok:false,reason:'Preview played; live delivery could not reach the Hub.'};}
    finally{clearTimeout(timer);this.pending.delete(controller);}
  }
  stop(){this.source?.close();this.source=null;for(const controller of this.pending)controller.abort();}
  dispose(){this.disposed=true;this.stop();}
}
