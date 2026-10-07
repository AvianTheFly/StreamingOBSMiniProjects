// Live OBS documents consume short-lived cues through the existing Hub channel.
export class LiveActions {
  constructor(world,receive){this.world=world;this.receive=receive;this.source=null;this.seen=new Map();this.disposed=false;}
  start(){
    if(this.disposed||this.source||document.hidden)return;
    this.source=new EventSource('/api/events?events=living_lobby_action');
    this.source.onmessage=e=>{
      try{
        const message=JSON.parse(e.data),cue=message.payload,now=Date.now()/1000;
        if(message.type!=='living_lobby_action'||cue?.world!==this.world||typeof cue.id!=='string'||typeof cue.action!=='string'||!Number.isFinite(cue.issuedAt)||now-cue.issuedAt>4||now-cue.issuedAt<-.5||this.seen.has(cue.id))return;
        for(const [id,time] of this.seen)if(now-time>10)this.seen.delete(id);
        this.seen.set(cue.id,now);if(this.seen.size>128)this.seen.delete(this.seen.keys().next().value);
        this.receive(cue);
      }catch{ /* Unrelated or malformed Hub events are ignored. */ }
    };
  }
  stop(){this.source?.close();this.source=null;}
  dispose(){this.disposed=true;this.stop();this.seen.clear();}
}
