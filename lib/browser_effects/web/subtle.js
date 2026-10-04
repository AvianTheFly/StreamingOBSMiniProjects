// Shared rendering mechanics only. The paths and story belong to each asset.
export const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
let edgeMask=null;
export function presentationEnvelope(t,duration=Infinity,{shortCue=false}={}){
 if(t<=0||t>=duration)return 0;
 const attack=shortCue&&duration<1.5?Math.min(.012,duration*.035):Math.min(.9,Math.max(.025,duration*.2));
 const release=shortCue&&duration<1.5?Math.min(.018,duration*.045):Math.min(.8,Math.max(.025,duration*.18));
 return smooth(t/attack)*smooth((duration-t)/release);
}
export class EdgeFinish{
 constructor(){
  if(edgeMask){this.mask=edgeMask;return;}
  this.mask=document.createElement('canvas');this.mask.width=1920;this.mask.height=1080;
  const c=this.mask.getContext('2d',{willReadFrequently:true}),pixels=c.createImageData(1920,1080);
  for(let y=0;y<1080;y++)for(let x=0;x<1920;x++){
   // Foreground art remains solid. Feather only the last strip next to gameplay;
   // glass, haze and trails choose their own alpha in their owning renderer.
   const side=1-smooth((Math.min(x,1919-x)-190)/50),top=1-smooth((y-132)/38),bottom=1-smooth((1079-y-190)/50);
   const i=(y*1920+x)*4;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=255;
   pixels.data[i+3]=Math.round(255*Math.max(side,top,bottom));
  }c.putImageData(pixels,0,0);edgeMask=this.mask;
 }
 apply(c,t,duration=Infinity,options={}){
  c.save();c.globalCompositeOperation='destination-in';
  c.globalAlpha=presentationEnvelope(t,duration,options);
  c.drawImage(this.mask,0,0);c.restore();
 }
}
export function trace(c,path,t,{color='#93d9ef',speed=.12,offset=0,width=1.6,tail=.19,alpha=1}={}){
 const head=((t*speed+offset)%1+1)%1,visibility=smooth(head/.045)*(1-smooth((head-.96)/.04));
 const inherited=c.globalAlpha;c.save();c.lineCap='round';c.lineJoin='round';
 for(let j=0;j<30;j++){
  const u=head-tail*(1-j/30),v=head-tail*(1-(j+1)/30);if(u<0)continue;
  const a=path(u),b=path(v);const base=inherited*alpha*visibility*(j/30)**2;
  c.globalAlpha=base;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();
 }
 const [x,y]=path(head);c.globalAlpha=inherited*alpha*visibility*.55;
 const g=c.createRadialGradient(x,y,0,x,y,12);g.addColorStop(0,color);g.addColorStop(1,color+'00');
 c.fillStyle=g;c.fillRect(x-12,y-12,24,24);c.globalAlpha=inherited*alpha*visibility;
 c.fillStyle='#e9f9ff';c.beginPath();c.arc(x,y,width*.8,0,Math.PI*2);c.fill();c.restore();
}

