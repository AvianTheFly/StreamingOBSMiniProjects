// Six independent authored performances. Audio time is the only clock.
const AUTHORED_CUE_STYLES=new Set(['crabs','coffin','bonk','sparkles','disco','equalizer']);
function authoredCue(c,t,d,e){
 if(!AUTHORED_CUE_STYLES.has(e.style))return false;
 const p=t/Math.max(.1,d),beat=t*(e.bpm||110)/60;
 const cyan='#86edff',gold='#efc889',pink='#efa6dc',violet='#ac9bf1';
 const line=(pts,col,width=1,alpha=1)=>{c.save();c.globalAlpha*=alpha;c.strokeStyle=col;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();c.restore();};
 const polygon=(pts,col,alpha=1)=>{c.save();c.globalAlpha*=alpha;c.fillStyle=col;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();c.restore();};
 const ellipse=(x,y,rx,ry,col,alpha=1)=>{c.save();c.globalAlpha*=alpha;c.fillStyle=col;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();c.restore();};
 const halo=(x,y,r,col,alpha)=>{c.save();c.globalAlpha*=alpha;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,col+'80');g.addColorStop(.4,col+'28');g.addColorStop(1,col+'00');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();};
 const light=(fn,col,phase=0,speed=.35,width=2)=>{const u=(t*speed+phase)%1.35;
  for(let i=0;i<24;i++){const a=u-.2+i*.2/24,b=a+.2/24;if(a<0||b>1)continue;line([fn(a),fn(b)],col,width,(i/24)**2*.9);}
  if(u>0&&u<1){const [x,y]=fn(u);halo(x,y,14,col,.48*Math.sin(u*Math.PI));ellipse(x,y,1.6,1.6,'#edffff',Math.sin(u*Math.PI));}
 };
 const word=(s,x,y,col,size=27)=>{c.save();c.translate(x,y);c.transform(1,0,-.16,1,0,0);c.font=`${size}px Impact, sans-serif`;c.textAlign='center';c.fillStyle=col;c.fillText(s,0,0);c.restore();};
 c.save();c.globalAlpha*=smooth(t/.45)*smooth((d-t)/.55);
 if(e.style==='crabs'){
  const crab=(x,y,scale,phase)=>{c.save();c.translate(x,y+Math.sin(beat*Math.PI+phase)*5);c.scale(scale,scale);c.rotate(Math.sin(beat*1.1+phase)*.1);
   halo(0,0,65,'#78cbd7',.28);
   for(const side of [-1,1])for(let j=0;j<3;j++){
    const lift=Math.sin(beat*2.6+j+phase)*6;
    line([[side*14,4+j*5],[side*(30+j*3),10+j*8+lift],[side*(40+j*3),22+j*8]],'#508f9d',4,.95);
    line([[side*14,4+j*5],[side*(30+j*3),10+j*8+lift]],'#aee7e8',1,.8);
   }
   const shell=c.createLinearGradient(-26,-20,25,20);shell.addColorStop(0,'#c6ebde');shell.addColorStop(.35,'#578d9e');shell.addColorStop(.65,'#436976');shell.addColorStop(1,'#8bcece');
   ellipse(0,0,27,18,shell);line([[-19,-9],[-7,-15],[9,-15],[20,-7]],'#d3fff6',1.8,.8);
   for(const side of [-1,1]){line([[side*18,-2],[side*31,-18-Math.sin(beat+phase)*8]],'#73b5bf',5);c.save();c.translate(side*35,-27-Math.sin(beat+phase)*8);c.rotate(side*.5);polygon([[-8,12],[-13,-5],[-5,-13],[0,-2],[6,-14],[13,-4],[8,12]],'#9bd3cf');line([[-11,-4],[-5,-11]],'#e0fff3',1.5);c.restore();line([[side*8,-12],[side*9,-23]],'#8ebfc7',3);ellipse(side*9,-24,3,4,'#f0fff2');ellipse(side*9,-25,1.4,2,'#173441');}
   c.restore();};
  for(const side of [0,1]){c.save();if(side){c.translate(1920,0);c.scale(-1,1);}for(let j=0;j<5;j++){
   const fn=u=>[18+j*12+Math.sin(u*7+t*.5+j)*13,190+u*530];line(Array.from({length:35},(_,i)=>fn(i/34)),j%2?'#65bcbc':'#94d9b5',1.3,.28);light(fn,cyan,j*.13,.16,2);
  }for(let j=0;j<12;j++){const a=(t*.17+j*.618)%1;line(Array.from({length:20},(_,i)=>{const angle=i/19*TAU;return[36+Math.sin(j)*21+Math.cos(angle)*(3+j%3),680-a*480+Math.sin(angle)*(3+j%3)];}),cyan,.8,Math.sin(a*Math.PI)*.52);}c.restore();}
  crab(58,411,1.16,0);crab(1875,533,.94,1.8);crab(392+Math.sin(t*.34)*22,1040,.72,3.1);
  word('CRAB RAVE',1030,53,'#bcece8',31);
 }else if(e.style==='coffin'){
  // A travelling gilded casket carried by four precisely offset hands.
  const x=955+Math.sin(t*.43)*84,y=53+Math.sin(beat*Math.PI)*3;
  c.save();c.translate(x,y);c.rotate(Math.sin(t*.3)*.025);halo(0,0,132,gold,.27);
  for(let j=0;j<4;j++){const xx=-75+j*50;line([[xx,49],[xx+8,39],[xx+12,24]],'#c9a986',8,.85);line([[xx+4,45],[xx+11,34]],'#f4d6b5',1.2,.7);}
  const shape=[[-107,-13],[-76,-30],[79,-30],[109,-13],[95,27],[-95,27],[-107,-13]];
  const finish=c.createLinearGradient(0,-30,0,29);finish.addColorStop(0,'#695846');finish.addColorStop(.35,'#232737');finish.addColorStop(.7,'#131724');finish.addColorStop(1,'#8a7152');polygon(shape,finish);line(shape,gold,1.9,.95);
  line([[-86,-13],[-64,-22],[66,-22],[88,-12],[78,17],[-78,17],[-86,-13]],gold,.9,.65);
  line([[0,-16],[0,14]],gold,2.8);line([[-10,-4],[10,-4]],gold,2.8);for(const side of [-1,1])line([[side*43,-7],[side*49,-13],[side*58,-7],[side*49,1],[side*43,-7]],gold,1,.65);c.restore();
  for(const side of [0,1]){c.save();if(side){c.translate(1920,0);c.scale(-1,1);}
   for(let j=0;j<4;j++){const yy=230+j*119;polygon([[0,yy-20],[26,yy-32],[54,yy],[54,yy+9],[23,yy-15],[0,yy-9]],'#7d695134',.8);line([[0,yy-20],[26,yy-32],[54,yy]],gold,1.1,.48);light(u=>[17+Math.sin(u*Math.PI)*37,yy-34+u*71],gold,j*.22,.21,2.2);}
   for(let j=0;j<9;j++){const yy=192+j*54;halo(9,yy,25,gold,.18+.08*Math.sin(beat*.6+j));line([[0,yy],[12,yy-5],[20,yy],[12,yy+5],[0,yy]],gold,.9,.47);}c.restore();
  }
  word('FINAL ENCORE',1375,62,gold,24);
 }else if(e.style==='bonk'){
  // Machined hammer, a sprung mounting and an impact halo that settles away.
  const cycle=beat%2,hit=smooth(cycle/.35)*(1-smooth((cycle-.48)/.75));
  c.save();c.translate(44,293);c.rotate(-.72+hit*1.25);
  line([[0,0],[7,99]],'#313d53',15);line([[2,0],[9,99]],'#b1c8db',3);
  const metal=c.createLinearGradient(-31,75,32,114);metal.addColorStop(0,'#f2e9d4');metal.addColorStop(.23,'#afc4cf');metal.addColorStop(.45,'#53667d');metal.addColorStop(.56,'#dcebf2');metal.addColorStop(1,'#576174');
  polygon([[-31,81],[-24,73],[31,76],[39,89],[34,109],[-25,107],[-31,81]],metal);line([[-24,76],[29,79]],'#fbfbef',1.6);c.restore();
  const age=(cycle-.32)/1.3;
  if(age>0&&age<1)for(let j=0;j<3;j++){const r=10+age*69+j*8;line(Array.from({length:38},(_,i)=>[37+Math.cos(i/37*TAU)*r,400+Math.sin(i/37*TAU)*r*.6]),j%2?gold:cyan,1.9,(1-age)**2*.72);}
  for(let j=0;j<8;j++){const yy=229+j*52;line([[1907,yy],[1898,yy+8],[1909,yy+18],[1898,yy+28]],'#93afc4',1.4,.49);}
  for(let j=0;j<5;j++){const x=480+j*183;polygon([[x,16],[x+18,6],[x+31,16],[x+18,26]],'#91a0b332');light(u=>[x-40+u*103,17],cyan,j*.18,.25,1.8);}
  word('BONK',1225,61,'#daeaf2',34);
 }else if(e.style==='sparkles'){
  // One suspended opal: its independently shaded facets reveal spectral glints.
  const x=1110,y=53;c.save();c.translate(x,y);c.rotate(Math.sin(t*.5)*.06);halo(0,0,96,pink,.32);
  const jewel=[[0,-35],[30,-5],[17,36],[-17,36],[-30,-5],[0,-35]];
  polygon(jewel,'#918ccc55');polygon([[0,-35],[-30,-5],[0,6]],'#c5ecffb0');polygon([[0,-35],[30,-5],[0,6]],'#deaaf578');polygon([[0,6],[17,36],[-17,36]],'#b6c4ee88');line(jewel,'#e2e8ff',1.4,.85);line([[0,-35],[0,6],[-17,36]],'#f4ffff',1,.67);c.restore();
  for(const side of [0,1])for(let j=0;j<4;j++){const fn=u=>[side?1895-Math.sin(u*Math.PI)*42-j*5:22+Math.sin(u*Math.PI)*52+j*6,180+u*522];line(Array.from({length:32},(_,i)=>fn(i/31)),j%2?pink:violet,.9,.23);light(fn,[pink,cyan,gold,violet][j],j*.18,.16,2.1);}
  for(let j=0;j<24;j++){const a=(t*.14+j*.618)%1,x=j%2?1880+Math.sin(j)*27:38+Math.sin(j)*29,y=690-a*500,shine=Math.sin(a*Math.PI)**3;line([[x-3,y],[x+3,y]],'#e7efff',1,shine*.75);line([[x,y-3],[x,y+3]],'#e7efff',1,shine*.75);}
  word('WOW',865,58,'#e4dafa',33);
 }else if(e.style==='disco'){
  // A real faceted mirror ball throws changing reflections onto the side walls.
  c.save();c.translate(979,47);halo(0,0,91,violet,.38);line([[0,-47],[0,-34]],'#c1cad8',1.2,.7);
  for(let row=-4;row<=4;row++)for(let col=-4;col<=4;col++){
   const xx=col*7+Math.sin(t*.55+row*.12)*3,yy=row*7;if(xx*xx+yy*yy>36*36)continue;
   const shine=.3+.6*Math.max(0,Math.cos(col*.48+t*.9+row*.08));polygon([[xx-3,yy-3],[xx+3,yy-3],[xx+3,yy+3],[xx-3,yy+3]],row%2?cyan:pink,shine);
  }c.restore();
  for(const side of [0,1]){const x=side?1895:25,y=side?604:409;
   halo(x,y,96,violet,.24);ellipse(x,y,50,50,'#1b233bc2');for(let j=0;j<6;j++)line(Array.from({length:48},(_,i)=>[x+Math.cos(i/47*TAU)*(15+j*5),y+Math.sin(i/47*TAU)*(15+j*5)]),j%2?pink:cyan,.8,.22);ellipse(x,y,9,9,gold,.65);
   const fn=u=>[x+Math.cos(t*.63+u*TAU)*42,y+Math.sin(t*.63+u*TAU)*42];light(fn,cyan,0,.2,2.5);
   for(let j=0;j<17;j++){const yy=193+j*29,xx=side?1890:30;const shimmer=.12+.46*Math.sin(t*.9+j*.59)**4;polygon([[xx-8,yy-3],[xx+5,yy-7],[xx+10,yy+4],[xx-4,yy+7]],j%2?pink:cyan,shimmer);}
  }
  for(let j=0;j<4;j++)light(u=>[379+u*1160,14+j*7+Math.sin(u*Math.PI)*9],[cyan,pink,violet,gold][j],j*.2,.18,1.8);
 }else if(e.style==='equalizer'){
  // Split oscilloscope stacks: the audio-inspired trace folds into glass fins.
  for(const side of [0,1]){c.save();if(side){c.translate(1920,0);c.scale(-1,1);}
   for(let j=0;j<3;j++){const yy=253+j*153;
    polygon([[4,yy-42],[67,yy-27],[67,yy+27],[4,yy+42]],'#52749525');line([[4,yy-42],[67,yy-27],[67,yy+27]],cyan,.8,.36);
    const fn=u=>[8+u*63,yy+Math.sin(u*17-t*2.4-j)*Math.sin(u*Math.PI)*(10+7*Math.sin(beat*.7+j)**2)];line(Array.from({length:60},(_,i)=>fn(i/59)),[cyan,violet,pink][j],1.9,.72);light(fn,'#eeffff',j*.24,.27,2.6);
    for(let i=0;i<6;i++){const h=5+16*Math.sin(beat*.5+i*.8+j)**2;line([[8+i*10,yy+36],[8+i*10,yy+36-h]],cyan,3,.48);}
   }c.restore();
  }
  for(let j=0;j<27;j++){const x=503+j*35,h=5+Math.sin(beat*.4+j*.42)**2*26;line([[x,10],[x,10+h]],j%3?violet:cyan,2.2,.61);}
  word('VOLUME UP',980,73,'#c5eaff',23);
 }
 c.restore();return true;
}
