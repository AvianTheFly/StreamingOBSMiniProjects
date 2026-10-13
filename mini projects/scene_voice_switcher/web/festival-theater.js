// One rotating vignette and one readable card; no timers, state queues or settings.
import {festivalBeat,themes,SHOW_SECONDS} from './festival-copy.js';
import {drawPayoff} from './festival-ink.js';
import {smooth} from './shared/world-motion.js';
export function intersects(a,b,pad=0){return a[0]<b[0]+b[2]+pad&&a[0]+a[2]+pad>b[0]&&a[1]<b[1]+b[3]+pad&&a[1]+a[3]+pad>b[1];}
export function theaterRect(holes=[]){
 for(const y of [922,758,36])for(const x of [48,1176,584]){const r=[x,y,696,126];if(!holes.some(h=>intersects(r,h,12)))return r;}
 return null;
}
function fit(c,text,max,start,min){let size=start;do{c.font=`600 ${size}px "Segoe UI",sans-serif`;if(c.measureText(text).width<=max)return size;}while(--size>=min);return size;}
export function drawFestival(c,time,id,holes=[],{reduced=false,pressure=0}={}){
 const beat=festivalBeat(id,time),rect=theaterRect(holes);if(!beat||!rect||pressure>=2)return null;
 const palette=themes[beat.theme],alpha=reduced?1:smooth(beat.age/1.1)*smooth((SHOW_SECONDS-beat.age)/1.2);
 const [x,y,w,h]=rect;c.save();c.translate(x,y+(reduced?0:(1-alpha)*9));c.globalAlpha*=alpha;
 // A dark glass plaque leaves the painting visible and supplies text contrast.
 c.fillStyle='#07131dec';c.strokeStyle=palette.color+'77';c.lineWidth=1;c.beginPath();c.roundRect(0,0,w,h,16);c.fill();c.stroke();
 c.fillStyle=palette.color;c.fillRect(0,29,3,68);
 c.save();c.translate(12,13);drawPayoff(c,beat.act,beat.theme,reduced?4:beat.age,palette);c.restore();
 c.fillStyle=palette.color;c.font='600 11px "Segoe UI",sans-serif';c.fillText(palette.name+'  /  '+(beat.line.startsWith('Chat:')?'CAMPFIRE QUESTION':'SIDE QUEST'),140,24);
 fit(c,beat.title,w-162,26,17);c.fillStyle='#f4f6ff';c.fillText(beat.title,140,58);
 fit(c,beat.line,w-162,17,12);c.fillStyle='#ced9e6';c.fillText(beat.line,140,88);
 c.fillStyle=palette.color+'33';c.fillRect(140,108,w-163,2);c.fillStyle=palette.color;c.fillRect(140,108,(w-163)*(1-beat.age/SHOW_SECONDS),2);
 c.restore();return {slot:beat.slot,title:beat.title,rect};
}
