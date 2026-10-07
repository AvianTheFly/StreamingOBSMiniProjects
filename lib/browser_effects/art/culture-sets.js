// Contextual side scenery. Every setting has a different silhouette and motion.
function cultureSet(c,t,d,e){
 const {p,key,sound,beat,local,line,shape,disc,box,ring,word,event,curve,wake,sparkle}=cultureInk(c,t,d,e),tau=Math.PI*2;
 c.save();
 switch(key){
 case 'disco':
  // Footwork chalk and soft colored floor reflections, like the street-dance clip.
  for(const side of [0,1]){const x=side?1843:82;for(let j=0;j<9;j++){const y=242+j*69;local(x,y,.65,Math.sin(beat*Math.PI+j)*.14,()=>{c.save();c.globalAlpha*=.19+sound*.13;disc(-19,0,15,8,'#6bcfec');disc(16,13,15,8,'#e297e6');line([[-13,-3],[-25,-3]],'#f5e4b7',2);c.restore();});}curve(u=>[x+Math.sin(u*15-t)*44,228+u*585],'#57cafa',8,.09);wake(u=>[x+Math.sin(u*15-t)*44,228+u*585],p*1.15,'#64e3f5',3.3,.34);}
  for(let j=0;j<16;j++){const x=355+j*79,y=1039;line([[x,y],[x+42,y+11]],j%2?'#e89cc5':'#5acfe0',3,.33);}break;
 case 'coffin':
  for(const side of [0,1]){const x=side?1901:19;for(let j=0;j<5;j++){const y=247+j*117;curve(u=>[x+(side?-1:1)*Math.sin(u*Math.PI)*70,y+u*98],'#c8a569',2,.25);wake(u=>[x+(side?-1:1)*Math.sin(u*Math.PI)*70,y+u*98],p*1.21-j*.09,'#f1cd83',2.8);local(side?1846:73,y+58,.63,Math.sin(beat*Math.PI)*.12,()=>{shape([[-29,-9],[-7,0],[-29,11]],'#bb9677');shape([[29,-9],[7,0],[29,11]],'#bb9677');disc(0,0,5,8,'#dfc390');});}for(let j=0;j<12;j++){const y=245+j*47;disc(x,y,3,3,'#e2c088');}}
  for(let j=0;j<7;j++){const x=452+j*176;shape([[x-31,1060],[x,1042],[x+31,1060],[x,1075]],'#d1af691b',null);line([[x-31,1060],[x,1042],[x+31,1060]],'#dcb877',1.5,.35);}break;
 case 'mash':
  // Manga screentone, torn panel edges and muscle/speed ink rather than wand magic.
  for(const side of [0,1])for(let j=0;j<13;j++){const y=231+j*46,x=side?1903:17;for(let n=0;n<5;n++)disc(x+(side?-1:1)*n*12,y+(n%2)*6,1.6,1.6,j%2?'#f86c91':'#ffd74c');line([[x,y-12],[x+(side?-1:1)*(30+sound*35),y-24]],j%2?'#fc7092':'#f8d761',1.5,.45);}
  for(let j=0;j<6;j++){const x=447+j*210;local(x,1067,.6,-.1,()=>{line([[-32,0],[0,-6],[32,0]],'#e1b354',4,.5);box(-5,-11,10,22,0,'#fff0a7');});}break;
 case 'crabs':
  for(const side of [0,1]){const x=side?1907:13;for(let j=0;j<4;j++){const fn=u=>[x+(side?-1:1)*(j*18+Math.sin(u*16-t+j)*15),241+u*568];curve(fn,j%2?'#54d3d5':'#91ead1',9,.065);wake(fn,p*1.22-j*.06,j%2?'#ffb580':'#8af2e3',3.4,.3);}for(let j=0;j<12;j++){const yy=250+j*46;ring(x+(side?-1:1)*(15+j%3*21),yy+Math.sin(t+j)*8,3+j%3,3+j%3,'#8ee9df',1.4,.45);}}
  for(let j=0;j<3;j++){const fn=u=>[340+u*1230,1066-j*8+Math.sin(u*20-t+j)*7];curve(fn,'#46bbc5',8,.12);wake(fn,p*1.13-j*.09,'#adf6e1',2.5,.32);}break;
 case 'balloons':
  // Fern fronds curl at the edge of a black-dragon dance clearing.
  for(const side of [0,1])for(let j=0;j<4;j++){const x=side?1904-j*18:16+j*18;const fn=u=>[x+(side?-1:1)*Math.sin(u*2.8+t*.18)*28,809-u*(388+j*70)];curve(fn,'#639376',2,.35);for(let n=0;n<7;n++){const[x0,y]=fn(n/7);local(x0,y,.75,Math.sin(t*.6+n)*.08,()=>{line([[0,0],[side?-18:18,-9]],'#91bc87',2.4,.42);});}wake(fn,p*1.22-j*.1,'#d9f0a4',2.3);}
  for(let j=0;j<12;j++){const x=392+j*105,y=1047+Math.sin(t*1.5+j)*8;ring(x,y,4,4,'#9bbd85',1,.4);sparkle(x,y,2+sound*3,'#d7ef84',t*.1);}break;
 case 'rats':
  // Little boot prints mark the route, while different stage colors dissolve.
  for(const side of [0,1])for(let j=0;j<10;j++){const x=side?1905:17,y=231+j*57;local(x,y,.68,Math.sin(beat+j)*.1,()=>{const col=p<.34?'#d2a281':p<.68?'#78c8b7':'#aa9ddd';c.save();c.globalAlpha*=.35;box(-5,-10,10,20,3,col);box(-12,8,26,10,5,col);c.restore();});}
  for(let j=0;j<8;j++){const x=432+j*147;line([[x-31,1073],[x+29,1073]],'#ae9ac7',2,.33);sparkle(x,1021,4,'#ead3ab',Math.sin(t+j)*.3);}break;
 case 'shades':
  for(const side of [0,1]){const x=side?1904:15;for(let j=0;j<7;j++){const y=242+j*84;line([[x,y],[x+(side?-1:1)*66,y+22],[x,y+43]],'#84a7d1',1.3,.3);wake(u=>[x+(side?-1:1)*u*67,y+u*22],p*1.23-j*.04,'#ceeeff',2.5);}}
  for(let j=0;j<7;j++){const x=443+j*178;ring(x,1045,14,5,'#bacbe0',1.5,.35);}break;
 case 'equalizer':
  // Oven-rack lines and reflected brass notes tie the rhythm to a kitchen.
  for(const side of [0,1])for(let j=0;j<7;j++){const y=237+j*86,x=side?1880:41;local(x,y,1,0,()=>{box(-27,-19,54,38,5,'#89bbb422','#759a9d');for(let n=-2;n<=2;n++)line([[-21,n*6],[21,n*6]],'#afd4ca',1,.3);});}
  for(let j=0;j<4;j++){const fn=u=>[357+u*1205,38+j*15+Math.sin(u*15-t*2+j)*sound*8];curve(fn,'#e2c86c',1.5,.28);wake(fn,p*1.3-j*.075,'#fbedb0',2.7,.3);}break;
 case 'nyan':
  for(const side of [0,1])for(let j=0;j<18;j++){const x=side?1890-j%3*13:28+j%3*13,y=234+j*31;local(x,y,1,0,()=>{c.save();c.globalAlpha*=.25+sound*.3;box(-2,-6,4,12,0,'#deeefa');box(-6,-2,12,4,0,'#deeefa');c.restore();});}break;
 case 'tantrum':
  for(const side of [0,1])for(let j=0;j<3;j++){const x=side?1905-j*17:12+j*17;curve(u=>[x+Math.sin(u*10+t)*8,223+u*580],'#ffb865',1,.18);wake(u=>[x+Math.sin(u*10+t)*8,223+u*580],p*1.2-j*.1,'#ffdd7b',3,.34);}
  for(let j=0;j<10;j++){const x=416+j*117;line([[x-28,38],[x+21,29]],'#e3936a',2,.4);}break;
 case 'kitchen':
  for(const side of [0,1])for(let j=0;j<11;j++){const x=side?1903:17,y=238+j*53;local(x,y,.54,.05,()=>{shape([[-9,-11],[9,-11],[15,5],[0,14],[-15,5]],'#e7be782d','#c29c69',1);});}
  for(let j=0;j<3;j++){const fn=u=>[366+u*1215,51+j*10+Math.sin(u*14+t*.6+j)*5];curve(fn,'#efc58c',2,.16);wake(fn,p*1.2-j*.08,'#ffe3b5',2.3,.3);}break;
 case 'meltdown':
  for(const side of [0,1]){const x=side?1901:20;for(let j=0;j<4;j++){const y=268+j*136;const age=Math.max(0,Math.min(1,p*1.45-j*.1));ring(x,y,12+age*39,12+age*39,'#bedbb0',1.5,Math.sin(age*Math.PI)*.35);}}
  for(let j=0;j<13;j++){const x=398+j*94;curve(u=>[x+Math.sin(u*tau*4)*4,1036+u*30],'#dce795',2,.35);}break;
 case 'rewind':
  for(const side of [0,1])for(let j=0;j<6;j++){const x=side?1863:56,y=244+j*97;local(x,y,.65,0,()=>{shape([[-17,-12],[8,-12],[21,0],[8,12],[-17,12]],'#dabf861a','#a68d61',1);disc(-8,0,3,3,'#e6d8b0');});}
  for(let j=0;j<4;j++){const x=534+j*295;line([[x,31],[x+58,31]],'#d3c294',1.4,.4);disc(x+57,31,3,3,'#e8d9b0');}break;
 case 'spill':
  for(const side of [0,1]){const x=side?1905:14;line([[x,225],[x,804]],'#c2c4b1',1.3,.3);for(let j=0;j<10;j++){const y=239+j*57;line([[x-7,y],[x+7,y]],'#e7dfc2',1,.3);}}
  for(let j=0;j<4;j++){const fn=u=>[373+u*1180,1057+j*4];wake(fn,(p-.24)*1.5-j*.08,'#ece7cf',1.8,.35);}break;
 case 'heartbreak':
  for(const side of [0,1])for(let j=0;j<8;j++){const x=side?1896:25,y=232+j*78;curve(u=>[x+Math.sin(u*Math.PI)*21, y+u*55],'#b9a5c9',1.3,.3);wake(u=>[x+Math.sin(u*Math.PI)*21, y+u*55],p*1.22-j*.06,'#c7d8eb',2.2);}
  for(let j=0;j<3;j++){const fn=u=>[357+u*1208,48+j*11+Math.sin(u*7+t*.4)*8];curve(fn,'#d3a6c2',1,.2);wake(fn,p*1.13-j*.06,'#e7c3da',2.3,.27);}break;
 case 'isolation':
  for(const side of [0,1])for(let j=0;j<5;j++){const x=side?1905-j*13:14+j*13;const fn=u=>[x+Math.sin(u*23-t*2+j)*sound*9,236+u*561];curve(fn,'#c893b5',1.4,.15+sound*.1);wake(fn,p*1.2-j*.08,'#e4b2cb',2.2,.29);}
  for(let j=0;j<11;j++){const x=416+j*109;line([[x-10,43],[x+11,43]],'#d4b1c5',2,.35);}break;
 case 'prowler':
  // Uneven comic hatching and diagonal claw-light fractures.
  for(const side of [0,1])for(let j=0;j<10;j++){const x=side?1905:12,y=236+j*55;line([[x,y],[x+(side?-1:1)*41,y-17]],'#79608d',2,.18+sound*.2);line([[x,y+9],[x+(side?-1:1)*28,y-3]],'#c795cf',1,.25);}
  for(let j=0;j<4;j++){const fn=u=>[373+u*1180,43+j*12-Math.sin(u*Math.PI)*11];wake(fn,(p-.12)*1.4-j*.09,'#c79be3',2.2,.31);}break;
 case 'rescue':
  for(const side of [0,1])for(let j=0;j<4;j++){const x=side?1904-j*19:16+j*19;const fn=u=>[x+Math.sin(u*6)*9,813-u*579];curve(fn,'#65a9d5',2,.15);wake(fn,p*1.3-j*.07,j%2?'#d57b76':'#ffda87',2.7,.31);}
  for(let j=0;j<11;j++){const x=420+j*105;shape([[x-12,1065],[x,1052],[x+12,1065],[x,1072]],'#e1c17f2a',null);line([[x-12,1065],[x,1052],[x+12,1065]],'#dcbf7c',1.2,.4);}break;
 case 'confusion':
  for(const side of [0,1])for(let j=0;j<7;j++){const x=side?1889:31,y=248+j*83;ring(x,y,14,5,'#92c6ae',1,.35);wake(u=>[x+Math.cos(u*tau)*14,y+Math.sin(u*tau)*5],p*1.21-j*.04,'#c4efb4',2.2,.28);}
  for(let j=0;j<15;j++){const x=398+j*79;disc(x,1048,2,2,'#badab6');line([[x,1038],[x,1058]],'#7da19b',1,.3);}break;
 }
 c.restore();
}
