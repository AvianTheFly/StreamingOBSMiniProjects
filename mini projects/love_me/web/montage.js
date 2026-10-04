// Film stills follow the lyric score's file clock; source-over preserves opacity.
import {clamp,audioFileTime} from './timeline.js';
const smooth=value=>{const p=clamp(value);return p*p*(3-2*p);};
export function montageAt(elapsed,row,count){
 const time=audioFileTime(elapsed,row)-(row.lyric_offset||0),cues=row.lyric_cues||[];
 const vocal=cues[0]?.start??audioFileTime(row.audio_anchor||0,row);
 const start=row.image_onset??vocal;
 const all=cues.find(cue=>cue.text.trim().toUpperCase()==='ALL');
 const where=cues.find(cue=>cue.text.trim().toUpperCase()==='WHERE');
 const turn=Math.max(vocal+.12,where?.end??vocal+2);
 const end=Math.max(turn+.2,all?.start??cues.find(cue=>cue.text.trim().toUpperCase()==='BEEN')?.end??vocal+5);
 const fast=row.reduced_motion?.25:.12,slow=row.reduced_motion?.35:.2;
 const fastCount=Math.ceil(Math.max(0,turn-start)/fast);
 const fastInterval=fastCount?(turn-start)/fastCount:fast;
 // A finite, non-repeating pass: never wrap back to earlier imagery.
 const unique=n=>Math.min(n,count-1);
 let index,previous,age,phase,interval;
 if(time<start||time>=end){
  return {time,index:0,previous:0,mix:0,incoming:0,outgoing:0,opacity:0,phase:'hidden',interval:0,end};
 }else if(time<turn){
  const n=Math.floor((time-start)/fastInterval+1e-8);index=unique(n);
  previous=n<count?unique(Math.max(0,n-1)):index;
  age=time-start-n*fastInterval;phase='where';interval=fastInterval;
 }else{
  const phraseStart=Math.max(start,turn),n=Math.floor((time-phraseStart)/slow+1e-8),slot=fastCount+n;
  index=unique(slot);previous=slot<count?unique(Math.max(0,slot-1)):index;
  age=time-phraseStart-n*slow;phase='phrase';interval=slow;
 }
 // Default motion enters on the hit itself, without an extra attack-ramp delay.
 const build=row.reduced_motion?smooth((time-start)/.08):1;
 const finish=time<=turn?1:clamp((end-time)/(end-turn))**2.2;
 // Original Love Me's montage input is 34.88%; its parent scene fades further.
 const opacity=clamp(row.opacity*(.3488/.72))*build*finish*
  Math.min(clamp(elapsed/.5),clamp((row.duration-elapsed)/.65));
 const overlap=row.reduced_motion?.15:phase==='where'?.05:.085;
 const mix=smooth(age/overlap),incoming=opacity*mix;
 const outgoing=opacity*(1-mix)/Math.max(.0001,1-incoming);
 return {time,index,previous,mix,incoming,outgoing,opacity,phase,interval,end};
}
export class MontageRenderer{
 constructor(canvas){this.c=canvas.getContext('2d');this.images=[];this.promise=null;}
 prepare(){
  if(!this.promise)this.promise=(async()=>{
   const response=await fetch(new URL('montage.json',import.meta.url));
   if(!response.ok)throw Error('Montage stills are missing. Run tools/install_mood_montage.py.');
   const manifest=await response.json(),shots=manifest.shots;
   if(!Array.isArray(shots)||shots.length<2||shots.length>40)throw Error('Invalid montage manifest.');
   const images=await Promise.all(shots.map(async shot=>{
    if(!/^shot-[a-z0-9-]+\.jpg$/.test(shot.file))throw Error('Invalid montage image name.');
    const image=new Image();image.src=new URL(shot.file,import.meta.url);await image.decode();return image;
   }));
   this.images=images;
  })();
  return this.promise;
 }
 draw(elapsed,row){
  if(!this.images.length)return;
  const score=montageAt(elapsed,row,this.images.length),c=this.c;
  if(!score.opacity)return;
  for(const [index,alpha] of [[score.previous,score.outgoing],[score.index,score.incoming]]){
   if(!alpha)continue;
   const image=this.images[index],motion=row.reduced_motion?0:1;
   const fit=Math.max(1920/image.width,1080/image.height)*(1.02+motion*.006*Math.sin(elapsed*.7+index));
   const width=image.width*fit,height=image.height*fit;
   const x=(1920-width)/2+motion*Math.sin(elapsed*.6+index)*8;
   const y=(1080-height)/2+motion*Math.cos(elapsed*.5+index)*5;
   c.save();c.globalAlpha=alpha;c.drawImage(image,x,y,width,height);c.restore();
  }
 }
}
