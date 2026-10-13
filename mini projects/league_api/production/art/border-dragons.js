// Secured drakes: element / buff fantasies, never a claimed soul, terrain change,
// observed heal or execution. Each element has a different visual physical process.
function borderDragon(I){
 const {q,p,dragon,route,fade,gem,glow}=I,open=q(.16,.48);
 dragon(122,492,1.8,'#b6efab',.3+open*.7);
 I.wing(1730,64,2.1,'#f5d692',-1,open);I.wing(301,74,1.9,'#aee4cd',1,open);
 route([[134,675],[114,857],[441,1000],[939,1000]],q(.25,.64),'#a4e6b8',5);
 for(let j=0;j<7;j++){const x=584+j*114,b=q(.31+j*.035,.49+j*.035);fade(b,()=>gem(x,970-Math.sin(b*Math.PI)*30,.53,'#ddda98',j*.4));}
 I.at(1820,627,1,0,()=>{I.arc(0,0,55,76,-2.7,2.7,'#aeddb8',4);I.dragon(0,0,.7,'#fff0bf',open);});
 fade(q(.57,.81),()=>I.spark(962,987,(p-.57)/.3,'#f5eac2',17,107));
}
function borderMountain(I){
 const {q,p,poly,glow,shield,route}=I,grow=q(.08,.48),lock=q(.48,.73);
 // Unequal strata rise into a buttress. A falling pebble visibly bounces off armor.
 for(let j=0;j<7;j++){const x=299+j*224,h=(32+(j*47)%103)*grow;poly([[x-130,1069],[x-52,1015-h],[x,1047-h*.76],[x+53,1017-h*.55],[x+141,1069]],j%2?'#71857860':'#b1996655','#c8d797',2.5);glow([[x-50,1024-h],[x,1055-h*.76],[x+50,1025-h*.55]],'#ffe0a0',2,.75);}
 I.dragon(124,441,1.65,'#d8cd96',.5+grow*.5);shield(1811,540,2,'#d7eab3');
 route([[91,628],[65,839],[220,1019]],grow,'#bdcb83',5);
 for(let j=0;j<4;j++){const b=q(.48+j*.025,.67+j*.025);I.arc(1811,540,77+j*15,102+j*12,-2.7,-.4+2.8*b,'#b9ecbf',3);}
 I.gem(1811-37*q(.28,.48)+lock*48,361+112*q(.28,.48)-lock*49,.39,'#ffe2a4',p);
 I.spark(1774,473,(p-.48)/.23,'#f6e7b5',12,53);
 poly([[348,49],[481,35],[617,70],[549,104],[398,97]],'#8caa7255','#c7e8a3',2);shield(481,70,.74,'#ecdfae');
 glow([[1290,48],[1385,92],[1652,69]],'#a0d3bd',5,lock);I.gem(1461,67,.78,'#bff1d4');
}
function borderInfernal(I){
 const {q,p,trace,poly,glow,blade}=I,breathe=q(.16,.51),forge=q(.51,.78);
 I.dragon(110,445,1.65,'#ff9863',.9);I.arc(98,437,88,130,-2.2,1.5,'#ff6a57',3);
 for(let j=0;j<5;j++){const d=j*14;trace(u=>[113+u*590,567+u*398+Math.sin(u*10+j)*d*breathe],'#ff8b54',j===2?12:3,.7*breathe);}
 poly([[595,1042],[610,997],[769,997],[784,1042]],'#98505970','#ffba76',3);
 blade(687,961,1.1,-Math.PI/2+forge*.14,'#fff0af');I.spark(685,967,(p-.51)/.25,'#ffed97',21,103);
 // Flame travel becomes a forged glowing edge; embers climb into a right chimney.
 for(let j=0;j<14;j++){const b=q(.50+j*.009,.76+j*.009),x=824+j*62,h=(17+j%4*9)*b;poly([[x-13,1041],[x-4,1019-h],[x,1027-h],[x+9,1007-h],[x+18,1041]],j%2?'#ff703e66':'#ffcd7477',null);}
 trace(u=>[1810+Math.sin(u*14)*33,949-u*726*forge],'#ff9d64',5,.75);
 for(let j=0;j<8;j++)I.fade(forge,()=>I.gem(1769+j%3*37,844-j*81,.15+j%2*.08,'#ffde88',j));
 for(let j=0;j<3;j++){trace(u=>[342+u*1180,52+j*20+Math.sin(u*9+j)*12],'#f99661',3,.4+.25*forge);}
}
function borderOcean(I){
 const {p,q,trace,cloud,glow,heart,oval,ring}=I,rain=q(.12,.43),flow=q(.43,.72);
 cloud(384,66,1.2,'#8fe9f5');cloud(1459,52,.84,'#a6cfff');
 for(let j=0;j<11;j++){const x=250+j*38;glow([[x,91],[x-10,112+rain*18]],'#82ceee',2,.65*rain);}
 // Top aqueduct, right waterfall, bottom return current, left regenerating roots.
 trace(u=>[582+u*1134,61+22*Math.sin(u*3)],'#7adfeb',4,rain);
 for(let j=0;j<4;j++)trace(u=>[1787+j*17+Math.sin(u*17+j)*7,170+u*728*flow],'#73dbea',3,.65);
 for(let j=0;j<3;j++)trace(u=>[295+u*1420,997+j*18+Math.sin(u*17-p*5+j)*14],'#70f1d7',4-j*.5,.8);
 I.dragon(1827,326,1.3,'#94dceb',.7);heart(110,536,2,'#82f2c7');
 for(let j=0;j<5;j++){const b=q(.51+j*.025,.75+j*.025);ring(106,682+j*50,17+b*36,4+b*7,'#89dded',2,.65);}
 I.fade(flow,()=>{I.sprout(307,1023,1.1,'#6deec6');I.sprout(425,1040,.65,'#c3eed0');});
 // A small drifting leaf rocks into a safe pool after the waterfall arrives.
 I.at(1360-412*flow,998,1,Math.sin(p*9)*.12,()=>{I.poly([[-39,0],[0,-15],[43,0],[0,10]],'#a3ebbe88','#b9ffda',2);oval(0,-13,7,8,'#d5f4d4');});
}
function borderCloud(I){
 const {q,p,trace,cloud,boot,glow,fade,poly}=I,go=q(.19,.48),fly=q(.48,.83);
 for(let j=0;j<3;j++)trace(u=>[108+Math.sin(u*TAU*1.5+j)*72*(1-u*.6),848-u*650],'#a2e9ff',3,.65);
 I.dragon(111,440,1.2,'#d5eeff',.55+go*.45);
 // Speed boots run the lower edge, leaving four tapered air ribbons.
 boot(350+go*557+fly*410,972,1.4,'#bceeff',-.3+fly*.9);boot(294+go*559+fly*410,1002,1.1,'#fce4a6',.35-fly*.6);
 for(let j=0;j<4;j++)trace(u=>[273+u*(650+fly*470),1008+j*12-Math.sin(u*Math.PI)*18],'#c7f0ed',3,.5*(1-j*.13));
 cloud(1704,989,1.25,'#b9dffa');cloud(1775,706,.85,'#e8e5c5');
 // A windsock snaps taut on the opposite edge; a loose feather takes the high road.
 glow([[1826,638],[1826,288]],'#b5e5ec',4);poly([[1826,301],[1736-59*fly,310],[1765-62*fly,343],[1826,341]],'#bce7f044','#e7fbec',3);
 trace(u=>[326+u*1260,65+Math.sin(u*8)*30],'#b5e9f8',3,.7);
 const x=390+fly*1120;I.wing(x,66,.53,'#ffe8bd',-1,.9);
}
function borderChemtech(I){
 const {q,p,route,glow,flask,shield,ring,trace,fade}=I,brew=q(.13,.43),pour=q(.43,.69),mend=q(.65,.85);
 // An alchemical pressure vessel feeds a shield tempering bath. No zombie motif.
 flask(108,486,2,'#bcef70',.35+.4*brew);I.gear(97,740,.7,'#c9e599',brew*.6);
 route([[93,410],[65,273],[139,211],[139,86],[544,86]],brew,'#a0e765',9);
 for(let j=0;j<5;j++){ring(320+j*88,65,12+j%2*6,12+j%2*6,'#b0f889',2,.5+brew*.3);}
 route([[142,562],[168,817],[490,987],[861,987]],pour,'#9fee72',8);
 flask(1746,95,1.55,'#a4f791',.6,-.6*pour);trace(u=>[1719-u*62*pour,128+u*269*pour],'#b2ef77',5,pour);
 shield(1816,535,1.9,'#b2e88d');glow([[1801,476],[1829,520],[1795,550],[1813,588]],'#223347',4,1-mend);
 I.spark(1815,541,(p-.65)/.25,'#e6ffc3',15,101);
 for(let j=0;j<9;j++){const b=q(.42+j*.025,.64+j*.025);fade(b,()=>ring(1005+j*74,1014-44*b-(j%3)*17,6+j%4*3,6+j%4*3,'#a9f58a',2));}
 I.dragon(1125,982,1,'#c1f484',.6);I.heart(1508,1002,.75*mend,'#e0f5a4');
}
function borderHextech(I){
 const {q,p,route,gear,gem,glow,blade,poly}=I,load=q(.10,.46),join=q(.24,.46),surge=q(.46,.75);
 // Deliberate open circuit closes at contact, THEN feeds haste gears and attack blades.
 const left=[[79,809],[79,670],[145,605],[145,314],[266,193],[266,62],[638,62]],right=[[1277,66],[1652,66],[1824,237],[1824,622],[1730,716],[1730,932],[1410,932]];
 route(left,load,'#6ce3ff',5);route(right,surge,'#c599ff',5);
 gear(110,495,1.5,'#76dfff',load*1.4+surge*2);gear(1819,412,1.3,'#d0a1ff',-surge*2.7);
 const terminals=borderHextechMotion(p);gem(terminals.left,970,1.35,'#72e9ff');gem(terminals.right,970,1.35,'#c4a0ff');
 glow([[terminals.left+20,970],[terminals.left+terminals.terminal,970]],'#d6fcff',5);glow([[terminals.right-20,970],[terminals.right-terminals.terminal,970]],'#eedcff',5);
 I.spark(960,970,(p-.46)/.25,'#e4ffff',19,134);
 for(let j=0;j<3;j++)route([[260,966+j*25],[571,966+j*25],[616,921+j*25],[786,921+j*25]],load,'#69d9ff',3);
 for(let j=0;j<3;j++)route([[1110,984+j*25],[1265,984+j*25],[1320,939+j*25],[1611,939+j*25]],surge,'#c390ff',3);
 blade(1501,56,.67,Math.PI/2,'#c9faff');blade(1500,91,.67,Math.PI/2,'#c2a1ff');
 for(let j=0;j<5;j++){const a=q(.49+j*.034,.65+j*.034);glow([[339+j*59,44],[339+j*59,89]],'#c6ffff',3,a);}
 I.dragon(130,871,.8,'#76e2ff',.55+surge*.4);
}
function borderElder(I){
 const {p,q,arc,dragon,wing,glow,poly,fade}=I,open=q(.15,.43),judgment=q(.53,.76);
 // A pale ancient dragon opens an eclipse. The threshold motif is a buff symbol,
 // never presented as a new player kill. No little sleepy moon-garden here.
 arc(119,477,87,144,-2.5,2.5,'#e0d1ff',5);dragon(113,494,1.45,'#e4e9ff',.4+open*.6);
 wing(327,54,2.2,'#dfdcfa',1,open);wing(1630,55,2.2,'#c6dcff',-1,open);
 for(let j=0;j<5;j++)I.trace(u=>[60+j*28+Math.sin(u*6+j)*15,716+u*323],'#b7b8f3',2,.6);
 // One silver breath traverses the bottom and reaches the threshold seal exactly once.
 I.route([[212,1012],[582,954],[994,991],[1482,952],[1781,952]],q(.28,.53),'#dbdcff',7);
 I.shield(1814,952,1.15,'#a9bbd8');glow([[1782,958],[1846,958]],'#fff4b8',4);
 fade(judgment,()=>{poly([[1799,982],[1781,1037],[1815,1015],[1847,1037],[1830,982]],'#dbd5ff70','#faf2dd',2);});
 I.spark(1814,952,(p-.53)/.28,'#f9f0c9',23,105);
 for(let j=0;j<4;j++)arc(1825,514,40+j*14,118+j*36,-1.3,1.2,'#d5c7f9',2+judgment);
 I.fade(q(.56,.84),()=>{I.crown(1010,974,1.2,'#e9e7fa');});
}
const BORDER_DRAGONS={dragon:borderDragon,dragon_earth:borderMountain,dragon_fire:borderInfernal,dragon_water:borderOcean,dragon_air:borderCloud,dragon_chemtech:borderChemtech,dragon_hextech:borderHextech,dragon_elder:borderElder};
