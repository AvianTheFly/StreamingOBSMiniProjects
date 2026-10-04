// Recovered September 30 / October 1 production art; only Arena is dispatched.
// Original authored title, scenery, cameras, ropes and spotlight choreography.
const legacyArenaPaint = (() => {
// Hand-drawn production art. No emoji glyphs, remote assets or wall-clock randomness.
// Every cue can be reconstructed from the audio position, including after a seek.
const THEMES={
 arena:['#ffcf65','#60c9ff','MAIN EVENT','crown'],
 crabs:['#ff805f','#48efdb','AFTER DARK • BEACH CLUB','palm'],
 disco:['#ff67cf','#8b80ff','MIDNIGHT GROOVE','disco'],
 coffin:['#bb9bff','#e6c66d','THE FINAL ENCORE','coffin'],
 party:['#ff79b7','#ffd36a','LET THE GOOD TIMES ROLL','gift'],
 balloons:['#ff79b7','#79e4ff','LET THE GOOD TIMES ROLL','balloon'],
 rats:['#b9a0ff','#96efb1','UNDERGROUND SESSION','speaker'],
 raccoon:['#50e9d1','#ffae78','SUNSET FIESTA','record'],
 shades:['#77bcff','#d9a3ff','LEVEL UP YOUR ENERGY','glasses'],
 racing:['#ff5479','#53e1ff','FULL THROTTLE','car'],
 equalizer:['#92ffba','#7a9aff','TURN IT ALL THE WAY UP','speaker'],
 cats:['#ff9cd5','#8dcaff','COSMIC CAT CLUB','planet'],
 nyan:['#ff9cd5','#87dfff','RAINBOW HYPERDRIVE','planet'],
 mash:['#ffd06a','#ff729d','THE BEAT TAKES OVER','bolt'],
 bonk:['#ffcf58','#ff79b6','CRITICAL COMEDY','mallet'],
 oops:['#b69aff','#6dd9ff','PLOT TWIST','cloud'],
 sparkles:['#91e8ff','#f8afff','ABSOLUTELY LEGENDARY','gem'],
 confetti:['#ffd06a','#ff79b7','THIS IS YOUR MOMENT','gift'],
 muffins:['#ffc779','#f78dc1','FRESH OUT OF THE BEAT','cupcake']
};
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
class ProductionDesign{
 constructor(c){this.c=c;}
 theme(style){return THEMES[style]||THEMES.party;}
 polygon(points,fill,stroke='#14152d',width=3){
  const c=this.c;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
  c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
 }
 ellipse(x,y,rx,ry,fill,stroke){const c=this.c;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=3;c.stroke();}}
 line(points,color,width=3){const c=this.c;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();}
 title(t,duration,label,style,scene){
  if(!label)return;const c=this.c,[a,b,kicker]=this.theme(style);
  const entrance=smooth(t/.65),exit=smooth((duration-t)/.4);
  c.save();c.globalAlpha*=entrance*exit;c.translate(960,77+(1-entrance)*-65);
  c.transform(1,0,-.13,1,0,0);const scale=1+(1-entrance)*.25+Math.sin(t*2)*.006;c.scale(scale,scale);
  c.font='900 78px Impact, "Arial Black", sans-serif';c.textAlign='center';c.textBaseline='alphabetic';
  const width=c.measureText(label).width,fit=Math.min(1,1220/Math.max(1,width));c.scale(fit,1);
  // Deep colored extrusion, ink silhouette, metallic face, then a travelling shine.
  c.lineJoin='round';c.lineWidth=9;c.strokeStyle='#111326';c.strokeText(label,0,0);
  for(let depth=8;depth>0;depth--){c.fillStyle=depth>4?b:a;c.fillText(label,depth,depth);}
  c.strokeStyle='#20162d';c.lineWidth=3;c.strokeText(label,0,0);
  const metal=c.createLinearGradient(0,-75,0,5);metal.addColorStop(0,'#ffffff');metal.addColorStop(.38,'#fff4df');metal.addColorStop(.42,a);metal.addColorStop(1,b);
  c.fillStyle=metal;c.fillText(label,0,0);
  const shine=c.createLinearGradient(-800+(t*.24%1)*1800,0,-560+(t*.24%1)*1800,0);
  shine.addColorStop(0,'#ffffff00');shine.addColorStop(.5,'#ffffffbb');shine.addColorStop(1,'#ffffff00');c.fillStyle=shine;c.fillText(label,0,0);c.restore();
  c.save();c.textAlign='center';c.font='700 13px Bahnschrift, sans-serif';c.letterSpacing='5px';c.fillStyle=b;c.globalAlpha*=entrance*exit;c.fillText(kicker,960,113);c.restore();
  // Animated ribbon swashes, rather than a rectangular title container.
  for(const side of [-1,1]){c.save();c.translate(960+side*690,65);c.scale(side,1);
   this.polygon([[0,0],[90,-7],[68,1],[92,8],[0,5]],a,null);this.line([[12,20],[100,12],[134,12]],b,2);c.restore();}
 }
 scenery(t,beat,style,scene){
  const c=this.c,[a,b]=this.theme(style),enter=smooth(t/.7);
  c.save();c.globalAlpha*=enter;c.lineCap='round';c.lineJoin='round';
  // Soft atmospheric pools terminate inside the perimeter. The main clip owns clipping.
  for(const [x,y]of [[40,70],[1880,70],[40,1010],[1880,1010]]){
   const g=c.createRadialGradient(x,y,0,x,y,230);g.addColorStop(0,a+'48');g.addColorStop(.55,b+'16');g.addColorStop(1,b+'00');c.fillStyle=g;c.fillRect(x-230,y-230,460,460);
  }
  const cosmic=['nyan','cats','sparkles','shades'].includes(style);
  const tropical=['crabs','raccoon'].includes(style);
  const concert=['disco','equalizer','mash','rats'].includes(style);
  for(const side of [-1,1]){
   c.save();c.translate(side===-1?105:1815,955);c.scale(side===-1?1:-1,1);
   if(tropical){
    for(let j=0;j<3;j++){c.beginPath();c.moveTo(-110,38+j*18);c.bezierCurveTo(-30,-8+j*18,35,66+j*18,115,12+j*18);c.strokeStyle=j%2?a:b;c.lineWidth=3;c.stroke();}
    c.translate(0,-52);c.scale(1.3,1.3);this.prop('palm',t,0,a,b);
   }else if(style==='racing'){
    for(let j=0;j<11;j++)this.polygon([[-90,j*-60],[90,j*-60-70],[90,j*-60-48],[-90,j*-60+22]],j%2?a+'33':b+'22',null);
    for(let j=0;j<6;j++)for(let k=0;k<3;k++)c.fillStyle=(j+k)%2?'#fff3dd':'#191b30',c.fillRect(-65+k*28,-810+j*28,28,28);
   }else if(concert){
    for(let j=0;j<8;j++){const h=30+85*(.5+.5*Math.sin(beat*2+j*.65));const g=c.createLinearGradient(0,0,0,-h);g.addColorStop(0,b+'22');g.addColorStop(1,a);c.fillStyle=g;c.fillRect(-88+j*22,0,12,-h);}
    this.line([[-90,-150],[-90,-770],[90,-770],[90,-150]],b+'88',3);
    for(let j=0;j<8;j++){this.line([[-90,-150-j*78],[90,-228-j*78]],a+'33',2);this.ellipse(-90,-150-j*78,5,5,a);}
   }else if(cosmic){
    for(let j=0;j<16;j++){const y=-j*54+(t*25+j*11)%54,x=Math.sin(j*14)*82;this.ellipse(x,y,1+j%3,1+j%3,j%2?a:b);}
    c.save();c.translate(0,-720);c.rotate(t*.15);this.prop(style==='sparkles'?'gem':'planet',t,0,a,b);c.restore();
   }else if(style==='coffin'){
    for(let j=0;j<4;j++){const x=-75+j*50;this.polygon([[x-9,0],[x-9,-520],[x,-554],[x+9,-520],[x+9,0]],'#201c39',b+'66',2);this.ellipse(x,-565,6,14,a);}
   }else if(['bonk','oops'].includes(style)){
    for(let j=0;j<14;j++){const y=-j*55;this.line([[-80,y],[-25,y-16],[20,y+4],[75,y-12]],j%2?a+'44':b+'44',3);}
   }else{
    for(let j=0;j<7;j++){c.save();c.translate(Math.sin(j*8)*65,-j*108);c.rotate(Math.sin(t+j)*.2);this.prop(j%2?'ribbon':'balloon',t,j,a,b);c.restore();}
   }c.restore();
  }
  // Story-specific secondary props; different silhouettes enter on staggered cues.
  const menus={arena:['crown','ticket','bolt','crown'],crabs:['shell','palm','bubble','shell'],disco:['record','disco','speaker','record'],coffin:['rose','coffin','wing','rose'],party:['gift','balloon','ribbon','gift'],balloons:['gift','balloon','ribbon','balloon'],rats:['cheese','speaker','record','cheese'],raccoon:['record','palm','maraca','record'],shades:['glasses','bolt','gem','glasses'],racing:['wheel','car','bolt','wheel'],equalizer:['speaker','bolt','record','speaker'],nyan:['rocket','planet','comet','rocket'],cats:['planet','comet','rocket','planet'],mash:['bolt','speaker','ribbon','bolt'],bonk:['mallet','burst','bolt','burst'],oops:['cloud','bubble','cloud','bubble'],sparkles:['gem','wing','comet','gem'],confetti:['gift','ribbon','balloon','gift'],muffins:['cupcake','whisk','cherry','cupcake']};
  const menu=menus[style]||menus.party;
  const slots=[[110,235],[1810,330],[110,675],[1810,785],[360,985],[1570,985]];
  slots.forEach(([x,y],i)=>{const reveal=smooth((t-i*.065)/.55);c.save();c.translate(x+(x<960?-1:1)*(1-reveal)*150,y+Math.sin(t*1.7+i)*12);c.scale(reveal,reveal);c.rotate(Math.sin(t*.9+i)*.09);this.prop(menu[(i+scene.phase)%menu.length],t,i,a,b);c.restore();});
  // Sweeping curved comet ribbons weave through the top/bottom rather than laps.
  for(const y of [145,1050])for(let j=0;j<3;j++){
   c.beginPath();for(let x=260;x<=1660;x+=16){const yy=y+Math.sin(x/210-t*1.3+j*.5)*9+j*4;c.lineTo(x,yy);}c.strokeStyle=(j%2?a:b)+(j===0?'99':'33');c.lineWidth=j===0?2:1;c.stroke();
  }
  // Small localized fireworks: bloom, hang, drift and dissolve; finale adds more.
  const count=scene.phase===3?10:6;
  for(let i=0;i<count;i++){
   const life=(t*.38+i*.173)%1,originX=i%2?1795:125,originY=170+((i*167)%720);
   c.save();c.globalAlpha*=Math.sin(life*Math.PI)*.8;
   for(let j=0;j<9;j++){const angle=j*Math.PI*2/9+i;const r=12+life*(scene.phase===3?95:65);this.line([[originX+Math.cos(angle)*r,originY+Math.sin(angle)*r+life*life*22],[originX+Math.cos(angle)*(r+9),originY+Math.sin(angle)*(r+9)+life*life*22]],j%2?a:b,2);}
   c.restore();
  }c.restore();
 }
 prop(kind,t,i,a,b){
  const c=this.c;c.save();c.lineJoin='round';c.lineCap='round';
  const metal=c.createLinearGradient(-60,-65,60,65);metal.addColorStop(0,'#fff4df');metal.addColorStop(.32,a);metal.addColorStop(1,b);
  const ink='#19182f';
  if(kind==='planet'){
   this.ellipse(0,0,39,39,metal,ink);c.save();c.rotate(-.35);c.beginPath();c.ellipse(0,0,66,16,0,0,Math.PI*2);c.strokeStyle=b;c.lineWidth=7;c.stroke();c.restore();this.ellipse(-12,-15,9,5,'#ffffff77');
  }else if(kind==='rocket'){
   c.rotate(.35+Math.sin(t)*.1);this.polygon([[-13,27],[0,-65],[13,27]],metal);this.polygon([[-13,12],[-33,40],[-10,32]],b);this.polygon([[13,12],[33,40],[10,32]],a);this.ellipse(0,-14,10,14,'#213b67','#fff2df');this.polygon([[-9,32],[0,65+Math.sin(t*12+i)*12],[9,32]],a,null);
  }else if(kind==='palm'){
   this.polygon([[-9,62],[7,62],[1,-23],[-9,-25]],'#e0aa75');
   for(let j=0;j<5;j++){const angle=-Math.PI+j*Math.PI/4;c.save();c.translate(-4,-30);c.rotate(angle);this.polygon([[0,0],[35,-20],[70,4],[31,-3]],j%2?a:b,ink,2);c.restore();}
  }else if(kind==='car'){
   this.polygon([[-75,20],[-64,-4],[-28,-12],[-13,-35],[34,-35],[51,-10],[73,-2],[78,25]],metal);this.polygon([[-16,-15],[-5,-29],[28,-29],[43,-12]],'#243753','#b1faff');for(const x of [-43,45]){this.ellipse(x,23,18,18,ink);this.ellipse(x,23,9,9,b);}this.line([[-66,8],[-47,8]],'#fff5d7',5);this.line([[56,8],[70,8]],a,5);
  }else if(kind==='wheel'){
   this.ellipse(0,0,43,43,ink,a);this.ellipse(0,0,28,28,'#40566c',b);for(let j=0;j<5;j++){const angle=t*3+j*Math.PI*2/5;this.line([[0,0],[Math.cos(angle)*27,Math.sin(angle)*27]],'#eff8ff',4);}this.ellipse(0,0,7,7,a);
  }else if(kind==='disco'){
   this.line([[0,-95],[0,-45]],b,2);this.ellipse(0,0,48,48,metal,ink);c.save();c.beginPath();c.arc(0,0,47,0,Math.PI*2);c.clip();for(let y=-45;y<45;y+=13)for(let x=-45;x<45;x+=13){c.fillStyle=(Math.floor(x/13)+Math.floor(y/13))%2?b:a;c.globalAlpha=.3+.5*(.5+.5*Math.sin(t*2+x));c.fillRect(x+1,y+1,10,10);}c.restore();this.line([[-15,-29],[-15,-11]],'#ffffff',3);
  }else if(kind==='record'){
   this.ellipse(0,0,47,47,ink,b);for(const r of [22,31,39]){c.beginPath();c.arc(0,0,r,.3+t,4.6+t);c.strokeStyle='#8491aa77';c.lineWidth=1;c.stroke();}this.ellipse(0,0,15,15,a);this.ellipse(0,0,4,4,ink);
  }else if(kind==='speaker'){
   this.polygon([[-38,-58],[38,-58],[38,58],[-38,58]],'#22243c',b);this.ellipse(0,20,27,27,ink,a);this.ellipse(0,20,14+Math.sin(t*9+i)*2,14+Math.sin(t*9+i)*2,metal);this.ellipse(0,-30,13,13,ink,b);for(const side of [-1,1]){c.beginPath();c.arc(0,20,55,side===1?-.5:Math.PI-.5,side===1?.5:Math.PI+.5);c.strokeStyle=a+'88';c.lineWidth=3;c.stroke();}
  }else if(kind==='glasses'){
   this.polygon([[-68,-20],[-8,-20],[-15,23],[-52,23]],'#182942',b,5);this.polygon([[8,-20],[68,-20],[52,23],[15,23]],'#182942',a,5);this.line([[-8,-11],[8,-11]],'#f5edff',5);this.line([[-50,10],[-28,-9]],'#9bedff',4);this.line([[25,10],[47,-9]],'#e5bbff',4);
  }else if(kind==='gem'){
   this.polygon([[-45,-20],[-25,-44],[25,-44],[45,-20],[0,53]],metal);this.line([[-45,-20],[45,-20],[0,53],[-17,-20],[-25,-44]],'#fff9ff',2);this.line([[25,-44],[17,-20],[0,53]],b,2);
  }else if(kind==='crown'){
   this.polygon([[-51,-28],[-30,-9],[0,-50],[30,-9],[51,-28],[40,37],[-40,37]],metal);this.line([[-40,23],[40,23]],'#fff5b7',4);for(const x of [-24,0,24])this.ellipse(x,12,5,7,b);
  }else if(kind==='bolt')this.polygon([[0,-64],[-38,9],[-5,9],[-17,60],[41,-17],[8,-17],[27,-64]],metal);
  else if(kind==='coffin'){
   this.polygon([[-23,-60],[23,-60],[40,-33],[25,60],[-25,60],[-40,-33]],'#302340',a,4);this.polygon([[-17,-49],[17,-49],[29,-29],[17,49],[-17,49],[-29,-29]],'#544267',b,2);this.line([[0,-29],[0,18]],a,5);this.line([[-15,-13],[15,-13]],a,5);
  }else if(kind==='balloon'){
   this.ellipse(0,-18,31,42,metal,ink);this.polygon([[-6,24],[6,24],[0,33]],b);c.beginPath();c.moveTo(0,33);c.bezierCurveTo(22,47,-18,57,5,77);c.strokeStyle='#ffe8fa';c.lineWidth=2;c.stroke();this.ellipse(-11,-34,6,13,'#ffffff88');
  }else if(kind==='gift'){
   this.polygon([[-40,-24],[40,-24],[40,45],[-40,45]],metal);this.polygon([[-46,-35],[46,-35],[46,-18],[-46,-18]],b);c.fillStyle='#fff1d9';c.fillRect(-6,-35,12,80);for(const side of [-1,1]){c.beginPath();c.ellipse(side*18,-47,22,11,side*.5,0,Math.PI*2);c.strokeStyle=a;c.lineWidth=6;c.stroke();}
  }else if(kind==='cheese'){
   this.polygon([[-48,33],[48,33],[35,-30],[-48,0]],'#ffd874');this.polygon([[-48,0],[35,-30],[48,-8],[48,33]],metal);for(const [x,y,r]of [[-26,17,8],[12,19,10],[28,-4,6]])this.ellipse(x,y,r,r,'#df943f');
  }else if(kind==='mallet'){
   c.rotate(-.4+Math.sin(t*6)*.35);this.polygon([[-7,-12],[7,-12],[7,63],[-7,63]],'#d19b71');this.polygon([[-50,-54],[50,-54],[50,-10],[-50,-10]],metal);this.line([[-38,-45],[32,-45]],'#fff9df',4);
  }else if(kind==='cloud'){
   for(const [x,y,r]of [[-29,0,25],[0,-18,33],[31,0,24]])this.ellipse(x,y,r,r,metal);this.line([[-12,3],[-4,8],[4,3]],ink,3);this.line([[-28,38],[-35,53]],b,5);this.line([[28,38],[21,53]],b,5);
  }else if(kind==='bubble'){
   this.ellipse(0,0,30,30,a+'22',b);c.beginPath();c.arc(0,0,23,3.5,4.7);c.strokeStyle='#fff';c.lineWidth=3;c.stroke();
  }else if(kind==='shell'){
   this.polygon([[-48,0],[-40,-28],[-22,-44],[0,-48],[22,-44],[40,-28],[48,0],[15,32],[-15,32]],metal);for(let j=-2;j<=2;j++)this.line([[j*18,-34],[j*5,25]],'#fff4d4',2);
  }else if(kind==='wing'){
   for(let j=0;j<5;j++)this.polygon([[0,20],[55-j*5,-45+j*13],[65-j*5,-28+j*14],[16,30]],j%2?a:'#fff1ed',b,2);
  }else if(kind==='rose'||kind==='cherry'){
   this.line([[0,45],[0,-10],[19,-35]],'#70c994',4);this.ellipse(-12,2,22,20,kind==='rose'?a:'#ff5c83',ink);this.ellipse(17,7,22,20,b,ink);if(kind==='rose')this.ellipse(0,-12,18,18,'#ff93bc',ink);
  }else if(kind==='maraca'){
   c.rotate(Math.sin(t*8)*.3);this.polygon([[-5,0],[5,0],[5,62],[-5,62]],'#ffc78d');this.ellipse(0,-20,24,34,metal,ink);this.line([[-22,-23],[22,-23]],b,8);
  }else if(kind==='cupcake'){
   this.polygon([[-33,0],[33,0],[24,42],[-24,42]],b);for(let j=0;j<3;j++)this.ellipse(-22+j*22,-9,20,23,metal);this.ellipse(0,-35,16,14,a);this.ellipse(0,-51,6,6,'#ff507b');
  }else if(kind==='whisk'){
   c.rotate(.4);this.line([[0,20],[0,65]],b,10);for(const r of [8,17,25]){c.beginPath();c.ellipse(0,-15,r,37,0,0,Math.PI*2);c.strokeStyle='#fff0dc';c.lineWidth=2;c.stroke();}
  }else if(kind==='ticket'){
   this.polygon([[-54,-28],[54,-28],[54,28],[-54,28]],metal);this.line([[25,-20],[25,20]],ink,2);c.fillStyle=ink;c.font='900 18px Impact';c.textAlign='center';c.fillText('VIP',-12,7);
  }else if(kind==='comet'){
   this.polygon([[-70,40],[20,-25],[-30,42]],b+'66',null);this.polygon([[-65,20],[25,-24],[-26,29]],a+'aa',null);this.ellipse(25,-24,12,12,'#fff5e6');
  }else if(kind==='burst'){
   const points=[];for(let j=0;j<24;j++){const angle=j*Math.PI/12,r=j%2?28:55;points.push([Math.cos(angle)*r,Math.sin(angle)*r]);}this.polygon(points,metal);c.fillStyle=ink;c.font='900 43px Impact';c.textAlign='center';c.fillText('!',0,15);
  }else if(kind==='ribbon'){
   c.beginPath();c.moveTo(-55,-20);c.bezierCurveTo(-15,-75,13,75,55,10);c.strokeStyle=b;c.lineWidth=9;c.stroke();c.beginPath();c.moveTo(-55,-24);c.bezierCurveTo(-15,-79,13,71,55,6);c.strokeStyle=a;c.lineWidth=3;c.stroke();
  }c.restore();
 }
}

class ArenaPerformance {
 constructor(c){this.c=c;this.design=new ProductionDesign(c);}
 star(x,y,r,color,angle=0){
  const c=this.c;c.save();c.translate(x,y);c.rotate(angle);c.fillStyle=color;c.beginPath();
  for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=i%2?r*.42:r;c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();c.fill();c.restore();
 }
 position(p){
  // Constant-speed laps along the outer edge; no teleports between sides.
  const w=1740,h=900,d=((p%1+1)%1)*2*(w+h);
  if(d<w)return{x:90+d,y:90,angle:0};
  if(d<w+h)return{x:1830,y:90+d-w,angle:Math.PI/2};
  if(d<2*w+h)return{x:1830-(d-w-h),y:990,angle:Math.PI};
  return{x:90,y:990-(d-2*w-h),angle:-Math.PI/2};
 }

 camera(x,y,t,i,scene){
  const c=this.c;c.save();c.translate(x,y);c.rotate(Math.sin(t*1.4+i)*.12);
  c.fillStyle='#252840';c.strokeStyle='#98d5ff';c.lineWidth=3;c.fillRect(-26,-16,52,34);c.strokeRect(-26,-16,52,34);c.fillRect(-17,-25,18,9);
  c.fillStyle='#a8e9ff';c.beginPath();c.arc(0,0,12,0,7);c.fill();c.fillStyle='#233253';c.beginPath();c.arc(0,0,7,0,7);c.fill();
  c.fillStyle='#ffeeb4';c.fillRect(16,-12,6,5);
  // Separate paparazzi bursts, never a full-screen strobe.
  const flash=Math.max(0,1-((t*.85+i*.29)%1)*8)*(scene.phase===0?.25:1);
  if(flash){c.save();c.globalAlpha*=flash;this.star(20,-10,22,'#fff8da',Math.PI/4);c.restore();}
  c.restore();
 }
 arena(t,beat,pulse,color,scene){
  const c=this.c;
  // Ring ropes travel through blue, gold and pink as the entrance builds.
  c.strokeStyle=color;c.lineWidth=3;
  for(const x of [32,55,78,1842,1865,1888]){c.beginPath();c.moveTo(x,210);c.lineTo(x,870);c.stroke();}
  for(const y of [1000,1022,1044]){c.beginPath();c.moveTo(240,y);c.lineTo(1680,y);c.stroke();}
  const cameras=12;
  for(let i=0;i<cameras;i++){const p=this.position(i/cameras);this.camera(p.x,p.y,t,i,scene);}
  for(const x of [120,1800]){
   c.save();c.translate(x,260+250*Math.sin(scene.progress*Math.PI)**2);c.rotate(Math.sin(beat*Math.PI)*.08);c.fillStyle='#9b7021';c.fillRect(-70,-24,140,48);c.fillStyle='#ffe49b';c.beginPath();c.ellipse(0,0,37+pulse*3,43,0,0,7);c.fill();c.fillStyle='#463919';c.font='900 18px Arial';c.textAlign='center';c.fillText('CHAMP',0,7);c.restore();
  }
  for(let i=0;i<6;i++){
   const x=120+i*336,y=i%2?1080:0,tip=x+Math.sin(t*.9+i)*230;
   const g=c.createLinearGradient(x,y,tip,i%2?840:170);g.addColorStop(0,'#ffe49b66');g.addColorStop(1,'#ffe49b00');c.fillStyle=g;c.beginPath();c.moveTo(x-15,y);c.lineTo(tip-85,i%2?840:170);c.lineTo(tip+85,i%2?840:170);c.closePath();c.fill();
  }
 }
 draw(t,duration,effect,scene){
  const c=this.c,beat=t*(effect.bpm||126)/60,pulse=(Math.sin(beat*Math.PI*2)+1)/2;
  const color=effect.color||this.design.theme('arena')[0];
  c.save();c.globalAlpha*=Math.max(0,Math.min(1,t/.15,(duration-t)/.3));
  this.design.scenery(t,beat,'arena',scene);
  this.arena(t,beat,pulse,color,scene);
  this.design.title(t,duration,effect.label,'arena',scene);c.restore();
 }
}
const instances=new WeakMap();
return Object.assign((c,t,duration,effect,scene)=>{let show=instances.get(c);if(!show){show=new ArenaPerformance(c);instances.set(c,show);}show.draw(t,duration,effect,scene);},{createDesign:c=>new ProductionDesign(c)});
})();
export const createLegacyProductionDesign=legacyArenaPaint.createDesign;
