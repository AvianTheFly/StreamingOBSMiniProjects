import {ArtAtlas} from './art.js';
import {cueAt,clamp} from './timeline.js';
import {SignalRenderer} from './signal.js';
const TAU=Math.PI*2;
const shots={signal:['moon','ram','rose','butterfly','ram','phoenix','turtle','bear','rose','phoenix'],
 heart:['bear','heart','rose','bear','butterfly','heart'],golden:['phoenix','rose','butterfly','phoenix','ram','rose','phoenix','phoenix'],
 afterglow:['turtle','moon','butterfly','turtle','rose','moon']};
export class MoodRenderer{
 constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d');this.atlases=new Map();this.signal=new SignalRenderer(canvas);}
 prepare(row){return row.style==='signal'?this.signal.prepare():Promise.resolve();}
 clear(){this.c.clearRect(0,0,1920,1080);}
 draw(t,row){
  this.clear();if(row.style==='signal'){this.signal.draw(t,row);return;}const q=cueAt(t,row);if(!q.fade)return;
  const c=this.c,key=row.palette.join();if(!this.atlases.has(key))this.atlases.set(key,new ArtAtlas(row.palette));
  const atlas=this.atlases.get(key),[a,b,w]=row.palette;
  const motion=row.reduced_motion?0:1;
  c.save();
  // A strict perimeter mask protects the gameplay center and bottom HUD.
  c.beginPath();c.rect(0,0,1920,305);c.rect(0,305,290,550);c.rect(1630,305,290,550);c.clip();
  const side=row.position!=='top',x=side?(row.position==='left'?145:1775):960,y=side?470:152;
  c.translate(x,y);c.scale(row.scale,row.scale);c.globalAlpha=row.opacity*q.fade;
  const fade=row.reduced_motion?1:clamp(q.progress/.18),pulse=1+motion*.025*Math.sin(t*row.bpm/60*TAU);
  const sprite=row.style==='signal'&&q.phase!==2?shots[row.style][q.index%shots[row.style].length]:row.spirit;
  const realmY=side?0:16,realmW=side?242:350,realmH=side?282:292;
  c.save();c.globalAlpha*=row.style==='heart'?.25:.62;c.drawImage(atlas.get('realm',q.index),-realmW/2,realmY-realmH/2,realmW,realmH);c.restore();
  const orbit=motion*Math.sin(t*.7)*5;
  c.save();c.globalAlpha*=fade;c.translate(orbit,realmY+8);c.scale(pulse,pulse);
  const hero=side?280:345;
  c.drawImage(atlas.get(sprite),-hero/2,-hero/2,hero,hero);c.restore();
  // Two memory windows dissolve into different subjects on each cue.
  for(const dir of [-1,1]){
   c.save();const px=side?0:dir*330,py=side?dir*195:16;
   c.translate(px,py);c.rotate(motion*dir*(.045+.02*Math.sin(t*.35)));
   c.globalAlpha*=.55*(.65+.35*fade);
   const size=side?182:230;
   c.drawImage(atlas.get('realm',q.index+(dir<0?1:2)),-size/2,-size/2,size,size);
   c.globalAlpha*=.86;c.drawImage(atlas.get(shots[row.style][(q.index+(dir<0?1:2))%shots[row.style].length]),-size/2,-size/2,size,size);c.restore();
  }
  if(row.style==='heart'){
   for(const dir of [-1,1]){c.save();c.translate(dir*(side?85:145),-25+motion*Math.sin(t*1.3+dir)*12);c.rotate(dir*.15);c.globalAlpha*=.68;c.drawImage(atlas.get('heart'),-46,-46,92,92);c.restore();}
  }
  if(row.style==='golden'){
   c.save();c.globalAlpha*=.32;c.strokeStyle=w;c.lineWidth=2;c.beginPath();c.arc(0,16,side?106:128,Math.PI,TAU);c.stroke();
   for(let i=0;i<11;i++){const angle=Math.PI+i*Math.PI/10,r=side?118:146;c.beginPath();c.moveTo(Math.cos(angle)*r,16+Math.sin(angle)*r);c.lineTo(Math.cos(angle)*(r+11),16+Math.sin(angle)*(r+11));c.stroke();}c.restore();
  }
  if(row.style==='afterglow'){
   c.save();c.globalAlpha*=.6;c.translate(side?55:105,-55);c.rotate(motion*t*.018);c.drawImage(atlas.get('moon'),-58,-58,116,116);c.restore();
  }
  // Fine connecting light, localized bloom and drifting dust. No strobe.
  c.save();c.globalAlpha*=.4;c.strokeStyle=a;c.lineWidth=1;
  if(!side){c.beginPath();c.moveTo(-375,12);c.bezierCurveTo(-210,-43,210,52,375,12);c.stroke();}
  for(let i=0;i<24;i++){
   const px=side?Math.sin(i*5.3)*100:Math.sin(i*5.3)*450;
   const py=side?Math.cos(i*3.1)*300:Math.cos(i*3.1)*102;
   c.fillStyle=i%3?a:w;c.globalAlpha=row.opacity*q.fade*(.1+.22*(1+Math.sin(t*.8+i))/2);
   c.beginPath();c.arc(px+motion*Math.sin(t*.3+i)*10,py,1+i%2,0,TAU);c.fill();
  }c.restore();
  // Large serif word beats echo the reference; original closing copy is editable.
  const phrase=row.words[q.phase]||'';
  const words=phrase.split(/\s+/),intro=q.phase===0&&row.style==='signal';
  const wordIndex=Math.min(words.length-1,Math.floor(q.time/Math.max(.1,row.anchor)*words.length));
  const text=intro?words[wordIndex]:phrase;
  c.textAlign='center';c.textBaseline='middle';c.fillStyle=w;
  const maxWidth=side?235:850,base=side?24:(intro?60:38);
  c.font=`500 ${base}px Georgia, 'Times New Roman', serif`;
  const width=c.measureText(text).width;
  if(width>maxWidth)c.font=`500 ${base*maxWidth/width}px Georgia, 'Times New Roman', serif`;
  c.shadowColor='#070b20';c.shadowBlur=7;c.shadowOffsetY=2;
  c.fillText(text,0,side?-337:-141);c.shadowOffsetY=0;
  c.restore();
 }
}
