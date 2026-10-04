// One document owns catalog refresh, four bounded media slots and their cleanup.
import {paintPanel} from './surfaces.js';
const defaults={main:'cosmos',left:'text',right:'text',booth:'text'};
const fields={main:'screenMain',left:'leftScreen',right:'rightScreen',booth:'boothScreen'};
export class ScreenContent {
  constructor(onChange=()=>{}){this.onChange=onChange;this.state={assets:[],selected:defaults,texts:{}};this.slots=new Map();this.controller=null;this.nextRefresh=0;this.disposed=false;this.suspended=false;}
  async load(){await this.refresh();return this;}
  async refresh(){
    if(this.disposed||this.controller)return;const controller=new AbortController();this.controller=controller;
    const timeout=setTimeout(()=>controller.abort(),10000);try{
      const r=await fetch('/api/spirit-lobby',{signal:controller.signal,cache:'no-store'});if(!r.ok)throw new Error('Screen library unavailable');
      const state=await r.json();if(!this.disposed&&this.controller===controller&&Array.isArray(state.assets)){this.state=state;this.onChange();}
    }catch{ /* Keep the last complete catalog and built-in visuals on a transient failure. */ }
    finally{clearTimeout(timeout);if(this.controller===controller)this.controller=null;this.nextRefresh=performance.now()+5000;}
  }
  effective(config){const value={...config};for(const [key,text] of Object.entries(this.state.texts||{}))if(typeof text==='string'&&!config.explicit.includes(key))value[key]=text;return value;}
  choice(target,config){const explicit=config[fields[target]];return explicit&&explicit!=='auto'?explicit:this.state.selected?.[target]||defaults[target];}
  tick(config){
    if(performance.now()>=this.nextRefresh&&!this.suspended)this.refresh();
    for(const target of Object.keys(defaults)){
      const active=config.layer==='foreground'?target==='booth':config.layer==='background'?target!=='booth':true;
      if(!active){const slot=this.slots.get(target);if(slot)this.release(slot);this.slots.delete(target);continue;}
      const id=this.choice(target,config),asset=this.state.assets.find(a=>a.id===id),old=this.slots.get(target);
      if(old?.id!==id){if(old)this.release(old);this.slots.delete(target);if(asset?.kind==='image'||asset?.kind==='video')this.open(target,asset);}
      const slot=this.slots.get(target);if(slot?.kind==='video'){
        if(config.paused||this.suspended)slot.media.pause();else if(slot.ready&&slot.media.paused)slot.media.play().catch(()=>{});
      }
    }
  }
  open(target,asset){
    const media=asset.kind==='video'?document.createElement('video'):new Image(),texture=document.createElement('canvas');
    texture.width=target==='main'?960:820;texture.height=target==='main'?360:target==='booth'?182:340;
    const slot={id:asset.id,kind:asset.kind,media,texture,ready:false};this.slots.set(target,slot);
    const ready=()=>{if(this.disposed||this.slots.get(target)!==slot)return;slot.ready=true;this.onChange();};
    if(asset.kind==='video'){media.muted=true;media.loop=true;media.playsInline=true;media.preload='auto';media.addEventListener('loadeddata',ready,{once:true});}
    else media.onload=ready;
    media.onerror=()=>{slot.ready=false;};media.src=asset.url;
  }
  paint(c,target){
    const slot=this.slots.get(target);if(!slot?.ready)return false;
    const {texture,media}=slot,p=texture.getContext('2d'),w=media.videoWidth||media.naturalWidth,h=media.videoHeight||media.naturalHeight;if(!w||!h)return false;
    p.fillStyle='#060912';p.fillRect(0,0,texture.width,texture.height);
    const scale=Math.min(texture.width/w,texture.height/h);p.drawImage(media,(texture.width-w*scale)/2,(texture.height-h*scale)/2,w*scale,h*scale);
    paintPanel(c,texture,target);return true;
  }
  release(slot){if(slot.kind==='video'){slot.media.pause();slot.media.removeAttribute('src');slot.media.load();}else{slot.media.onload=null;slot.media.onerror=null;slot.media.src='';}}
  suspend(value){this.suspended=value;if(value){this.controller?.abort();for(const slot of this.slots.values())if(slot.kind==='video')slot.media.pause();}}
  dispose(){this.disposed=true;this.controller?.abort();for(const slot of this.slots.values())this.release(slot);this.slots.clear();}
}
