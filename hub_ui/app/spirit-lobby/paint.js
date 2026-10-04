// Small authoring helpers for this scene's physical props and stage lighting.
export const TAU = Math.PI * 2;
export const clamp = (v,a=0,b=1) => Math.min(b,Math.max(a,v));
export function round(c,x,y,w,h,r,fill,stroke=null,line=1) {
  c.beginPath(); c.roundRect(x,y,w,h,r);
  if(fill){c.fillStyle=fill;c.fill();}
  if(stroke){c.strokeStyle=stroke;c.lineWidth=line;c.stroke();}
}
export function ellipse(c,x,y,rx,ry,color) { c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=color;c.fill(); }
export function glow(c,x,y,rx,ry,color,opacity=1) {
  c.save(); c.globalAlpha=opacity; c.translate(x,y); c.scale(1,ry/rx);
  const g=c.createRadialGradient(0,0,0,0,0,rx);g.addColorStop(0,color);g.addColorStop(1,'#00000000');
  c.fillStyle=g;c.fillRect(-rx,-rx,rx*2,rx*2);c.restore();
}
export function neon(c,text,x,y,size,color,maxWidth=900) {
  c.save();c.textAlign='center';c.textBaseline='middle';c.font=`700 ${size}px "Trebuchet MS", "Segoe UI", sans-serif`;
  const fitted=Math.min(size,size*maxWidth/Math.max(1,c.measureText(text).width));
  c.font=`700 ${fitted}px "Trebuchet MS", "Segoe UI", sans-serif`;
  c.shadowColor=color;c.shadowBlur=8;c.strokeStyle=color;c.lineWidth=1.7;c.strokeText(text,x,y);
  c.shadowBlur=3;c.fillStyle='#f1f6ff';c.fillText(text,x,y);c.restore();
}
export function shadow(c,x,y,w,h) { glow(c,x,y,w,h,'#020316df'); }
export function hash(n) {const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);}
export function smooth(a,b,v) {v=clamp((v-a)/(b-a));return v*v*(3-2*v);}
