// Native perimeter presentation; playback/audio remain owned by playback.js.
import {RaveStage,artReady} from './rave.js';
export {artReady};
import {EdgeFinish} from './subtle.js';
export function choreography(t,duration){const progress=Math.max(0,Math.min(1,t/Math.max(.1,duration))),phase=progress<.18?0:progress<.42?1:progress<.78?2:3,starts=[0,.18,.42,.78],ends=[.18,.42,.78,1];return {progress,phase,local:(progress-starts[phase])/(ends[phase]-starts[phase])};}
export class BorderShow{
 constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d');this.finish=new EdgeFinish();this.rave=new RaveStage(this.c);this.ready=artReady;}
 clear(){this.c.clearRect(0,0,1920,1080);}
 draw(t,duration,effect){this.clear();if(t<0||t>=duration)return;const c=this.c;c.save();c.beginPath();c.rect(0,0,1920,1080);c.rect(240,170,1440,670);c.clip('evenodd');this.rave.draw(t,duration,effect,choreography(t,duration));c.restore();this.finish.apply(c,t,duration,{shortCue:true});}
}
