// Original vector miniatures. Rasterized once per palette, then moved as sprites.
// Each realm is a small transparent illustration, never a full-screen backplate.
const TAU=Math.PI*2;
function path(c,points,fill,stroke){const p=new Path2D(points);if(fill){c.fillStyle=fill;c.fill(p);}if(stroke){c.strokeStyle=stroke;c.stroke(p);}}
function ellipse(c,x,y,rx,ry,fill){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=fill;c.fill();}
function line(c,points,color,width=2){c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function star(c,x,y,s,color){c.save();c.translate(x,y);path(c,`M0 ${-s} Q${s*.18} ${-s*.18} ${s} 0 Q${s*.18} ${s*.18} 0 ${s} Q${-s*.18} ${s*.18} ${-s} 0 Q${-s*.18} ${-s*.18} 0 ${-s}`,color);c.restore();}
function heart(c,color){path(c,'M0 75 C-25 44 -81 9 -70 -34 C-57 -73 -11 -71 0 -35 C12 -72 56 -73 71 -35 C87 8 26 51 0 75',color,'#fff5e6');}
function phoenix(c,a,b,w){
 for(const side of [-1,1]){
  c.save();c.scale(side,1);
  path(c,'M4 8 C-4 -41 -43 -69 -109 -81 C-93 -42 -58 -21 -15 24 C-45 7 -72 -9 -108 -26 C-80 23 -44 40 -9 37 L-3 72 L16 34 Z',a,w);
  for(let i=0;i<5;i++)path(c,`M${-9-i*5} ${6+i*5} Q${-68-i*9} ${-3-i*14} ${-99+i*6} ${-70+i*11}`,null,b);
  c.restore();
 }
 path(c,'M-11 25 Q-18 -13 -4 -35 L-14 -52 L4 -44 Q19 -39 13 -27 L26 -23 L12 -17 Q25 20 9 40 L2 77 L-8 51 Z',b,w);
 ellipse(c,7,-33,2,2,w);path(c,'M2 70 Q51 93 18 115 Q20 87 2 83 Q-22 118 -33 87 Q-9 99 2 70',a);
}
function ram(c,a,b,w){
 for(const side of [-1,1]){c.save();c.scale(side,1);
  path(c,'M-19 -38 C-58 -98 -122 -50 -94 10 C-78 38 -41 18 -48 -8 C-59 -30 -83 -16 -74 1 C-94 -17 -75 -43 -50 -30 L-29 -6 Z',a,w);
  for(let i=0;i<5;i++)line(c,[[-40-i*10,-51+i*4],[-50-i*10,-38+i*6]],b,2);
  c.restore();}
 path(c,'M-33 -37 L-45 8 L-27 65 L0 94 L27 65 L45 8 L33 -37 L0 -25 Z',b,w);
 path(c,'M-17 -2 L-5 42 L-17 57 L-30 4 Z',a);path(c,'M17 -2 L5 42 L17 57 L30 4 Z',a);
 line(c,[[-23,9],[-10,14]],w,3);line(c,[[23,9],[10,14]],w,3);path(c,'M-10 64 L0 75 L10 64 Z',w);
 star(c,0,-48,12,w);
}
function bear(c,a,b,w){
 ellipse(c,-45,-44,25,25,a);ellipse(c,45,-44,25,25,a);ellipse(c,-45,-44,14,14,b);ellipse(c,45,-44,14,14,b);
 path(c,'M-61 -36 Q-69 -7 -57 37 Q-37 77 0 79 Q37 77 57 37 Q69 -7 61 -36 Q0 -70 -61 -36',a,w);
 path(c,'M-53 -5 L-26 8 L-6 40 L-40 36 Z',b);path(c,'M53 -5 L26 8 L6 40 L40 36 Z',b);
 ellipse(c,0,43,31,24,w);ellipse(c,0,35,10,7,b);line(c,[[0,40],[0,53],[-9,58]],b);line(c,[[0,53],[9,58]],b);
 ellipse(c,-29,10,4,4,w);ellipse(c,29,10,4,4,w);star(c,0,-32,12,w);
}
function turtle(c,a,b,w){
 for(const side of [-1,1]){c.save();c.scale(side,1);path(c,'M-28 -6 Q-99 -48 -105 -17 Q-82 12 -48 33 L-18 10',a,w);path(c,'M-19 33 Q-70 43 -67 76 Q-40 73 -21 57',a,w);c.restore();}
 ellipse(c,0,-48,19,28,a);ellipse(c,0,17,54,67,b);c.strokeStyle=w;c.lineWidth=3;c.stroke();
 for(let i=0;i<6;i++){const angle=i*TAU/6;line(c,[[Math.cos(angle)*24,17+Math.sin(angle)*28],[Math.cos(angle)*51,17+Math.sin(angle)*62]],a,3);}
 path(c,'M0 -12 L25 2 L25 31 L0 45 L-25 31 L-25 2 Z',a,w);
 for(let i=-2;i<=2;i++){const x=i*15;line(c,[[x,20],[x,2],[x-5,-5]],w,1);ellipse(c,x-5,-7,5,3,a);}
 ellipse(c,-7,-54,2,2,w);ellipse(c,7,-54,2,2,w);
}
function butterfly(c,a,b,w){for(const side of [-1,1]){c.save();c.scale(side,1);path(c,'M0 -15 C-18 -58 -83 -113 -92 -64 C-107 -4 -42 19 -7 16 C-35 20 -91 48 -65 78 C-25 110 -11 48 0 22 Z',a,w);path(c,'M-10 -5 Q-64 -78 -75 -39 Q-59 3 -10 7',b);path(c,'M-10 26 Q-69 57 -43 65 Q-23 66 -10 26',b);c.restore();}line(c,[[0,45],[0,-37],[-15,-55]],w,3);line(c,[[0,-37],[15,-55]],w,2);}
function rose(c,a,b,w){
 line(c,[[0,100],[8,47],[-3,13]],a,4);path(c,'M3 68 Q49 34 51 68 Q32 93 3 68',a,w);path(c,'M4 45 Q-38 15 -44 46 Q-29 67 4 45',a,w);
 for(let i=7;i>=0;i--){c.save();c.rotate(i*2.4);path(c,`M0 9 Q${-64+i*4} ${-63+i*4} 0 ${-74+i*5} Q${63-i*4} ${-41+i*3} 0 9`,i%2?a:b,w);c.restore();}
 ellipse(c,0,-3,13,13,w);
}
function moon(c,a,b,w){
 c.save();ellipse(c,0,0,70,70,a);c.globalCompositeOperation='destination-out';ellipse(c,31,-22,63,65,'#000');c.restore();
 for(let i=0;i<7;i++)star(c,Math.cos(i*2.4)*95,Math.sin(i*2.4)*80,4+i%3,w);
 c.save();c.rotate(-.4);c.beginPath();c.ellipse(0,20,106,26,0,0,TAU);c.strokeStyle=b;c.lineWidth=2;c.stroke();c.restore();
}
function realm(c,index,a,b,w){
 const arch=new Path2D('M-112 109 L-112 -12 C-112 -162 112 -162 112 -12 L112 109 Z');
 c.save();c.clip(arch);
 const sky=c.createLinearGradient(0,-140,0,115);sky.addColorStop(0,b+'aa');sky.addColorStop(.65,'#162c3eaa');sky.addColorStop(1,a+'44');c.fillStyle=sky;c.fillRect(-115,-142,230,257);
 const scene=index%6;
 if(scene===4){
  ellipse(c,-34,-30,48,48,b);ellipse(c,50,28,25,25,a);c.strokeStyle=w+'aa';c.lineWidth=2;
  for(let i=0;i<3;i++){c.beginPath();c.ellipse(0,-12,96-i*14,31+i*12,-.5+i*.42,0,TAU);c.stroke();}
 }else{
  ellipse(c,45,-61,30,30,w);ellipse(c,45,-61,25,25,a);
  path(c,'M-122 33 L-77 -26 L-24 37 L28 -5 L87 42 L120 20 L120 112 L-120 112 Z','#102535');
  path(c,'M-118 66 L-51 20 L15 66 L61 36 L122 70 L122 116 L-122 116 Z',b+'88');
  if(scene===0){
   for(let i=0;i<10;i++){const x=-110+i*24,y=44+Math.sin(i*3)*13;path(c,`M${x} ${y-53} L${x-12} ${y} L${x+12} ${y} Z`,'#0b2533');line(c,[[x,y-10],[x,y+38]],'#0b2533',3);}
   const stream=c.createLinearGradient(0,44,0,118);stream.addColorStop(0,w);stream.addColorStop(1,a+'22');path(c,'M18 44 Q-26 67 12 81 Q66 93 -36 118 L20 118 Q100 87 30 78 Q-5 69 28 44 Z',stream);
  }
  if(scene===1){
   path(c,'M-56 69 L-56 -12 L-30 -12 L-30 -45 L0 -72 L30 -45 L30 -12 L56 -12 L56 69 Z','#11262e',w+'99');
   for(const x of [-43,-18,18,43])line(c,[[x,2],[x,67]],a,4);
   for(let i=0;i<4;i++)line(c,[[-72-i*8,73+i*9],[72+i*8,73+i*9]],w+'77',3);
  }
  if(scene===2){
   path(c,'M-118 33 Q-60 18 0 38 Q68 58 118 28 L118 119 L-118 119 Z',a+'aa');
   for(let i=0;i<6;i++){const y=48+i*12;c.strokeStyle=w+'88';c.beginPath();c.moveTo(-112,y);c.bezierCurveTo(-40,y-13,35,y+13,112,y);c.stroke();}
   path(c,'M-36 56 L0 20 L0 56 Z',w);line(c,[[2,11],[2,64]],b,3);path(c,'M-43 64 L39 64 L22 79 L-21 79 Z','#11262e',w);
  }
  if(scene===3){
   path(c,'M-126 103 L-43 -74 L20 51 L63 -29 L126 103 Z',a+'bb',w);
   path(c,'M-64 -26 L-43 -74 L-21 -26 L-36 -35 L-46 -19 L-56 -35 Z',w);
   for(let i=0;i<4;i++)path(c,`M-125 ${-93+i*12} Q-15 ${-145+i*17} 125 ${-56+i*6}`,null,b+'bb');
  }
  if(scene===5){
   path(c,'M-120 67 Q0 26 120 67 L120 119 L-120 119 Z','#133343');
   for(let i=0;i<9;i++){const x=-98+i*24,y=73+Math.sin(i*2)*18;line(c,[[x,112],[x,y]],a,2);for(let p=0;p<5;p++)ellipse(c,x+Math.cos(p*TAU/5)*7,y+Math.sin(p*TAU/5)*7,6,6,i%2?a:b);ellipse(c,x,y,3,3,w);}
  }
 }
 c.restore();c.strokeStyle=a+'bb';c.lineWidth=2;c.stroke(arch);
 for(let i=0;i<16;i++)star(c,-103+((i*73)%206),-118+((i*53)%230),i%3+1,w+'aa');
}

export class ArtAtlas{
 constructor(palette){this.palette=palette;this.cache=new Map();}
 get(kind,index=0){
  if(kind==='realm')index%=6;
  const key=kind+index;if(this.cache.has(key))return this.cache.get(key);
  const canvas=document.createElement('canvas');canvas.width=360;canvas.height=360;
  const c=canvas.getContext('2d');c.translate(180,175);c.lineJoin='round';c.lineCap='round';c.lineWidth=2;
  const [a,b,w]=this.palette;
  if(kind==='realm')realm(c,index,a,b,w);
  else{
   const glow=c.createRadialGradient(0,0,4,0,0,138);glow.addColorStop(0,a+'33');glow.addColorStop(1,a+'00');ellipse(c,0,0,138,138,glow);
   c.shadowColor=a;c.shadowBlur=8;
   ({phoenix,ram,bear,turtle,butterfly,rose,moon,heart})[kind]?.(c,a,b,w);
   c.shadowBlur=0;
   for(let i=0;i<10;i++)star(c,Math.cos(i*2.4)*123,Math.sin(i*2.4)*112,2+i%3,w+'99');
  }
  this.cache.set(key,canvas);return canvas;
 }
}