// Material surfaces share the existing border-mechanics module and lifecycle.
export const TAU=Math.PI*2;
// Feature-authored scenic cutouts: source rectangles, placement and motion are
// supplied by the presentation owner. Images and feathered crops decode once.
export class ScenicLayers{
 constructor(sources){this.images={};this.crops=new Map();this.ready=Promise.all(Object.entries(sources).map(async([key,src])=>{const im=new Image();im.src=src;await im.decode();this.images[key]=im;}));}
 draw(c,key,regions,t){const im=this.images[key];if(!im)return;for(let i=0;i<regions.length;i++){
  const r=regions[i],cacheKey=key+':'+JSON.stringify(r),[sx,sy,sw,sh]=r.source,[x,y,w,h]=r.target;
  let crop=this.crops.get(cacheKey);if(!crop){crop=document.createElement('canvas');crop.width=Math.ceil(w);crop.height=Math.ceil(h);const q=crop.getContext('2d',{willReadFrequently:true});q.drawImage(im,sx*im.width,sy*im.height,sw*im.width,sh*im.height,0,0,w,h);
   if(r.feather){q.globalCompositeOperation='destination-in';const g=q.createLinearGradient(0,0,r.horizontal?w:0,r.horizontal?0:h),f=r.feather;g.addColorStop(0,'#ffffff00');g.addColorStop(f,'#fff');g.addColorStop(1-f,'#fff');g.addColorStop(1,'#ffffff00');q.fillStyle=g;q.fillRect(0,0,w,h);}
   if(r.inner){q.globalCompositeOperation='destination-in';const g=q.createLinearGradient(0,0,w,0);g.addColorStop(0,r.inner==='left'?'#ffffff00':'#fff');g.addColorStop(r.inner==='left'?.15:.85,'#fff');g.addColorStop(1,r.inner==='right'?'#ffffff00':'#fff');q.fillStyle=g;q.fillRect(0,0,w,h);}this.crops.set(cacheKey,crop);}
  c.save();c.globalAlpha*=r.alpha??1;const amplitude=r.drift??0;
  if(amplitude){const steps=Math.ceil(h/12);for(let j=0;j<steps;j++){const yy=j*h/steps,hh=Math.min(h-yy,h/steps+1),offset=Math.sin(j*.21+t*(r.speed??.35)+(r.phase??0))*amplitude*Math.sin(j/steps*Math.PI);c.drawImage(crop,0,yy,w,hh,x+offset,y+yy,w,hh);}}
  else c.drawImage(crop,x,y,w,h);c.restore();
 }}
}
// Surface shading only: callers supply every contour and joint. No default frame.
export class FrameMaterial {
 constructor(c){this.c=c;this.o=new Optics(c);}
 panel(points,ink,accent,p,alpha=.85){
  const c=this.c,xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
  c.save();c.globalAlpha*=alpha;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
  const g=c.createLinearGradient(x,y,x+w*.65+1,y+h+1);g.addColorStop(0,accent);g.addColorStop(.065,ink);g.addColorStop(.4,ink);g.addColorStop(.68,accent+'a0');g.addColorStop(.78,ink);g.addColorStop(1,'#080d19');c.fillStyle=g;c.fill();
  c.strokeStyle='#02060b99';c.lineWidth=4;c.stroke();c.strokeStyle=accent+'bc';c.lineWidth=1.2;c.stroke();c.clip();
  const at=x-w*.55+p*w*2,shine=c.createLinearGradient(at,0,at+Math.max(20,w*.28),0);shine.addColorStop(0,'#ffffff00');shine.addColorStop(.5,'#e4faff43');shine.addColorStop(1,'#ffffff00');c.fillStyle=shine;c.fillRect(x,y,w,h);c.restore();
  this.o.line([points[0],points[1]],'#effcff',.8,alpha*.7);
 }
 band(path,width,ink,accent,p,alpha=.98){
  const c=this.c,n=64,left=[],right=[];c.save();c.globalAlpha*=alpha;
  for(let i=0;i<=n;i++){const u=i/n,[x,y]=path(u),v=path(Math.max(0,u-.003)),z=path(Math.min(1,u+.003)),dx=z[0]-v[0],dy=z[1]-v[1],d=Math.hypot(dx,dy)||1;left.push([x-dy/d*width/2,y+dx/d*width/2]);right.push([x+dy/d*width/2,y-dx/d*width/2]);}
  for(let i=0;i<n;i++){const l=left[i],r=right[i],g=c.createLinearGradient(...l,...r);g.addColorStop(0,accent+'d9');g.addColorStop(.1,accent+'72');g.addColorStop(.39,ink);g.addColorStop(.73,ink);g.addColorStop(.95,accent+'9c');g.addColorStop(1,accent+'2a');c.fillStyle=g;c.beginPath();c.moveTo(...l);c.lineTo(...left[i+1]);c.lineTo(...right[i+1]);c.lineTo(...r);c.closePath();c.fill();}
  this.o.line(left,accent,.8,.56);this.o.line(right,'#d6f6ff',.65,.23);this.o.light(path,p*1.2,accent,Math.min(3,width*.22),.25,.96);c.restore();
 }
 glass(points,color,p,alpha=.45){this.panel(points,'#15273352',color,p,alpha);}
 lights(path,p,color,offset=0,width=2){this.o.light(path,p*1.22-offset,color,width,.24,.94);}
}
// Raster atlases are self-contained presentation assets. Decode once per page;
// no timers, fetch loops, audio clocks or animation workers are created here.
export class SpriteAtlas {
 constructor(sources){this.images={};this.cells=new Map();this.ready=Promise.all(Object.entries(sources).map(async([key,src])=>{const image=new Image();image.src=src;await image.decode();this.images[key]=image;}));}
 draw(c,key,index,x,y,size,{angle=0,alpha=1,flip=false,stretch=1}={}){
  const im=this.images[key];if(!im)return;
  // Keep solid scenery outside the standard corner HUDs. Thin transparent
  // light is still free to reach the entire perimeter in the owning scene.
  if(y<170){x=Math.max(330,Math.min(1430,x));}
  else if(x<240){y=Math.min(685,Math.max(240,y));}
  else if(x>1680){y=Math.min(570,Math.max(245,y));}
  const w=im.naturalWidth/3,h=im.naturalHeight/3,g=2,cellKey=key+':'+index;
  let cell=this.cells.get(cellKey);
  if(!cell){
   cell=document.createElement('canvas');cell.width=cell.height=256;const q=cell.getContext('2d',{willReadFrequently:true});
   q.drawImage(im,(index%3)*w+g,Math.floor(index/3)*h+g,w-g*2,h-g*2,0,0,256,256);
   // Generated wisps can touch an atlas cell boundary. Feather the presentation
   // at that boundary so the alpha never reveals a rectangular sprite crop.
   q.globalCompositeOperation='destination-in';
   for(const vertical of [false,true]){const mask=q.createLinearGradient(0,0,vertical?0:256,vertical?256:0);mask.addColorStop(0,'#ffffff00');mask.addColorStop(.07,'#fff');mask.addColorStop(.9,'#fff');mask.addColorStop(1,'#ffffff00');q.fillStyle=mask;q.fillRect(0,0,256,256);}
   this.cells.set(cellKey,cell);
  }
  c.save();c.globalAlpha*=alpha;c.translate(x,y);c.rotate(angle);c.scale(flip?-1:1,stretch);
  c.drawImage(cell,-size/2,-size/2,size,size);c.restore();
 }
}
// Small material-independent drawing vocabulary. Feature renderers author all
// paths, particles and choreography; there is deliberately no default frame.
export class WorldPaint {
 constructor(c){this.c=c;this.o=new Optics(c);}
 line(path,color,width=1,alpha=.5){this.o.curve(path,color,width,alpha);}
 light(path,head,color,width=2,tail=.18,alpha=.9){this.o.light(path,head,color,width,tail,alpha);}
 mist(x,y,rx,ry,color,alpha=.3){const c=this.c;c.save();c.translate(x,y);c.scale(1,ry/rx);this.o.glow(0,0,rx,color,alpha);c.restore();}
 mote(x,y,r,color,alpha=1){const c=this.c;c.save();c.globalAlpha*=alpha;c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();c.restore();}
 star(x,y,r,color,alpha=1){const c=this.c;c.save();c.globalAlpha*=alpha;this.o.line([[x-r,y],[x+r,y]],color,.9);this.o.line([[x,y-r],[x,y+r]],color,.9);this.mote(x,y,1.4,'#fff5df');c.restore();}
 petal(x,y,r,color,angle=0,alpha=.7){const c=this.c;c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha*=alpha;const g=c.createLinearGradient(-r,0,r,0);g.addColorStop(0,color+'12');g.addColorStop(.45,color);g.addColorStop(1,'#ffe9ceaa');c.fillStyle=g;c.beginPath();c.moveTo(-r,0);c.quadraticCurveTo(0,-r*.7,r,0);c.quadraticCurveTo(0,r*.35,-r,0);c.fill();c.restore();}
 beam(points,color,width=1.2,alpha=.6){this.o.line(points,color,width,alpha);}
 field(path,edge,color,alpha=.3){
  const c=this.c,pts=Array.from({length:81},(_,i)=>path(i/80));c.save();c.globalAlpha*=alpha;
  c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
  if(edge==='bottom'){c.lineTo(pts.at(-1)[0],1080);c.lineTo(pts[0][0],1080);}
  else if(edge==='left'){c.lineTo(0,pts.at(-1)[1]);c.lineTo(0,pts[0][1]);}
  else{c.lineTo(1920,pts.at(-1)[1]);c.lineTo(1920,pts[0][1]);}
  c.closePath();const g=edge==='bottom'?c.createLinearGradient(0,1015,0,1080):edge==='left'?c.createLinearGradient(110,0,0,0):c.createLinearGradient(1810,0,1920,0);
  g.addColorStop(0,color+'00');g.addColorStop(.4,color+'1c');g.addColorStop(1,color+'b0');c.fillStyle=g;c.fill();c.restore();
 }
}
export const pathOf=pts=>u=>{const q=Math.max(0,Math.min(1,u))*(pts.length-1),i=Math.min(pts.length-2,Math.floor(q)),f=q-i;return [pts[i][0]+(pts[i+1][0]-pts[i][0])*f,pts[i][1]+(pts[i+1][1]-pts[i][1])*f];};
export class Optics{
 constructor(c){this.c=c;}
 line(pts,color,width=1.25,alpha=1){const c=this.c;c.save();c.globalAlpha*=alpha;c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();c.restore();}
 curve(path,color,width=1,alpha=1){this.line(Array.from({length:72},(_,i)=>path(i/71)),color,width,alpha);}
 light(path,head,color,width=1.7,tail=.19,alpha=1){
  const c=this.c,fade=smooth(head/.045)*(1-smooth((head-.97)/.07));if(!fade)return;
  c.save();c.globalAlpha*=alpha*fade;const inherited=c.globalAlpha;
  for(let j=0;j<24;j++){const a=head-tail*(1-j/24),b=head-tail*(1-(j+1)/24);if(a<0||b>1)continue;c.globalAlpha=inherited*(j/24)**2;this.line([path(a),path(b)],color,width);}
  const [x,y]=path(Math.min(1,head));c.globalAlpha=inherited;this.glow(x,y,12,color,.6);c.fillStyle='#f4fcff';c.beginPath();c.arc(x,y,width*.65,0,TAU);c.fill();c.restore();
 }
 glow(x,y,r,color,alpha=.25){const c=this.c;c.save();c.globalAlpha*=alpha;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color+'90');g.addColorStop(.3,color+'28');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);c.restore();}
 sheet(pts,color,p,{glass=false,alpha=1}={}){
  const c=this.c,xs=pts.map(v=>v[0]),ys=pts.map(v=>v[1]),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
  c.save();c.globalAlpha*=alpha;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
  const g=c.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,glass?'#e6f7ff35':'#cad9e2');g.addColorStop(.16,color+(glass?'4d':''));g.addColorStop(.44,glass?'#15233116':'#203041');g.addColorStop(.74,color+(glass?'26':'b0'));g.addColorStop(1,glass?'#101a2b08':'#101a2b');c.fillStyle=g;c.fill();
  c.clip();const at=x-w*.6+p*w*2.2,s=c.createLinearGradient(at,0,at+w*.28+8,0);s.addColorStop(0,'#ffffff00');s.addColorStop(.46,'#ffffff00');s.addColorStop(.53,'#ffffffab');s.addColorStop(1,'#ffffff00');c.fillStyle=s;c.fillRect(x-2,y-2,w+4,h+4);c.restore();
  this.line([...pts,pts[0]],color,.8,alpha*(glass?.62:.72));this.line([pts[0],pts[1]],'#eefaff',1.1,alpha*.88);
 }
 shard(x,y,r,color,p,angle=0,glass=true){const c=this.c;c.save();c.translate(x,y);c.rotate(angle);this.sheet([[0,-r],[r*.6,-r*.15],[r*.3,r*.7],[-r*.35,r],[-r*.5,-r*.25]],color,p,{glass});this.line([[0,-r],[0,r*.35],[-r*.35,r]],color,1,.42);c.restore();}
 arc(x,y,rx,ry,start,end,color,width=1,alpha=1,angle=0){const c=this.c;c.save();c.globalAlpha*=alpha;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.ellipse(x,y,rx,ry,angle,start,end);c.stroke();c.restore();}
 etch(x,y,pts,color,scale=1,angle=0){const c=this.c;c.save();c.translate(x,y);c.rotate(angle);c.scale(scale,scale);this.line(pts,'#070e18',4,.45);this.line(pts,color,1.5,.9);c.restore();}
 glint(x,y,color,weight=1){this.line([[x-4,y],[x+4,y]],color,.85,weight);this.line([[x,y-4],[x,y+4]],'#eefaff',.8,weight);}
 // A continuous lit surface, with a dark body, colored bounce and a sharp rim.
 // Geometry and timing are supplied by the presentation; no internal animation.
 ribbon(path,{width=24,color='#7ee5ee',secondary='#bca6ff',phase=0,twist=1.3,alpha=.8,glass=false,taper=true}={}){
  const c=this.c,n=64,points=[],left=[],right=[];
  for(let i=0;i<=n;i++){
   const u=i/n,[x,y]=path(u),a=path(Math.max(0,u-.002)),b=path(Math.min(1,u+.002)),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
   const fold=.28+.72*Math.abs(Math.sin(u*Math.PI*twist+phase)),tip=taper?Math.pow(Math.sin(Math.PI*u),.52):1,w=width*fold*tip;
   const nx=-dy/len,ny=dx/len;points.push([x,y]);left.push([x+nx*w/2,y+ny*w/2]);right.push([x-nx*w/2,y-ny*w/2]);
  }
  c.save();c.globalAlpha*=alpha;
  this.line(points,color,width*.8,.055);
  for(let i=0;i<n;i++){
   const l=left[i],r=right[i],ln=left[i+1],rn=right[i+1];if(Math.hypot(l[0]-r[0],l[1]-r[1])<.1)continue;
   const g=c.createLinearGradient(...l,...r),shine=.42+.3*Math.sin(i/n*7+phase);
   g.addColorStop(0,glass?'#e9ffffb8':'#e7ffff');g.addColorStop(.07,color+(glass?'90':'dd'));g.addColorStop(.24,glass?'#0d253333':'#10212dcc');g.addColorStop(shine,secondary+(glass?'48':'b0'));g.addColorStop(.88,color+(glass?'5d':'dd'));g.addColorStop(1,'#edffffac');
   c.fillStyle=g;c.beginPath();c.moveTo(...l);c.lineTo(...ln);c.lineTo(...rn);c.lineTo(...r);c.closePath();c.fill();
  }
  this.line(left,color,.95,.78);this.line(right,secondary,.7,.6);
  // Specular energy glides once along the object as the supplied phase evolves.
  this.light(path,phase/7,color,2.1,.24,.85);c.restore();
 }
 orb(x,y,r,color,phase=0,{glass=false,flat=1}={}){
  const c=this.c;c.save();c.translate(x,y);c.scale(1,flat);
  this.glow(0,0,r*2.8,color,.28);
  const g=c.createRadialGradient(-r*.34,-r*.36,r*.06,0,0,r);
  g.addColorStop(0,glass?'#f4ffffe0':'#f4ffff');g.addColorStop(.13,color+(glass?'6b':''));g.addColorStop(.46,glass?'#18425727':'#132d43');g.addColorStop(.76,color+(glass?'31':'ee'));g.addColorStop(.93,'#dafbffbc');g.addColorStop(1,color+'1a');
  c.fillStyle=g;c.beginPath();c.arc(0,0,r,0,TAU);c.fill();
  this.arc(0,0,r*.85,r*.88,3.2+phase*.07,4.95+phase*.07,'#f2ffff',1.6,.9);
  this.arc(0,0,r*.96,r*.96,.15,1.9,color,1,.85);c.restore();
 }
 facets(x,y,r,count,color,phase=0,{spread=1,angle=0}={}){
  const c=this.c;c.save();c.translate(x,y);c.rotate(angle);
  for(let i=0;i<count;i++){const a=i*TAU/count,rr=r*(.56+.11*Math.sin(i*2+phase));c.save();c.translate(Math.cos(a)*rr*spread,Math.sin(a)*rr*spread);c.rotate(a+phase*.025);this.sheet([[-r*.07,-r*.25],[r*.12,-r*.14],[r*.09,r*.2],[-r*.09,r*.27]],color,phase/7,{glass:i%3===0});c.restore();}c.restore();
 }
}
