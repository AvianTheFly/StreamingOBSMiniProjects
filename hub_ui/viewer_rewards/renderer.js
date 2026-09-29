// A silent, bounded show. Only the outer edge of the gameplay canvas is painted.
const images=new Map();
function image(name){
 if(!images.has(name))images.set(name,new Promise((resolve,reject)=>{
  const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Sticker could not load'));
  img.src='/assets/'+encodeURIComponent(name);
 }));
 return images.get(name);
}
export class EffectShow{
 constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d');this.active=null;this.generation=0;}
 clear(){this.c.clearRect(0,0,1920,1080);}
 cancel(){this.generation++;if(this.active){cancelAnimationFrame(this.active.frame);this.active.resolve(false);this.active=null;}this.clear();}
 async play(effect){
  this.cancel();const generation=this.generation;
  const img=await Promise.race([image(effect.image),new Promise((_,reject)=>setTimeout(()=>reject(Error('Image timeout')),2000))]);
  if(this.generation!==generation)return false;
  const duration=Math.min(2000,Math.max(400,effect.duration));
  return new Promise(resolve=>{
   const run={resolve,frame:0,start:performance.now()};this.active=run;
   const tick=now=>{
    if(this.active!==run)return;
    const t=(now-run.start)/duration;
    if(t>=1){this.active=null;this.clear();resolve(true);return;}
    this.draw(t,effect,img);run.frame=requestAnimationFrame(tick);
   };run.frame=requestAnimationFrame(tick);
  });
 }
 draw(t,e,img){
  this.clear();const c=this.c,fade=Math.min(1,t*10,(1-t)*8),style=e.style||({bear:'pop'}[e.key]||e.key);
  c.save();c.beginPath();c.rect(0,0,1920,1080);c.rect(240,170,1440,670);c.clip('evenodd');
  c.globalAlpha=fade;const color=e.color||'#d97706',right=['oops','cannon','fear'].includes(style);
  const x=right?1788:132,y=128,beat=Math.sin(t*Math.PI*12);
  // Four short light strips, never a full-screen flash.
  c.strokeStyle=color;c.lineWidth=4;c.shadowColor=color;c.shadowBlur=12;
  for(const [cx,cy,dx,dy] of [[24,24,1,1],[1896,24,-1,1],[24,1056,1,-1],[1896,1056,-1,-1]]){
   c.beginPath();c.moveTo(cx+dx*100,cy);c.lineTo(cx,cy);c.lineTo(cx,cy+dy*65);c.stroke();
  }c.shadowBlur=0;
  for(let i=0;i<(style==='party'?40:14);i++){
   const side=i%4,along=(i*137+t*(style==='cannon'?500:150))%1800;
   const px=side<2?(side?1880:40):60+along,py=side<2?50+along*.52:(side===2?45:1035);
   c.save();c.translate(px,py);c.rotate(t*7+i);c.fillStyle=i%2?color:'#ffe9ae';
   if(style==='fear'){c.beginPath();c.moveTo(-5,-9);c.lineTo(5,-2);c.lineTo(-1,3);c.lineTo(4,10);c.lineTo(-7,0);c.fill();}
   else{c.fillRect(-3,-7,6,14);}c.restore();
  }
  c.save();c.translate(x,y+(style==='party'?beat*12:Math.sin(t*Math.PI)*-15));
  const scale=1+Math.sin(Math.min(1,t*4)*Math.PI)*.16;
  c.scale(scale,scale);c.rotate(style==='oops'?Math.sin(t*Math.PI*5)*.14:style==='party'?beat*.12:0);
  c.fillStyle='#101624';c.globalAlpha=fade*.82;c.beginPath();c.ellipse(0,0,90,87,0,0,Math.PI*2);c.fill();
  c.globalAlpha=fade;c.drawImage(img,-72,-72,144,144);
  c.strokeStyle=color;c.lineWidth=4;c.beginPath();c.arc(0,0,94,-Math.PI/2,-Math.PI/2+t*Math.PI*2);c.stroke();
  if(style==='calculated'){
   c.fillStyle='#b7f7dc';c.font='bold 23px monospace';c.fillText('✓',50,-53);c.font='15px monospace';c.fillText('100%',-28,78);
  }else if(style==='cannon'){
   c.fillStyle='#aab8cf';c.fillRect(-85,48,46,20);c.fillStyle='#ffe9ae';c.beginPath();c.arc(-35+t*100,57,7,0,7);c.fill();
  }else if(style==='fear'){
   c.strokeStyle='#ffe9ae';c.lineWidth=5;c.beginPath();c.moveTo(-48,-70);c.lineTo(0,-98);c.lineTo(48,-70);c.stroke();
  }else if(style==='oops'){
   c.fillStyle='#fff';c.font='bold 44px system-ui';c.fillText('!',52,-42);
  }else if(style==='party'){
   c.fillStyle=color;c.beginPath();c.moveTo(-30,-65);c.lineTo(0,-110);c.lineTo(30,-65);c.fill();
  }c.restore();
  if(e.label){
   c.font='bold 20px system-ui';const width=Math.min(390,c.measureText(e.label).width+32);
   c.fillStyle='#101624';c.fillRect(x-width/2,226,width,34);c.fillStyle=color;c.fillRect(x-width/2,226,4,34);
   c.fillStyle='#fff';c.textAlign='center';c.fillText(e.label,x,250,width-20);c.textAlign='start';
  }c.restore();
 }
}
