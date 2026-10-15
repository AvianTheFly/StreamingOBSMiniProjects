import {PaintedPatch} from '/shared/world-motion.js';
import {SPIRITS} from './loading-ceremony.js';
// Four 512px prepared painted spirits. Cancellation rejects late decodes; originals
// are released immediately, prepared surfaces on hide/exit. No runtime downloads.
export class LoadingArt{
  constructor(onReady){this.onReady=onReady;this.patches={};this.token=0;this.request=null;}
  load(){
    if(this.request)return;
    const request=this.request=new AbortController(),token=++this.token;
    for(const spirit of SPIRITS)(async()=>{
      let bitmap;
      try{
        const response=await fetch(`/champ-select/vfx/${spirit}.png`,{signal:request.signal});
        if(!response.ok)return;
        bitmap=await createImageBitmap(await response.blob(),{resizeWidth:512,resizeHeight:512,resizeQuality:'high'});
        if(request.signal.aborted||token!==this.token)return;
        this.patches[spirit]=new PaintedPatch(bitmap,[0,0,512,512],6,5);this.onReady();
      }catch{/* An unavailable painting retains the procedural ceremony. */}
      finally{bitmap?.close();}
    })();
  }
  dispose(){this.token++;this.request?.abort();this.request=null;for(const patch of Object.values(this.patches))patch.dispose();this.patches={};}
}
