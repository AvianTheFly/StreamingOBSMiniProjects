// File-time lyrics over transparent cinematic stills. No independent clock.
import {clamp,audioFileTime} from './timeline.js';
import {MontageRenderer} from './montage.js';
import {TypeInk} from './type-ink.js';
// Distinct installed Windows faces plus the bundled blackletter font.
export const faces=[
 '400 208px RubikDirt','700 206px SignalFraktur','900 204px Impact',
 '400 206px CourierPrime','400 202px RubikWetPaint','700 228px Gabriola',
 '400 204px RubikBurned','900 198px "Arial Black"','400 210px MetalMania',
 '700 200px "Segoe Script"','400 202px BungeeShade','600 212px Bahnschrift',
 '400 198px Eater','italic 700 206px Georgia','700 204px "MS Gothic"',
 '700 204px "Palatino Linotype"','italic 700 200px "Trebuchet MS"',
 '700 198px "Segoe Print"','700 198px "Franklin Gothic Medium"',
 'italic 700 216px "Times New Roman"','700 198px Consolas',
 'italic 700 206px Constantia','700 200px Cambria'
];
const bundled=['CourierPrime','RubikDirt','RubikWetPaint','RubikBurned','BungeeShade','MetalMania','Eater'];
export function lyricAt(elapsed,row){
 const time=audioFileTime(elapsed,row)-(row.lyric_offset||0);
 const cues=row.lyric_cues||[];let index=-1;
 for(let i=0;i<cues.length&&cues[i].start<=time;i++)index=i;
 const cue=cues[index];if(!cue||time>=cue.end)return {time,index,text:'',alpha:0,font:0};
 const age=time-cue.start,hold=row.hold_fade??.75;
 const alpha=Math.min(clamp(age/.035),clamp((cue.end-time)/.12),age<=hold?1:Math.max(.12,1-(age-hold)/.8));
 return {time,index,text:cue.text,alpha,font:row.reduced_motion?index%faces.length:(index+Math.floor(age/(row.font_interval??.12)))%faces.length};
}
export class SignalRenderer{
 constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d');this.montage=new MontageRenderer(canvas);this.ink=new TypeInk();this.loaded=false;this.promise=null;}
 prepare(){
  if(!this.promise)this.promise=Promise.all([
   this.montage.prepare(),
   ...bundled.map(name=>new FontFace(name,`url(${new URL(name+'-Regular.ttf',import.meta.url)})`).load().then(font=>document.fonts.add(font))),
   new FontFace('SignalFraktur',`url(${new URL('UnifrakturCook-Bold.ttf',import.meta.url)})`,{weight:'700'}).load().then(font=>document.fonts.add(font))
  ]).then(()=>{this.loaded=true;});
  return this.promise;
 }
 draw(elapsed,row){
  if(!this.loaded)return;
  const c=this.c,lyric=lyricAt(elapsed,row),fade=Math.min(clamp(elapsed/.25),clamp((row.duration-elapsed)/.65));
  this.montage.draw(elapsed,row);
  c.save();c.globalAlpha=row.opacity*fade;
  if(lyric.text&&lyric.alpha){
   c.save();c.beginPath();c.rect(160,8,1600,280);c.clip();
   c.translate(960,150);c.scale(row.scale,row.scale);c.globalAlpha*=lyric.alpha;
   c.shadowColor='#081117';c.shadowBlur=8;
   c.drawImage(this.ink.get(lyric.text,faces[lyric.font]),-720,-140);c.restore();
  }
  c.restore();
 }
}
