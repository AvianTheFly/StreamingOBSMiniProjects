// Bounded glyph cache: worn ink stays inside lettering, never over the montage.
export class TypeInk{
 constructor(){this.cache=new Map();}
 get(text,font){
  const key=text+'|'+font;if(this.cache.has(key))return this.cache.get(key);
  const canvas=document.createElement('canvas');canvas.width=1440;canvas.height=280;
  const c=canvas.getContext('2d');c.font=font;c.textAlign='center';c.textBaseline='middle';
  c.save();c.translate(720,140);const width=c.measureText(text).width;
  if(width>1360)c.scale(1360/width,1);
  c.fillStyle='#f2ede2';c.strokeStyle='#172126';c.lineWidth=3;
  c.strokeText(text,0,0);c.fillText(text,0,0);c.restore();
  let seed=2166136261;for(const ch of key)seed=Math.imul(seed^ch.charCodeAt(0),16777619);
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  c.globalCompositeOperation='destination-out';
  for(let i=0;i<480;i++){
   c.globalAlpha=.35+random()*.55;c.fillRect(random()*1440,35+random()*210,1+random()*4,.6+random()*2);
  }
  for(let i=0;i<22;i++){
   c.globalAlpha=.35;c.fillRect(random()*1440,35+random()*210,14+random()*80,.6+random()*1.3);
  }
  if(this.cache.size>=12)this.cache.delete(this.cache.keys().next().value);
  this.cache.set(key,canvas);return canvas;
 }
}
