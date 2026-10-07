// Sound-specific casts and supporting actions. Original audio is the sole clock.
const PLAYFUL_SOUND_STYLES=new Set(['crabs','coffin','disco','mash','balloons','rats','shades','equalizer','nyan','tantrum','kitchen','meltdown','rewind','spill','heartbreak']);
const PLAYFUL_SOUND_SCENES=new Set(['isolation','prowler','rescue','confusion']);
function playfulSound(c,t,d,e){
 const key=PLAYFUL_SOUND_SCENES.has(e.scene)?e.scene:e.style;
 if(!PLAYFUL_SOUND_STYLES.has(key)&&!PLAYFUL_SOUND_SCENES.has(key))return false;
 const{p,prop,local,line,oval,poly,box,face,trail,sparkle,scatter,bubbles,words}=playfulInk(c,t,d),beat=t*(e.bpm||120)/60,q=smooth(p),b=Math.sin(beat*Math.PI*2);
 const pink='#ffb0cc',mint='#a3e6d6',gold='#ffe097',blue='#a4d9ff',lilac='#c6b4ff',coral='#ffaf87';
 const dancer=(type,x,y,s,col,phase=0,mood='happy')=>prop(type,x,y+Math.sin(beat*Math.PI*2+phase)*9,s*(1+Math.sin(beat*Math.PI*2+phase)*.035),Math.sin(beat*Math.PI+phase)*.13,col,mood);
 const stage=(fn,col,delay=0,width=3)=>trail(fn,col,delay,width);
 c.save();
 playfulSoundSet(c,t,d,e,key);
 switch(key){
 case 'crabs':
  for(const[x,y,s,phase]of [[91,316,.9,0],[104,634,1.02,1.1],[1829,464,1.19,2.1],[1860,741,.67,3.4],[558,1048,.5,1.7],[1420,1047,.58,4.1]]){dancer('crab',x,y,s,coral,phase);if(phase<3)prop('disco',x,y-75,s*.36,t*.4,gold);}
  for(let j=0;j<5;j++)stage(u=>[19+j*14+Math.sin(u*9+t*.4+j)*13,220+u*576],j%2?mint:blue,j*.11,2.4);
  for(let j=0;j<9;j++){const x=426+j*134;local(x,67+Math.sin(t*2+j)*5,.4,Math.sin(t+j)*.09,()=>{oval(0,0,29,17,'#ffc4b6');for(let n=-2;n<=2;n++)line([[0,13],[n*9,-11]],gold,1.4);});}bubbles(1880,805,blue,12);words('CRUSTACEAN DANCE FLOOR',1040,1056,gold,17);break;
 case 'coffin':{
  const x=990+Math.sin(beat*Math.PI)*48,y=69+b*5;
  local(x,y,1,Math.sin(beat)*.045,()=>{poly([[-153,-18],[-126,-43],[127,-43],[153,-18],[142,27],[-140,27]],'#8c77ad');line([[-125,-27],[122,-27],[131,15],[-129,15],[-125,-27]],gold,3);line([[0,-26],[0,12]],gold,4);line([[-12,-8],[12,-8]],gold,4);});
  for(let j=0;j<4;j++){const xx=629+j*239;dancer('bean',xx,1034,.69,'#9d8dbe',j*.8);local(xx,1018,.8,Math.sin(beat+j)*.06,()=>{box(-31,-13,62,17,6,'#34425e');box(-20,-37,40,29,6,'#34425e');box(-23,2,46,9,3,'#34425e');oval(-11,6,3,3,blue);oval(11,6,3,3,blue);});}
  dancer('ghost',85,424,1.0,blue,1);dancer('ghost',1840,524,.91,lilac,2.7);prop('bow',89,457,.5,b*.06,gold);prop('bow',1840,557,.45,-b*.08,pink);
  stage(u=>[25+Math.sin(u*15-t)*24,220+u*580],lilac);stage(u=>[1885-Math.sin(u*12+t)*24,787-u*547],gold,.12);scatter(80,741,gold,12,.1);words('ONE LAST GROOVE',1450,1057,lilac,18);break;}
 case 'disco':
  prop('disco',1030,70,1.22,t*.32,lilac);for(let j=0;j<5;j++){const x=458+j*248;dancer('star',x,1043,.61,[pink,mint,gold,blue,lilac][j],j);}
  for(const[x,y,col]of [[91,371,pink],[1840,530,mint]]){dancer('bean',x,y,1.12,col,x*.01);local(x,y+54,.8,Math.sin(beat)*.14,()=>{box(-37,-8,73,22,7,lilac);for(const xx of [-24,24])oval(xx,20,9,9,gold);});}
  for(let j=0;j<7;j++){stage(u=>[20+j*12+Math.sin(u*13+t+j)*12,207+u*589],[pink,mint,lilac][j%3],j*.07,2.7);stage(u=>[1900-j*12-Math.sin(u*12-t+j)*12,793-u*587],[gold,blue,pink][j%3],j*.08,2.5);}scatter(1050,73,gold,15);words('THE FLOOR IS YOURS',1360,1059,mint,18);break;
 case 'mash':
  prop('book',91,550,1.1,-.13,lilac);dancer('bean',99,370,.96,gold,0);local(103,315,.8,Math.sin(beat)*.08,()=>poly([[-29,7],[0,-53],[28,7]],lilac));prop('star',1840,458,1.09,t*.3,gold);
  for(let j=0;j<6;j++)prop('note',1798+j%2*74,250+j*103+Math.sin(beat+j)*14,.46,t*.08,mint);for(let j=0;j<8;j++)sparkle(400+j*156,67+Math.sin(beat+j)*9,.68,[mint,pink,gold][j%3],t*.2+j);
  stage(u=>[50+Math.sin(u*17)*32,763-u*559],gold);stage(u=>[350+u*1260,1051+Math.sin(u*17-t)*12],lilac,.1);words('ABSOLUTELY SPELLBOUND',1170,1055,gold,18);break;
 case 'balloons':
  for(const[x,y,s,col,phase]of [[60,343,1.09,pink,0],[148,447,.81,gold,1],[79,636,.72,lilac,2],[1841,331,1.12,mint,3],[1796,610,.83,blue,4],[1880,680,.65,pink,5]])prop('balloon',x+Math.sin(t*.8+phase)*13,y-q*84+Math.sin(t*1.3+phase)*8,s,Math.sin(t+phase)*.1,col);
  prop('cake',1843,806,.72,Math.sin(beat)*.07,pink);for(let j=0;j<5;j++)dancer('star',484+j*234,1044,.45,[pink,mint,gold,blue,lilac][j],j);
  for(let j=0;j<4;j++){scatter(420+j*345,53,[pink,mint,gold,lilac][j],9,j*.08);stage(u=>[320+u*1280,43+j*10+Math.sin(u*11+t+j)*7],[pink,mint,gold,lilac][j],j*.12);}words('A LITTLE EXCESSIVE? PERFECT.',990,1061,pink,17);break;
 case 'rats':
  for(const[x,y,s,phase]of [[93,337,.92,0],[1860,482,1.0,1.7],[89,664,.7,3.2],[1480,1049,.48,2.2]])dancer('rat',x,y,s,'#bac7e3',phase);prop('disco',1220,68,.95,t*.6,pink);
  for(let j=0;j<5;j++){const x=448+j*223;local(x,1054,.6,Math.sin(beat+j)*.07,()=>{poly([[-26,18],[-26,-18],[23,0],[23,18]],gold);for(const[xx,yy,r]of [[-14,-6,4],[-12,9,3],[9,9,3]])oval(xx,yy,r,r,'#d2a767');});}
  for(const side of [0,1])for(let j=0;j<4;j++)stage(u=>[side?1880-j*15:23+j*15,232+u*565],j%2?pink:blue,j*.12+side*.04);words('UNLICENSED BASEMENT DISCO',914,60,pink,16);break;
 case 'shades':
  for(const[x,y,s,phase]of [[88,448,1.15,0],[1835,583,.93,2],[543,1041,.48,1],[1421,1047,.56,3]]){dancer('star',x,y,s,blue,phase);local(x,y-4+Math.sin(beat*Math.PI*2+phase)*9,s,Math.sin(beat*Math.PI+phase)*.13,()=>{box(-23,-10,21,13,4,'#34425e');box(3,-10,21,13,4,'#34425e');line([[-3,-5],[4,-5]],gold,2);line([[-19,-7],[-8,-7]],mint,1.5);});}
  prop('crown',1120,64,.97,b*.06,gold);for(let j=0;j<4;j++)stage(u=>[1894-j*13-Math.sin(u*Math.PI)*16,210+u*579],blue,j*.12,2.8);stage(u=>[360+u*1200,1059-Math.sin(u*12)*13],gold);scatter(81,280,mint,10,.08);words('EFFORTLESSLY UNBOTHERED',1280,1059,blue,17);break;
 case 'equalizer':
  for(const side of [0,1])for(let j=0;j<6;j++){const x=side?1883-j*19:23+j*19,y=735;const height=70+Math.abs(Math.sin(beat*2.2+j*.7+side))*380;c.save();c.globalAlpha*=.34;box(x-5,y-height,10,height,5,[mint,pink,lilac][j%3]);c.restore();}
  dancer('rocket',99,459,.88,mint,0);dancer('star',1830,495,1.13,gold,1);for(let j=0;j<8;j++)prop('bolt',419+j*149,65,.42,Math.sin(beat+j)*.2,j%2?mint:pink);
  stage(u=>[330+u*1290,1053+Math.sin(u*21-t*2)*11],mint);scatter(1824,720,pink,15,.09);words('EVERYBODY WAKE UP',984,1059,mint,19);break;
 case 'nyan':
  for(const[x,y,s,phase]of [[94,350,.94,0],[1837,552,1.06,1.6],[93,700,.74,3],[635,1048,.45,2]])dancer('cat',x,y,s,pink,phase);
  for(let j=0;j<5;j++){const col=[pink,gold,mint,blue,lilac][j];stage(u=>[22+j*12+Math.sin(u*12-t)*13,240+u*549],col,j*.09,4);stage(u=>[390+u*1150,1045+j*5+Math.sin(u*11-t)*6],col,j*.1,3);}
  for(let j=0;j<6;j++)prop('paw',428+j*206,57,.38,Math.sin(beat+j)*.12,[mint,pink,gold][j%3]);bubbles(1872,800,lilac,9);words('MEOWS PER MINUTE: UNLIMITED',1080,71,pink,17);break;
 case 'tantrum':
  dancer('bean',93,399,.98,pink,0,'shock');prop('hammer',117,316,.63,-.5+Math.sin(beat*2)*.5,gold);for(let j=0;j<5;j++){const y=257+j*112;prop('cloud',1832+j%2*47,y+Math.sin(t*2+j)*8,.49,Math.sin(t+j)*.1,lilac,'shock');}
  local(82,595,1,0,()=>{box(-45,82,88,13,6,lilac);const len=112+b*19;const pts=[];for(let j=0;j<81;j++){const u=j/80;pts.push([Math.sin(u*Math.PI*14)*27,-24+u*len]);}line(pts,mint,7);box(-44,-35,88,16,6,lilac);});scatter(97,416,gold,12,.12);stage(u=>[344+u*1230,1053+Math.sin(u*18)*15],pink);words('TEMPER: UNDER CONSTRUCTION',1100,62,pink,17);break;
 case 'kitchen':
  local(91,519,1.1,-.14+b*.06,()=>{oval(0,0,52,29,'#dfb088');oval(0,-3,43,21,'#55627d');line([[44,0],[102,-17]],'#c9d9ed',10);oval(-6,-8,23,15,'#fff0d6');oval(-6,-8,10,10,gold);face(-6,-8,'shock',.4);});prop('cloud',82,313,.76,Math.sin(t*2)*.06,'#e9e4ff','shock');
  for(let j=0;j<4;j++){prop('bean',1840,314+j*133,.68,Math.sin(beat+j)*.1,coral,'shock');local(1840,275+j*133,.65,0,()=>{box(-27,-8,54,13,5,'#f3ecd9');oval(-16,-15,13,12,'#f3ecd9');oval(0,-19,15,14,'#f3ecd9');oval(16,-15,13,12,'#f3ecd9');});}bubbles(90,484,gold,9);stage(u=>[365+u*1190,1055+Math.sin(u*14-t)*13],coral);words('OFFICIALLY COOKED',1078,61,gold,20);break;
 case 'meltdown':
  for(const[x,y,s,phase]of [[89,327,.76,0],[119,628,1.0,1.3],[1840,479,1.08,2.6]]){prop('alarm',x,y,s,Math.sin(beat*3+phase)*.2,pink);scatter(x,y,gold,8,phase*.04);}prop('bean',1027,68,.8,-b*.13,blue,'shock');
  for(let j=0;j<6;j++)stage(u=>[1900-j*14+Math.sin(u*18-t+j)*9,213+u*588],[pink,gold,blue][j%3],j*.1,2.8);for(let j=0;j<5;j++)prop('heart',486+j*226,1048,.38,Math.sin(t*2+j)*.1,lilac,'shock');words('PANIC, BUT MAKE IT COORDINATED',1100,1059,pink,17);break;
 case 'rewind':
  prop('alarm',94,429,1.14,-q*.5,blue);prop('eye',1841,378,.99,swayAngle(t),mint);prop('book',1831,614,.83,.1,lilac);
  for(let j=0;j<5;j++){const x=451+j*226;local(x,1048,.65,-.12,()=>{box(-30,-18,60,37,5,'#cadcf4');face(0,0,j%2?'shock':'sleep',.7);for(const xx of [-25,25])for(let n=0;n<3;n++)box(xx-2,-11+n*10,4,5,1,'#455772');});}
  stage(u=>[60+Math.sin(u*10)*22,729-u*511],pink);stage(u=>[1600-u*1270,42+Math.sin(u*8)*15],blue);words('LET’S REVIEW THE EVIDENCE',1000,70,blue,18);break;
 case 'spill':
  prop('potion',99,402,.98,-.15+q*.65,mint,'shock');for(let j=0;j<8;j++){const a=Math.max(0,p*1.3-j*.05);prop('bean',86+a*73,448+a*a*294,.25+j%2*.06,a*.8,j%2?mint:lilac,'shock');}dancer('frog',1840,572,.94,mint,1,'shock');prop('cloud',1830,317,.75,.09,blue,'shock');bubbles(1870,738,mint,10);stage(u=>[380+u*1180,1057+Math.sin(u*16-t)*12],mint);words('GRAVITY WINS THIS ROUND',1100,63,mint,18);break;
 case 'heartbreak':
  prop('heart',1835,422,1.1,swayAngle(t),pink,'sad');prop('cloud',89,355,1.04,-.1,blue,'sad');prop('ghost',103,680,.78,.1,lilac,'sad');prop('note',1833,674,.85,-.2,lilac);
  for(let j=0;j<7;j++){const yy=360+q*320-j*43;prop('bean',45+j%2*104,yy,.23,0,blue,'sad');}for(let j=0;j<6;j++)prop('heart',460+j*205,1050+Math.sin(t*1.6+j)*6,.34,Math.sin(t+j)*.1,j%2?lilac:pink,'sad');stage(u=>[353+u*1240,47+Math.sin(u*9)*12],pink);words('A VERY SMALL PERSONAL TRAGEDY',1100,66,pink,17);break;
 case 'isolation':
  prop('cloud',90,272,.97,-.1,blue,'sleep');prop('bean',97,525,1.08,.04,lilac,'sad');local(97,403,.91,0,()=>{poly([[-67,0],[-52,-31],[0,-55],[52,-31],[67,0]],blue);line([[0,-48],[0,107],[17,117],[28,110]],gold,4);});prop('moon',1836,397,.98,-.2,gold);prop('book',1851,640,.8,.12,lilac);
  for(let j=0;j<7;j++)sparkle(474+j*163,1053+Math.sin(t*.7+j)*6,.34,lilac,j*.2);stage(u=>[1890+Math.sin(u*7)*13,249+u*474],blue);words('SOCIAL BATTERY: RECHARGING',1030,63,blue,17);break;
 case 'prowler':
  for(const[x,y,s,flip]of [[87,425,1.06,1],[1841,584,.92,-1]]){local(x,y,s,Math.sin(t)*.03,()=>{poly([[-45,40],[-34,-20],[-22,-45],[0,-24],[22,-45],[34,-20],[45,40]],'#716095');oval(0,-3,28,23,'#4a426c');for(const side of [-1,1]){line([[side*7,-5],[side*20,-8]],'#c5f3c7',4);line([[side*7,-4],[side*20,-7]],'#fff4d0',1);}});}
  for(let j=0;j<5;j++){const y=242+j*123;stage(u=>[20+u*92,y+Math.sin(u*Math.PI)*18],j%2?mint:lilac,j*.09,2.8);local(1878,y,1,0,()=>{box(-15,-16,30,32,3,'#5b5281');line([[-14,0],[14,0]],lilac,1,.6);});}prop('moon',1098,64,.66,-.2,lilac);words('SOMETHING IN THE SHADOWS',930,1058,lilac,16);break;
 case 'rescue':
  prop('heart',89,452,1.11,swayAngle(t),pink);local(99,605,1,0,()=>{oval(0,0,51,46,'#fff0d5');oval(0,0,29,25,'#486c89');for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5])local(Math.cos(a)*40,Math.sin(a)*34,1,a,()=>box(-11,-12,22,24,4,coral));});prop('star',1842,443,1.04,-swayAngle(t),gold);prop('bow',1841,488,.48,.1,mint);
  for(let j=0;j<4;j++)prop('heart',446+j*304,65,.48,Math.sin(t*2+j)*.1,j%2?mint:pink);stage(u=>[35+Math.sin(u*12)*24,774-u*562],mint);stage(u=>[1879+Math.sin(u*13)*19,774-u*548],gold,.12);scatter(1850,296,mint,13,.13);words('CLUTCH HUMAN. EXCELLENT TIMING.',1130,1056,gold,17);break;
 case 'confusion':
  prop('eye',91,399,1.12,Math.sin(t*2)*.12,lilac);prop('bean',1843,465,1.1,-Math.sin(t*2)*.13,blue,'shock');prop('gear',1826,659,.77,t*.33,pink);
  for(const[x,y,s,phase]of [[65,651,1,0],[1835,281,.75,1],[523,66,.72,2],[1340,1050,.73,3]]){local(x,y,s,Math.sin(t*2+phase)*.12,()=>{words('?',0,13,[pink,mint,gold,lilac][phase],58);});}for(let j=0;j<8;j++){const x=400+j*163;local(x,1043,.55,t*.17+j,()=>box(-13,-13,26,26,5,j%2?mint:lilac));}stage(u=>[21+Math.sin(u*24)*18,215+u*551],lilac);stage(u=>[360+u*1200,46+Math.sin(u*17)*18],pink,.11);words('EXCUSE ME, THE PHYSICS?',963,63,lilac,18);break;
 }
 playfulSoundActs(c,t,d,key);
 c.restore();return true;
}
function swayAngle(t){return Math.sin(t*1.8)*.09;}
function playfulSoundAccents(c,t,d,e){
 const {p,prop,trail,sparkle,scatter,bubbles,local,line,box,oval,words}=playfulInk(c,t,d),beat=t*(e.bpm||120)/60;
 const mint='#a9e8d7',pink='#ffb6d2',gold='#ffe5aa',blue='#a4dfff',lilac='#cdbaff';
 c.save();c.globalAlpha*=smooth(t/Math.min(.12,d*.09))*smooth((d-t)/Math.min(.2,d*.1));
 switch(e.scene||e.style){
 case 'muffins':
  for(let j=0;j<6;j++)prop('note',526+j*179,1046+Math.sin(beat*2+j)*5,.28,Math.sin(beat+j)*.1,j%2?pink:gold);scatter(1882,409,gold,7,.1);scatter(38,652,pink,7,.23);break;
 case 'lizard':
  for(let j=0;j<4;j++){const x=j%2?1852:72,y=231+j*161;prop('star',x,y,.44,Math.sin(t*5+j)*.17,j%2?gold:mint);scatter(x,y,gold,6,j*.045);}trail(u=>[362+u*1168,1055+Math.sin(u*13)*14],mint);break;
 case 'gary':
  for(let j=0;j<5;j++){prop('note',1824+j%2*58,254+j*110,.36,Math.sin(t*4+j)*.12,j%2?pink:mint);prop('paw',468+j*216,1051,.27,Math.sin(t*4+j)*.1,pink);}bubbles(40,723,mint);break;
 case 'quack':
  prop('duck',1839,669,.63,-.15,gold);prop('duck',1132,66,.48,.12,pink);bubbles(40,789,blue,10);trail(u=>[350+u*1250,1059-Math.sin(u*15)*14],gold);break;
 case 'bonk':
  prop('star',1837,349,.63,-.1,gold,'shock');prop('cloud',94,703,.54,.1,blue,'shock');scatter(1850,347,pink,12,.09);for(let j=0;j<5;j++)sparkle(570+j*187,1055,.34,gold,t*.2+j);break;
 case 'piuw':
  prop('star',1842,342,.69,t*.35,gold);prop('moon',98,714,.56,-.2,lilac);scatter(1802,719,pink,11,.12);trail(u=>[357+u*1180,64+Math.sin(u*12)*15],mint);break;
 case 'mom-frog':
  for(const[x,y,s,a]of [[1777,762,.52,.12],[154,231,.4,-.12],[1382,1038,.36,.08]])prop('frog',x,y+Math.sin(beat*2)*7,s,a,mint);for(let j=0;j<4;j++)prop('note',1841+j%2*47,219+j*128,.42,Math.sin(beat+j)*.14,j%2?pink:gold);bubbles(29,644,mint,9);break;
 case 'raccoon':
  prop('disco',1210,61,.71,t*.36,lilac);for(let j=0;j<7;j++){const x=384+j*176;prop('note',x,1044+Math.sin(beat*2+j)*6,.34,Math.sin(beat+j)*.2,[mint,pink,gold][j%3]);}scatter(1872,769,pink,12,.08);scatter(58,744,gold,11,.19);break;
 case 'violin':
  prop('cloud',1794,806,.63,Math.sin(t)*.07,blue,'sad');prop('heart',1254,1034,.44,.09,pink,'sad');for(let j=0;j<5;j++)prop('note',478+j*191,62+Math.sin(t*2+j)*7,.33,Math.sin(t+j)*.1,lilac);bubbles(32,679,blue);break;
 case 'arena':
  for(let j=0;j<5;j++)sparkle(415+j*266,1055,.4,gold,Math.sin(t*2+j)*.12);scatter(1870,783,gold,9,.12);break;
 case 'racing':
  // Keep the approved car/gear choreography; miniature flags decorate the runoff.
  for(const[x,y,a]of [[144,813,-.25],[1775,233,.25]])local(x,y,.45,a,()=>{line([[0,0],[0,56]],'#c9e5ff',4);for(let j=0;j<4;j++)for(let n=0;n<3;n++)box(n*9,-3+j*9,9,9,1,(j+n)%2?'#31445e':'#e6edff');});break;
 }
 c.restore();
}
