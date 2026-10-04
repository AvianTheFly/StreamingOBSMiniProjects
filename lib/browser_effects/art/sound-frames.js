// Sound-specific structural borders. Compiled into rave.js, below its imports.
function soundFrame(c,k,t,p,a,b){
 const m=new FrameMaterial(c),w=new WorldPaint(c),metal='#172631',phase=.14+p*.74;
 const band=(points,width=15,ink=metal,color=a)=>m.band(typeof points==='function'?points:pathOf(points),width,ink,color,p);
 const plate=(pts,ink=metal,color=a,alpha=.86)=>m.panel(pts,ink,color,phase,alpha);
 const glass=(pts,color=a)=>m.glass(pts,color,phase,.64);
 c.save();
 if(k==='racing'){
  // A carbon-fibre circuit housing: banked kerbs, aero cut-outs, red brake light.
  plate([[280,0],[731,0],[704,23],[363,23],[323,53],[282,53]],'#14212b',b);
  plate([[1170,0],[1634,0],[1634,24],[1280,24],[1238,47],[1192,47]],'#18222b',a);
  for(const [x,s]of [[0,1],[1920,-1]]){plate([[x,184],[x+s*31,212],[x+s*31,365],[x+s*13,389],[x+s*13,649],[x,673]],'#141e28',b);for(let j=0;j<7;j++)plate([[x,260+j*39],[x+s*26,238+j*39],[x+s*26,250+j*39],[x,274+j*39]],'#b44152',j%2?a:'#d5e7e8',.68);}
  plate([[385,1080],[405,1048],[702,1048],[747,1063],[1160,1063],[1200,1040],[1455,1040],[1502,1080]],'#18242b',b);
  for(let j=0;j<18;j++){const x=428+j*55;w.beam([[x,1063],[x+19,1054]],j%2?a:'#e2ebed',5,.7);}
  m.lights(pathOf([[0,680],[18,655],[18,222],[47,194],[256,194]]),p,b,0,4);
 }else if(k==='coffin'){
  // Tall tapering vaults are structural stone, rather than a prop procession.
  for(const[x,s]of [[0,1],[1920,-1]]){plate([[x,120],[x+s*25,161],[x+s*43,238],[x+s*43,734],[x+s*20,860],[x,882]],'#191927',b);plate([[x+s*9,210],[x+s*24,238],[x+s*24,732],[x+s*9,793]],'#302542',a,.78);band([[x+s*51,711],[x+s*51,252],[x+s*74,174],[x+s*103,135]],6,'#302636',b);}
  plate([[259,0],[643,0],[690,26],[794,26],[816,44],[630,44],[593,21],[283,21]],'#191927',b);
  plate([[1126,0],[1650,0],[1628,22],[1290,22],[1247,42],[1103,42]],'#191927',b);
  for(let j=0;j<7;j++){const x=505+j*146;plate([[x,1080],[x+18,1043],[x+74,1043],[x+96,1080]],'#202132',j%2?b:a);}
 }else if(k==='crabs'){
  // A sculpted tidal edge, three different depth planes and foam-lit crests.
  for(let j=0;j<3;j++){const path=u=>[u*1920,1067-j*13-18*Math.sin(u*12-t*.19+j*.8)];band(path,12-j*2,j===0?'#153e48':'#245b62',j%2?'#74e8d0':'#74cddb');}
  for(const[x,s]of [[0,1],[1920,-1]])for(let j=0;j<3;j++)band(u=>[x+s*(8+j*12+Math.sin(u*9+t*.13+j*.6)*9),150+u*547],8-j,'#175563',j%2?b:a);
  for(let j=0;j<11;j++){const x=290+j*117;glass([[x,0],[x+116,0],[x+76,18+Math.sin(j+t*.15)*7],[x+19,12]],j%3? a:b);}
 }else if(k==='rewind'){
  for(const[x,s]of [[0,1],[1920,-1]]){plate([[x,155],[x+s*31,181],[x+s*31,753],[x+s*12,790],[x,790]],'#282821',b);for(let j=0;j<25;j++){const y=176+j*23;w.beam([[x+s*7,y],[x+s*14,y]],'#d7d7b6',4,.6);w.beam([[x+s*24,y],[x+s*30,y]],a,1,.55);}}
  band([[290,13],[610,13],[646,36],[1190,36],[1230,13],[1590,13]],17,'#312a25',a);
  band(u=>[360+u*1140,1061-Math.sin(u*TAU+p*1.6)*9],21,'#302b25',b);
  for(let j=0;j<41;j++){const x=360+(j*29+p*130)%1160,y=1061-Math.sin((x-360)/1140*TAU+p*1.6)*9;w.beam([[x,y-6],[x+5,y-6]],a,2,.75);}
 }else if(k==='violin'){
  for(const[x,s]of [[0,1],[1920,-1]]){const curve=u=>[x+s*(13+18*Math.sin(u*Math.PI)),160+u*624];band(curve,22,'#462632',a);for(let j=0;j<3;j++)band(u=>{const[X,Y]=curve(u);return[X+s*(17+j*6),Y];},1.6,'#51383f',j%2?b:a);}
  plate([[388,1080],[430,1054],[659,1043],[916,1056],[1200,1045],[1480,1061],[1520,1080]],'#402d33',a);
  for(let j=0;j<21;j++){const x=436+j*45;w.beam([[x,1055],[x+26,1069]],a,.8,.35);}
  band(u=>[292+u*1312,12+Math.sin(u*Math.PI)*18],8,'#492e36',a);
 }else if(k==='kitchen'){
  band([[9,795],[9,272],[39,242],[39,165]],18,'#573d32','#e0a273');
  band([[1909,158],[1909,600],[1872,637],[1872,754]],16,'#453830','#bd8c61');
  band([[310,11],[616,11],[645,40],[840,40]],13,'#413336',b);
  band([[1110,15],[1560,15]],13,'#583d2f',a);
  band([[405,1071],[660,1071],[690,1047],[1180,1047],[1204,1069],[1480,1069]],18,'#543c2b',a);
  for(const[x,y]of [[9,380],[9,650],[1909,290],[1909,499],[793,1047],[1080,1047]])plate([[x-7,y-13],[x+7,y-13],[x+7,y+13],[x-7,y+13]],'#433126','#f2d1a0');
 }else if(k==='disco'){
  for(const[x,s]of [[0,1],[1920,-1]])for(let j=0;j<19;j++){const y=138+j*29,z=11+10*Math.sin(j*.51+t*.22);plate([[x,y],[x+s*z,y-9],[x+s*(z+20),y+6],[x+s*20,y+22]],j%3?'#2a2c40':'#142f38',j%2?a:b,.68);}
  for(let j=0;j<26;j++){const x=305+j*49,yy=Math.sin(j*.5)*7;plate([[x,0],[x+45,0],[x+32,26+yy],[x+6,20+yy]],'#293145',j%2?a:b,.75);}
  for(let j=0;j<20;j++){const x=422+j*53;glass([[x,1080],[x+13,1049],[x+54,1039],[x+43,1080]],j%2?a:b);}
 }else if(k==='arena'){
  for(const[x,s]of [[0,1],[1920,-1]]){plate([[x,151],[x+s*37,183],[x+s*37,602],[x+s*15,632],[x,631]],'#222831',a);for(let j=0;j<8;j++){const y=203+j*48;plate([[x+s*9,y],[x+s*28,y-12],[x+s*28,y+19],[x+s*9,y+31]],'#695432',b,.6);}}
  plate([[270,0],[778,0],[807,27],[735,43],[346,43],[315,24],[270,24]],'#363329',a);
  plate([[1150,0],[1650,0],[1606,35],[1220,35]],'#37362c',a);
  plate([[380,1080],[408,1044],[713,1044],[739,1023],[1180,1023],[1210,1044],[1482,1044],[1520,1080]],'#393126',a);
  m.lights(pathOf([[405,1058],[702,1058],[742,1036],[1180,1036],[1219,1058],[1490,1058]]),p,b,0,4);
 }else if(k==='equalizer'){
  for(const[x,s]of [[0,1],[1920,-1]]){plate([[x,158],[x+s*39,186],[x+s*39,717],[x,747]],'#182c2a',a);for(let j=0;j<36;j++){const y=186+j*14,amp=.25+.75*(.5+.5*Math.sin(j*.43+t*1.9));w.beam([[x+s*7,y],[x+s*(8+23*amp),y]],j%3?a:b,3,.8);}}
  for(let j=0;j<37;j++){const x=410+j*29,h=12+17*(.5+.5*Math.sin(j*.34+t*1.5));plate([[x,1080],[x,1080-h],[x+18,1076-h],[x+18,1080]],'#1c332d',j%3?a:b,.72);}
  band([[303,13],[767,13],[790,34],[1115,34],[1137,13],[1590,13]],9,'#162b27',b);
 }else if(k==='shades'){
  for(const[x,s]of [[0,1],[1920,-1]]){plate([[x,132],[x+s*29,166],[x+s*29,296],[x+s*14,361],[x+s*14,720],[x,751]],'#1d2c39','#c2dbe6');band([[x+s*37,196],[x+s*37,299],[x+s*22,362],[x+s*22,650]],3,'#304253',a);}
  plate([[330,0],[766,0],[713,29],[432,29],[401,50],[330,50]],'#1c2936',b);
  plate([[1145,0],[1590,0],[1558,21],[1210,21]],'#1d2a38',a);
  plate([[396,1080],[430,1056],[692,1056],[753,1070],[1220,1050],[1490,1050],[1530,1080]],'#1c2b39',b);
 }else if(k==='meltdown'){
  for(const[x,s]of [[0,1],[1920,-1]])for(let j=0;j<6;j++){const y=175+j*94,shift=Math.sin(j*1.8+p*3)*4;plate([[x,y],[x+s*(31+shift),y+14],[x+s*(42+shift),y+57],[x+s*17,y+85],[x,y+76]],'#271c2b',j%2?a:b);}
  for(let j=0;j<7;j++){const x=342+j*174;plate([[x,0],[x+151,0],[x+129,26],[x+65,35],[x+17,17]],'#301d2a',a);}
  for(let j=0;j<10;j++){const x=420+j*108;plate([[x,1080],[x+12,1048],[x+77,1037],[x+102,1080]],'#251d29',j%3?a:b);}
 }else if(k==='heartbreak'){
  for(const[x,s]of [[0,1],[1920,-1]])for(let j=0;j<11;j++){const y=141+j*51;glass([[x,y],[x+s*(19+j%3*8),y+9],[x+s*48,y+37],[x+s*15,y+61],[x,y+47]],j%3?a:b);}
  for(let j=0;j<13;j++){const x=360+j*90;glass([[x,1080],[x+21,1031+Math.sin(j)*9],[x+77,1055],[x+90,1080]],j%2?a:b);}
  band(u=>[321+u*1240,12+Math.sin(u*9+p*.3)*9],5,'#593548',a);
 }else if(k==='spill'){
  for(let j=0;j<3;j++)band(u=>[u*1920,1065-j*12+Math.sin(u*14-t*.21+j*.3)*12],11-j*2,'#365941',j%2?a:b);
  for(const[x,s]of [[0,1],[1920,-1]])band(u=>[x+s*(15+14*Math.sin(u*12+t*.2)),170+u*567],18,'#315b46',a);
  for(let j=0;j<17;j++){const x=338+j*74;glass([[x,0],[x+58,0],[x+63,10],[x+21,27],[x,15]],j%2?a:b);}
 }else if(k==='sparkles'||k==='oops'){
  for(const[x,s]of [[0,1],[1920,-1]])for(let j=0;j<9;j++){const y=147+j*65,dx=k==='oops'?Math.sin(j*2+p)*11:0;glass([[x,y],[x+s*(25+dx),y+5],[x+s*(47+dx),y+37],[x+s*21,y+65],[x,y+53]],j%2?a:b);band([[x+s*23,y+7],[x+s*43,y+37],[x+s*19,y+63]],2,'#263047',b);}
  for(let j=0;j<12;j++){const x=343+j*100,depth=k==='oops'?13+j%3*8:30*Math.sin((j+.5)/12*Math.PI);glass([[x,0],[x+95,0],[x+65,depth],[x+14,depth+9]],j%3?a:b);}
  if(k==='sparkles')for(let j=0;j<12;j++){const x=432+j*87;glass([[x,1080],[x+28,1044],[x+85,1035],[x+69,1080]],j%2?a:b);}
  else band([[391,1067],[681,1067],[697,1048],[1020,1048],[1042,1070],[1510,1070]],9,'#282b43',a);
 }else if(k==='rats'){
  for(const[x,s]of [[0,1],[1920,-1]]){band([[x+s*12,137],[x+s*30,173],[x+s*30,712],[x+s*12,744]],18,'#283933',b);for(let j=0;j<11;j++)plate([[x,168+j*48],[x+s*42,186+j*48],[x+s*42,197+j*48],[x,180+j*48]],'#2c303a',a);}
  for(let j=0;j<19;j++){const x=403+j*59;plate([[x,1080],[x+17,1052],[x+46,1052],[x+56,1080]],'#25352e',b);}
  band([[333,15],[1510,15]],15,'#23342d',a);
 }else if(k==='raccoon'){
  for(const[x,s]of [[0,1],[1920,-1]])for(let j=0;j<7;j++){const y=170+j*86;band(u=>[x+s*(7+Math.sin(u*Math.PI)*(28+j%2*9)),y+u*82],10,'#28292e',j%2?a:b);}
  for(let j=0;j<5;j++)band(u=>[360+u*1210,5+j*5+Math.sin(u*Math.PI)*24],2,'#3e3226',j%2?a:b);
  plate([[385,1080],[425,1037],[563,1037],[588,1060],[1260,1060],[1291,1037],[1472,1037],[1510,1080]],'#2b3030',b);
 }else if(k==='balloons'){
  for(const[x,s]of [[0,1],[1920,-1]])for(let j=0;j<9;j++)band(u=>[x+s*(11+Math.sin(u*Math.PI)*24),170+j*60+u*59],11,'#5b3e50',j%2?a:b);
  for(let j=0;j<12;j++)band(u=>[335+j*100+u*97,8+Math.sin(u*Math.PI)*19],8,'#54434d',j%2?a:b);
  for(let j=0;j<11;j++){const x=430+j*94;glass([[x,1080],[x+18,1053],[x+71,1041],[x+91,1080]],j%2?a:b);}
 }else if(k==='nyan'){
  const spectrum=['#df89c3','#e9bd82','#8ed9ac','#80cddc','#b4a4e7'];
  for(let j=0;j<5;j++){const color=spectrum[j];band(u=>[305+u*1260,5+j*4+Math.sin(u*Math.PI)*25],3,'#293249',color);band(u=>[390+u*1150,1075-j*4-Math.sin(u*Math.PI)*19],3,'#293249',color);}
  for(const[x,s]of [[0,1],[1920,-1]])for(let j=0;j<13;j++){const y=159+j*45;glass([[x,y],[x+s*23,y-13],[x+s*39,y+10],[x+s*18,y+35],[x,y+30]],spectrum[j%5]);}
 }else if(k==='muffins'){
  for(const[x,s]of [[0,1],[1920,-1]])for(let j=0;j<18;j++){const y=164+j*29;plate([[x,y],[x+s*29,y-5],[x+s*42,y+12],[x+s*15,y+23],[x,y+22]],'#684832',j%3?a:b,.72);}
  for(let j=0;j<34;j++){const x=386+j*34;plate([[x,1080],[x+7,1052],[x+22,1048],[x+31,1080]],'#584033',j%3?a:b,.79);}
  band(u=>[305+u*1285,13+Math.sin(u*8)*8],13,'#684632',a);
 }else if(k==='arcade'){
  for(const[x,s]of [[0,1],[1920,-1]]){plate([[x,154],[x+s*43,154],[x+s*43,248],[x+s*22,248],[x+s*22,528],[x+s*41,528],[x+s*41,670],[x,710]],'#1c3437',a);for(let j=0;j<14;j++){const y=187+j*33;w.beam([[x+s*7,y],[x+s*17,y]],j%3?a:b,6,.78);}}
  band([[307,12],[646,12],[646,35],[1248,35],[1248,12],[1585,12]],14,'#1d343a',a);
  for(let j=0;j<21;j++){const x=400+j*54;plate([[x,1080],[x,1051],[x+33,1051],[x+33,1080]],'#253843',j%2?a:b,.77);}
 }else if(k==='approval'){
  for(const[x,s]of [[0,1],[1920,-1]]){band([[x+s*12,164],[x+s*25,180],[x+s*25,659],[x+s*12,679]],13,'#2a4a40',a);for(let j=0;j<12;j++){const y=190+j*38;plate([[x+s*9,y],[x+s*38,y-17],[x+s*42,y-5],[x+s*19,y+11]],'#395a43',b,.62);}}
  band([[316,13],[570,13],[593,34],[1300,34],[1321,13],[1580,13]],11,'#294838',b);
  plate([[388,1080],[417,1052],[726,1052],[754,1063],[1170,1063],[1200,1052],[1491,1052],[1520,1080]],'#2e4a3c',a);
 }else if(k==='mash'){
  for(const[x,s]of [[0,1],[1920,-1]]){band([[x+s*15,150],[x+s*15,705]],19,'#4b3e28',a);for(let j=0;j<8;j++){const y=195+j*58;plate([[x,y],[x+s*39,y-20],[x+s*43,y],[x,y+20]],'#403a30',b,.65);}}
  for(let j=0;j<8;j++){const x=360+j*154;plate([[x,0],[x+135,0],[x+108,25],[x+39,35],[x+12,19]],'#584729',a);}
  band([[395,1065],[630,1065],[667,1040],[1240,1040],[1270,1065],[1510,1065]],18,'#4d3d2b',a);
 }else{
  // Bonk is elastic porcelain; the frustrated glove is fractured red enamel.
  const ink=k==='bonk'?'#564052':'#4c2830';
  for(const[x,s]of [[0,1],[1920,-1]]){const path=u=>[x+s*(17+Math.sin(u*Math.PI)*20+Math.sin(u*15-p*5)*5),154+u*598];band(path,k==='bonk'?23:17,ink,a);if(k==='tantrum')for(let j=0;j<9;j++){const y=186+j*54;plate([[x,y],[x+s*44,y+14],[x+s*29,y+35],[x,y+38]],ink,b,.64);}}
  band(u=>[320+u*1260,16+Math.sin(u*Math.PI)*23+Math.sin(u*17-p*6)*4],k==='bonk'?16:11,ink,b);
  band(u=>[389+u*1137,1064-Math.sin(u*Math.PI)*15+Math.sin(u*18-p*6)*4],16,ink,a);
 }
 c.restore();
}
