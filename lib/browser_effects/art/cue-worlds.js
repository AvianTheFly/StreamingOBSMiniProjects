// Art direction is per cue. No encompassing rail, tile or interchangeable frame.
// These are stage-sized scenes whose negative space is the gameplay opening.
function cueWorld(c,k,t,d,p){
 const w=new WorldPaint(c),z=smooth(p),tau=TAU,scenic=Boolean(SCENIC[k]);
 if(scenic)soundScenery(c,k,t);
 const fill=(draw,stops,axis=[0,0,120,0],alpha=1)=>{c.save();c.globalAlpha*=alpha;const g=c.createLinearGradient(...axis);for(const [u,color]of stops)g.addColorStop(u,color);c.fillStyle=g;c.beginPath();draw(c);c.fill();c.restore();};
 const stroke=(draw,color,width=1,alpha=1)=>{c.save();c.globalAlpha*=alpha;c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.beginPath();draw(c);c.stroke();c.restore();};
 const path=(fn,color,width=1,alpha=1)=>w.line(fn,color,width,alpha);
 const pulse=(fn,color,speed=.15,offset=0,width=2,tail=.2)=>{const u=(t*speed+offset)%1.35;w.light(fn,u,color,width,tail);};
 const poly=(pts,color,alpha=1)=>fill(q=>{pts.forEach(([x,y],i)=>i?q.lineTo(x,y):q.moveTo(x,y));q.closePath();},[[0,color],[1,color]],[0,0,1,1],alpha);
 const disc=(x,y,rx,ry,color,alpha=1)=>{c.save();c.globalAlpha*=alpha;c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,tau);c.fill();c.restore();};
 const mote=(x,y,r,color,alpha=.8)=>w.mote(x,y,r,color,alpha);
 const petal=(x,y,r,color,angle,alpha=.8)=>w.petal(x,y,r,color,angle,alpha);
 const seed=(n,x,y,col,spread=55,height=220,speed=.22)=>{for(let j=0;j<n;j++){const birth=Math.floor(t*speed-j*.618),age=t*speed-j*.618-birth;const xx=x+Math.sin(j*7.13+birth*2.71+age*2)*spread;w.mote(xx,y-age*height,1+j%3*.7,col,Math.sin(age*Math.PI)*.8);}};
 const silk=(side,color,base=68,folds=7)=>{c.save();if(side)c.translate(1920,0),c.scale(-1,1);for(let j=folds;j>=0;j--){const x=base-j*8;fill(q=>{q.moveTo(-10,155);q.bezierCurveTo(x+20,270,x-12,375,x+Math.sin(t*.31+j)*16,470);q.bezierCurveTo(x+26,550,x-35,631,-4,714);q.closePath();},[[0,'#080713'],[.4,color+'c8'],[.65,color+'36'],[1,'#08071500']],[0,0,x+40,0],.7);path(u=>[x*Math.sin(u*Math.PI)+Math.sin(u*9+t*.3+j)*7,165+u*535],color,1,.25);}c.restore();};
 c.save();
 if(k==='crabs'){
  // Sideways reef tide: broad aquamarine water curls, foam and caustic cells.
  for(const side of [0,1]){c.save();if(side)c.translate(1920,0),c.scale(-1,1);const phase=side*2.1;
   for(let j=0;j<4;j++){const edge=u=>[18+j*13+Math.sin(u*9-t*.36+phase+j*.3)*(18+j*3),170+u*540];
    if(!scenic)fill(q=>{q.moveTo(0,166);for(let i=0;i<=80;i++)q.lineTo(...edge(i/80));q.lineTo(0,714);q.closePath();},[[0,'#143a4ad9'],[.3,'#18a7b899'],[.7,'#85f5df57'],[1,'#9fe9f500']],[0,0,110,0],.8);
    path(edge,j%2?'#c0fff1':'#47dfd5',1.3,.6);pulse(edge,'#dcfff7',.08,j*.19,2.4,.3);
   }
   for(let j=0;j<24;j++){const x=16+(j*29)%67,y=200+(j*71)%465;path(u=>[x+Math.sin(u*tau+j+t*.23)*15,y+Math.cos(u*tau+j+t*.17)*9],'#b3ffe8',.6,.16);}
   seed(28,49,690,'#e0fff5',37,450,.16);c.restore();}
  for(let j=0;j<3;j++){const f=u=>[250+u*1350,1065-j*15+Math.sin(u*14-t*.35+j)*12];path(f,'#7febce',2-j*.5,.6);pulse(f,'#edfff5',.095,j*.21,3,.15);}
  for(let j=0;j<15;j++){const x=350+j*86,y=15+Math.sin(j*.8+t*.21)*10;petal(x,y,7+j%4,'#e0b77e',j*.3,.9);}
 }else if(k==='racing'){
  // A single banked road sweeps down the left; red/white kerbs and headlight pairs.
  const road=u=>[21+58*Math.sin(u*Math.PI)*Math.sin(u*2.4+.3),154+u*555];
  if(!scenic)fill(q=>{q.moveTo(0,145);for(let i=0;i<=80;i++){const [x,y]=road(i/80);q.lineTo(x+36,y);}q.lineTo(0,722);q.closePath();},[[0,'#101a24f2'],[.6,'#152633c4'],[1,'#829aa84a']],[0,0,127,0]);
  if(!scenic)for(let j=0;j<31;j++){const a=j/31,b=(j+.7)/31,aa=road(a),bb=road(b);stroke(q=>{q.moveTo(aa[0]+34,aa[1]);q.lineTo(bb[0]+34,bb[1]);},j%2?'#fff0df':'#fa625c',5,.8);}
  path(road,'#c6d8da',1,.45);for(let j=0;j<3;j++){const u=(t*.19+j*.31)%1,fn=v=>{const[x,y]=road(v);return[x+j*8-7,y];};w.light(fn,u,j===1?'#ff435c':'#c0eafa',2.8,.18);const[x,y]=fn(u);w.mist(x,y,10,25,j===1?'#ef5478':'#9cdcff',.6);}
  // Sparse distant motorway lanes run along the upper opposite edge.
  for(let j=0;j<5;j++){const fn=u=>[790+u*850,7+j*7+u*u*17];path(fn,'#476375',.8,.38);pulse(fn,j%2?'#ff6e6b':'#bdedff',.15,j*.17,1.8,.12);}
 }else if(k==='coffin'){
  // Velvet proscenium, an off-center moon, candle procession. No metal rail.
  if(!scenic){silk(0,'#724273',84,8);silk(1,'#49294f',52,5);}
  if(!scenic)for(let j=0;j<6;j++){const y=4+j*6;fill(q=>{q.moveTo(305,y);q.bezierCurveTo(435,105-j*7,630,72-j*5,830,y);q.closePath();},[[0,'#171126f0'],[.42,'#653453cb'],[.65,'#aa7a6950'],[1,'#231329b8']],[300,0,840,80],.6);}
  for(let j=0;j<13;j++){const x=380+j*88,y=1068-j%3*6;poly([[x-3,y],[x+3,y],[x+3,1080],[x-3,1080]],'#d1a278',.8);const flame=6+Math.sin(t*2.3+j*7)*1.3;disc(x,y-flame,1.4,flame,'#ffdf9b');w.mist(x,y,24,42,'#dcab73',.35);}
  seed(18,64,645,'#e8c195',37,360,.1);
 }else if(k==='rewind'){
  // Wide curled film travels vertically on one side; a tape loop unspools at top.
  const strip=u=>[39+Math.sin(u*8-t*.34)*24,164+u*539];
  for(let j=0;j<48;j++){const u=j/48,[x,y]=strip(u),[xx,yy]=strip(Math.min(1,u+.023));poly([[x-22,y],[x+22,y],[xx+22,yy],[xx-22,yy]],'#453827',.8);if(j%2===0){poly([[x-17,y+2],[x-10,y+2],[x-10,y+8],[x-17,y+8]],'#ffdeb1',.7);poly([[x+10,y+2],[x+17,y+2],[x+17,y+8],[x+10,y+8]],'#ffdeb1',.7);}}
  for(let j=0;j<8;j++){const u=((j/8-t*.075)%1+1)%1,[x,y]=strip(u);poly([[x-8,y],[x+8,y],[x+8,y+30],[x-8,y+30]],j%2?'#90b0a18a':'#191d22b0');}
  const tape=u=>[340+u*1180,28+Math.sin(u*11+p*3)*23*Math.sin(u*Math.PI)];path(tape,'#8d795a',6,.73);path(u=>{const[x,y]=tape(u);return[x,y-2];},'#e7d0a7',.8,.9);pulse(u=>tape(1-u),'#ceece2',.095,0,2,.27);
  for(let j=0;j<17;j++){const y=199+j*28;w.beam([[1897,y],[1918,y-8]],'#c7ac82',1.5,.3+j%3*.12);}
 }else if(k==='violin'){
  // Fine illuminated strings bowed into a vibration fan; warm wooden scroll.
  fill(q=>{q.moveTo(0,210);q.bezierCurveTo(95,190,45,350,12,382);q.bezierCurveTo(102,418,87,609,0,650);q.closePath();},[[0,'#301d23'],[.35,'#885735'],[.58,'#ca925d'],[.66,'#624029'],[1,'#271c2280']],[0,0,100,0],.9);
  for(let j=0;j<9;j++){const f=u=>[16+j*7+Math.sin(u*23-t*2+j*.17)*(2+Math.sin(t*.51)*2)*Math.sin(u*Math.PI),170+u*509];path(f,j%2?'#e9cc99':'#aa8170',j===4?1.6:.65,.65);pulse(f,'#fff0c6',.045,j*.11,1.4,.14);}
  for(let j=0;j<5;j++){const f=u=>[420+u*1090,8+j*8+Math.sin(u*8-t*.8+j*.3)*8];path(f,'#cfad8a',.7,.35);}
  seed(19,1874,670,'#e5c99e',24,490,.08);
 }else if(k==='disco'){
  // An off-screen mirror sphere scatters lens-shaped reflections across the rim.
  for(let j=0;j<65;j++){const row=Math.floor(j/9),col=j%9,x=3+col*8+Math.sin(row*.4)*7,y=184+row*13;poly([[x,y],[x+6,y+2],[x+6,y+10],[x,y+8]],['#d6b8e6','#82dcca','#f6d4aa'][j%3],.35+.5*Math.max(0,Math.sin(j*.77+t*.51)));}
  for(let j=0;j<44;j++){const birth=Math.floor(t*.14+j*.618),age=t*.14+j*.618-birth,col=['#d4a0ec','#8feade','#f1d09f'][j%3],x=j%2?1890+Math.sin(j+age)*26:350+(j*97)%1160,y=j%2?177+(j*59)%493:14+Math.sin(age*4+j)*24;disc(x,y,3+j%3,1+j%2,col,Math.sin(age*Math.PI)*.8);w.mist(x,y,18,8,col,.25);}
  for(let j=0;j<4;j++){const f=u=>[350+u*1200,1067-j*5-Math.sin(u*Math.PI)*(10+j*2)];path(f,j%2?'#9af2da':'#d6b5f5',1,.45);pulse(f,'#fbe6ff',.087,j*.23,2.5,.1);}
 }else if(k==='arena'){
  // Stadium rafters in perspective and moving warm spotlights at the outer sides.
  for(let j=0;j<17;j++){const x=320+j*77;poly([[x,0],[x+51,0],[x+64,22],[x+13,22]],'#202938',.9);w.beam([[x+8,18],[x+38,18]],'#ffe4a0',3,.9);}
  for(const side of [0,1]){c.save();if(side)c.translate(1920,0),c.scale(-1,1);for(let j=0;j<4;j++){const y=205+j*122;fill(q=>{q.moveTo(4,y);q.lineTo(115,y-51+Math.sin(t*.35+j)*22);q.lineTo(81,y+74);q.closePath();},[[0,'#ffdda05c'],[.5,'#ffdda019'],[1,'#ffdda000']],[0,y,118,y],.7);disc(7,y,4,8,'#ffe9ac');}c.restore();}
  for(let j=0;j<32;j++){const x=350+j*39,y=1070-j%4*3;mote(x,y,1.8,j%3?'#fae4b1':'#f9a7a6',.8);}
 }else if(k==='bonk'){
  // A soft porcelain surface dents, releases one rubber wave and settles.
  const impact=Math.sin(Math.min(1,p*2.6)*Math.PI)*23*Math.exp(-p*2);
  fill(q=>{q.moveTo(0,190);q.bezierCurveTo(39,260,15+impact,367,60-impact,426);q.bezierCurveTo(9,520,57,611,0,680);q.closePath();},[[0,'#845d79'],[.37,'#efcedf'],[.6,'#bf91b184'],[1,'#cceff000']],[0,0,87,0],.84);
  for(let j=0;j<5;j++){const f=u=>[1908-18*Math.sin(u*Math.PI)+Math.sin(u*19-p*15+j*.5)*8*Math.exp(-p*2),190+u*470];path(f,j%2?'#eab4d0':'#b4dfea',1.5,.6-j*.08);}
  for(let j=0;j<14;j++)disc(360+j*83,12+Math.sin(j*.6+p*4)*6,4,1.8,j%2?'#eab4d0':'#e2f5f2',.85);
 }else if(k==='sparkles'||k==='oops'){
  // Opal dispersion floats freely; the failure variant breaks into offset beams.
  const broken=k==='oops';for(let j=0;j<9;j++){const x=340+j*137,y=12+(j%3)*9,drift=Math.sin(t*.21+j)*8;
   const hue=['#acb7f5','#97e8d4','#e6a6cf'][j%3];fill(q=>{q.moveTo(x,y);q.lineTo(x+104,y+(broken?21:4));q.lineTo(x+38+drift,y+44);q.closePath();},[[0,hue+'b0'],[.3,'#f5ffff8a'],[.52,hue+'40'],[1,hue+'00']],[x,y,x+100,y+36],.8);stroke(q=>{q.moveTo(x,y);q.lineTo(x+104,y+(broken?21:4));},'#eefff8',1,.7);}
  for(let j=0;j<40;j++){const side=j%2,x=side?1897:22,y=185+(j*53)%488,shift=Math.sin(t*.4+j)*14;petal(x+shift,y,3+j%3,['#a5e9e3','#e0b4ec','#faf1cb'][j%3],j+t*.11,.8);}seed(20,1857,654,'#e6bfea',35,330,.12);
 }else if(k==='mash'){
  // Rhythmic ink calligraphy and gold dust: strokes surge, leaving a soft tail.
  for(let j=0;j<7;j++){const y=170+j*72;fill(q=>{q.moveTo(-10,y);q.bezierCurveTo(100,y-21,76,y+36,6,y+50);q.bezierCurveTo(47,y+19,23,y+11,-10,y+12);},[[0,'#281e24'],[.44,'#e1b56bbd'],[.8,'#b9863544'],[1,'#e8be7400']],[0,0,105,0],.85);}
  for(let j=0;j<20;j++){const y=193+j*24,x=1903+Math.sin(t*1.7+j)*10;stroke(q=>{q.moveTo(x,y);q.quadraticCurveTo(x-32,y+5,x-7,y+15);},'#e7c780',2,.45);}
  for(let j=0;j<5;j++)pulse(u=>[360+u*1180,15+j*5+Math.sin(u*7+j)*9],'#f6d99f',.11,j*.21,2,.27);seed(40,60,695,'#f4d592',41,490,.21);
 }else if(k==='balloons'){
  // Large translucent helium skins half outside the canvas, tether filaments.
  for(const[x,y,r,col]of [[-21,293,68,'#dda2c4'],[1940,520,84,'#cba4e9'],[-17,569,49,'#edc985']]){const yy=y+Math.sin(t*.47+y)*8;fill(q=>q.ellipse(x,yy,r,r*1.2,.1,0,tau),[[0,col+'19'],[.25,col+'72'],[.65,col+'20'],[.95,'#fff3e1ca'],[1,col+'40']],[x-r,yy,x+r,yy],.77);stroke(q=>{q.moveTo(x+12,yy+r);q.bezierCurveTo(x+36,yy+r+55,x-8,yy+r+90,x+18,yy+r+144);},col,1,.55);}
  for(let j=0;j<21;j++){const x=335+j*61,y=15+Math.sin(j*.8+t*.3)*12;petal(x,y,5+j%3,j%2?'#e3c18c':'#dca4ce',j+t*.2,.85);}
 }else if(k==='rats'){
  // A deep utility tunnel peeks in from one edge: cables, tiny moving signals.
  fill(q=>{q.moveTo(0,173);q.lineTo(63,194);q.lineTo(76,654);q.lineTo(0,698);},[[0,'#111d21'],[.65,'#354644'],[1,'#0d202600']],[0,0,91,0],.95);
  for(let j=0;j<6;j++){const x=6+j*10;path(u=>[x+Math.sin(u*5+j)*6,180+u*505],j%2?'#638c85':'#b3c2b6',2,.65);}
  for(let j=0;j<7;j++){const y=192+j*73;w.beam([[0,y],[63,y+19]],'#1c252b',8,.9);w.beam([[0,y-2],[63,y+17]],'#a9baa7',.8,.6);}
  for(let j=0;j<8;j++){const u=(t*.06+j*.137)%1;mote(11+j%4*13,180+u*500,2,'#b4f8ab',.9);}
  for(let j=0;j<18;j++){const x=355+j*68,y=9+j%2*9;w.beam([[x,y],[x+28,y]],'#8ccbab',1.7,.6);}
 }else if(k==='raccoon'){
  // Offset vinyl circles: the groove catches light while small cutouts orbit.
  for(const[x,y,r]of [[-95,407,161],[1974,286,103]]){disc(x,y,r,r,'#171d26',.82);for(let j=0;j<18;j++)path(u=>[x+Math.cos(u*tau)*(r-j*3),y+Math.sin(u*tau)*(r-j*3)],j%4?'#7a7276':'#d5b28a',.7,j%4?.26:.55);const a=t*.6;path(u=>[x+Math.cos(a+u*.4)*r,y+Math.sin(a+u*.4)*r],'#f7e0ae',2,.8);}
  for(let j=0;j<6;j++){const f=u=>[345+u*1220,10+j*5+Math.sin(u*9-t*.4+j)*6];path(f,j%2?'#8bdcc7':'#bdb1df',.8,.5);}
  seed(16,1886,663,'#e8c689',28,220,.12);
 }else if(k==='shades'){
  // A curved smoked-glass lens reflects a passing city skyline at top only.
  fill(q=>{q.moveTo(310,0);q.lineTo(1570,0);q.bezierCurveTo(1370,70,1120,50,960,18);q.bezierCurveTo(740,63,505,85,310,0);},[[0,'#101b30dd'],[.36,'#63809373'],[.5,'#bfd6db84'],[.64,'#283550b8'],[1,'#111a27']],[320,0,1560,66],.86);
  for(let j=0;j<41;j++){const x=350+j*29;stroke(q=>{q.moveTo(x,6);q.lineTo(x,17+(j*13)%25);},j%3?'#c4dde2':'#fff0d9',1,.25);}
  pulse(u=>[340+u*1200,22+Math.sin(u*tau)*11],'#def9fa',.13,0,2.5,.18);
  for(let j=0;j<4;j++)path(u=>[1907-j*6-10*Math.sin(u*Math.PI),180+u*470],'#91afb9',1,.25);
 }else if(k==='equalizer'){
  // A spectrum of translucent audio membranes, staggered rather than mirrored.
  for(let j=0;j<21;j++){const y=170+j*24,amp=15+25*(.5+.5*Math.sin(t*3+j*.71))*(.6+.4*Math.sin(t*.71+j));fill(q=>{q.moveTo(0,y);q.quadraticCurveTo(amp*1.8,y+5,amp,y+15);q.lineTo(0,y+18);},[[0,'#74cfa0c9'],[.6,'#a0f4bf75'],[1,'#ddffe100']],[0,0,65,0],.8);}
  for(let j=0;j<32;j++){const x=330+j*40,h=6+Math.sin(t*2.1+j*.65)**2*25;fill(q=>{q.rect(x,0,14,h);},[[0,'#cba8f1e8'],[1,'#cba8f119']],[0,0,0,40]);}
  for(let j=0;j<3;j++){const f=u=>[1905-j*9+Math.sin(u*23-t*2)*7,177+u*480];path(f,'#b8e5e0',1.5,.4);}
 }else if(k==='nyan'){
  // A single milky comet crosses the upper rim with five softly separating tails.
  const rainbow=['#db93bf','#e8c998','#aee0b7','#9bdcea','#c6b1e9'];
  for(let j=0;j<5;j++){const f=u=>[330+u*1200,24+Math.sin(u*6+p*3)*10+j*3];path(f,rainbow[j],2,.16);w.light(f,(p*1.32-j*.012),rainbow[j],3,.4,.9);}
  for(let j=0;j<54;j++){const side=j%2,x=side?1892:28,y=177+(j*53)%484,age=(t*.08+j*.618)%1;w.star(x+Math.sin(j)*19,y,1+j%3,rainbow[j%5],Math.sin(age*Math.PI)*.8);}
  for(let j=0;j<12;j++)disc(360+j*99,1068+Math.sin(j)*5,3,1,rainbow[j%5],.7);
 }else if(k==='tantrum'){
  // Enamel impact puck on one side launches expanding red compression rings.
  for(let j=0;j<6;j++){const r=27+j*15+z*20;path(u=>[-21+Math.cos(-1.3+u*2.6)*r,415+Math.sin(-1.3+u*2.6)*r*2.7],j%2?'#eda28d':'#b65568',j===0?7:1.7,.85-j*.09);}
  for(let j=0;j<15;j++){const x=346+j*79;poly([[x,0],[x+51,0],[x+29,7+(j%3)*7]],j%2?'#cc8891':'#e0ba98',.75);}seed(28,1881,646,'#d98b8c',27,410,.2);
 }else if(k==='kitchen'){
  // Warm copper heat bloom with curling translucent steam and fine seasoning.
  fill(q=>{q.moveTo(0,303);q.bezierCurveTo(72,322,78,505,0,534);q.closePath();},[[0,'#6e342a'],[.4,'#cd8b55'],[.68,'#ffd397'],[1,'#5d302500']],[0,0,83,0],.86);
  for(let j=0;j<11;j++){const f=u=>[26+Math.sin(u*10-t*.32+j*.21)*(12+u*16)+j*3,647-u*480];path(f,j%3?'#d9e8e2':'#edc99b',.8,.19);pulse(f,'#dfefeb',.08,j*.07,1.7,.25);}
  for(let j=0;j<33;j++){const age=(t*.13+j*.618)%1;mote(1872+Math.sin(j)*31,673-age*445,1+j%2,'#f2d4a0',Math.sin(age*Math.PI)*.8);}
  path(u=>[345+u*1200,12+Math.sin(u*8)*6],'#d3a06a',3,.6);
 }else if(k==='meltdown'){
  // Molten ruby channels in a cool cracked stone mass, with slow lava drips.
  for(const side of [0,1]){c.save();if(side)c.translate(1920,0),c.scale(-1,1);if(!scenic)fill(q=>{q.moveTo(0,166);for(let j=0;j<20;j++)q.lineTo(33+Math.sin(j*2.6+side)*18,168+j*27);q.lineTo(0,708);},[[0,'#181e2bf5'],[.8,'#432b3bcb'],[1,'#b8496420']],[0,0,70,0]);for(let j=0;j<3;j++){const f=u=>[12+j*10+Math.sin(u*21+j)*7,173+u*514];path(f,'#8c3f55',4,.7);pulse(f,j%2?'#ffd4a0':'#f29099',.09,j*.25,2,.3);}seed(19,34,670,'#ffb49e',27,380,.12);c.restore();}
  for(let j=0;j<11;j++){const x=352+j*109;poly([[x,0],[x+83,0],[x+67,17],[x+41,7],[x+15,24]],'#392a3c',.9);}
 }else if(k==='spill'){
  // Honey-green liquid sheets: droplets merge and leave glistening wet edges.
  for(const side of [0,1]){c.save();if(side)c.translate(1920,0),c.scale(-1,1);const f=u=>[19+Math.sin(u*12-t*.24+side)*19+Math.sin(u*31+t*.2)*5,176+u*520];fill(q=>{q.moveTo(0,172);for(let i=0;i<=90;i++)q.lineTo(...f(i/90));q.lineTo(0,701);},[[0,'#3b6d50d9'],[.5,'#b7ec6c89'],[.8,'#ceffc5bc'],[1,'#8edcd900']],[0,0,60,0],.85);path(f,'#ddfbbd',1.3,.85);for(let j=0;j<13;j++){const age=(t*.11+j*.618)%1;disc(27+Math.sin(j+age)*21,175+age*480,2+j%3,4+j%4,'#c9ec96',.65);}c.restore();}
  for(let j=0;j<18;j++){const x=370+j*66;disc(x,8+Math.sin(t*.3+j)*4,16+j%3*3,3,'#bfe991',.65);}
 }else if(k==='heartbreak'){
  // Torn rose silk peels into petals; a seam of light never quite reconnects.
  silk(0,'#a26185',65,5);
  for(let j=0;j<23;j++){const age=(t*.07+j*.618)%1,x=1880+Math.sin(age*7+j)*27,y=182+age*480;petal(x,y,5+j%5,'#e7b2cb',age*4+j,Math.sin(age*Math.PI)*.9);}
  const seam=u=>[340+u*1240,22+Math.sin(u*9+p)*10];path(u=>seam(u*.46),'#e5bccd',1.4,.7);path(u=>seam(.54+u*.46),'#d0d8ef',1.4,.7);
  for(let j=0;j<14;j++){const x=370+j*88;petal(x,1066+Math.sin(j+t*.3)*5,6,'#e3bfd4',j*.8,.8);}
 }else if(k==='arcade'){
  // A clean voxel cascade builds a compact staircase, then dissolves to pixels.
  for(let j=0;j<38;j++){const col=j%4,row=Math.floor(j/4),x=col*11,y=190+row*46+(col%2)*12;poly([[x,y],[x+9,y],[x+9,y+9],[x,y+9]],j%3?'#80d3b0':'#c6f2dc',.65+.3*Math.sin(j+t*.6)**2);}
  for(let j=0;j<41;j++){const x=340+j*30,y=9+(j%5)*7;poly([[x,y],[x+12,y],[x+12,y+6],[x+6,y+6],[x+6,y+12],[x,y+12]],j%4?'#8db9de':'#c7ebda',.7);}
  for(let j=0;j<17;j++){const u=(t*.17+j/17)%1;poly([[1904,184+u*485],[1913,184+u*485],[1913,191+u*485],[1904,191+u*485]],'#b7edd2',.8);}
 }else if(k==='approval'){
  // A living laurel climbs one edge, with tiny seed lights released as it opens.
  const stem=u=>[18+Math.sin(u*6)*18,682-u*504];path(stem,'#d5c28a',1.7,.9);
  for(let j=0;j<17;j++){const [x,y]=stem(j/17),a=-.8+Math.sin(t*.2+j)*.08;petal(x+10,y,14+j%3,'#b7deb1',a,.86);petal(x-7,y+8,11,'#81b8a4',-a,.8);}
  for(let j=0;j<13;j++){const x=365+j*92;petal(x,14+Math.sin(j)*5,9,j%3?'#e9d39a':'#afdabb',-.4,.9);}seed(21,1884,658,'#d6eccc',24,450,.09);
 }else if(k==='muffins'){
  // Patisserie paper folds, glossy chocolate ribbons and a sugar dust flourish.
  for(let j=0;j<24;j++){const y=178+j*21;fill(q=>{q.moveTo(0,y);q.lineTo(32+j%3*5,y-5);q.lineTo(52,y+12);q.lineTo(0,y+19);},[[0,'#563b32'],[.32,'#c69666'],[.48,'#f5d3a7'],[1,'#53352c24']],[0,y,55,y],.88);}
  for(let j=0;j<4;j++){const f=u=>[330+u*1240,9+j*7+Math.sin(u*10+j*.3)*6];path(f,j%2?'#754332':'#e3be91',3-j*.4,.7);pulse(f,'#ffe8bd',.08,j*.18,1.5,.23);}
  seed(53,1890,663,'#fff0c9',29,476,.16);
 }else{
  // Compatibility styles are only aliases; catalog entries have authored IDs.
  c.restore();return cueWorld(c,k==='cats'?'nyan':k==='party'?'balloons':'disco',t,d,p);
 }
 c.restore();
}
