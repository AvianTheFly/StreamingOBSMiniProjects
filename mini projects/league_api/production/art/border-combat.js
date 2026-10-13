// Personal combat has different counts and stakes; global announcements stay
// neutral about which team benefited. Every composition owns its spatial staging.
function borderKill(I){
 const {p,q,blade,glow,route,helm,spark,gem,fade}=I,a=q(.10,.43),hit=q(.43,.64);
 blade(111,440,1.8,-.55+1.7*a,'#68e8ff');
 route([[130,500],[72,650],[126,812],[425,972],[1620,972]],q(.12,.40),'#51c5ff',5);
 const contact=borderStrikeMotion(p);blade(contact.bladeX,966,.8,Math.PI/2,'#cefaff');
 helm(1832,966,1.55,'#ff849e',hit>.01);glow([[contact.targetFace,930],[contact.targetFace,995]],'#ffadc5',4,1-hit*.7);spark(contact.targetFace,966,(p-.43)/.24,'#ffdb86',17,93);
 fade(hit,()=>{gem(1843,713-30*hit,1.2,'#ffd073',hit*.3);route([[1843,661],[1843,272],[1706,69],[1380,69]],q(.49,.84),'#ffc575',4);});
 // A single decisive cut, with long tapering strokes rather than copied crests.
 for(let j=0;j<3;j++)glow([[172+j*8,162],[316+j*32,60+j*15],[652+j*31,60+j*15]],'#72d5ff',5-j, .65*q(.06,.28));
}
function borderAssist(I){
 const {p,q,route,glow,at,oval,poly,heart,fade,minion,spark}=I,a=q(.12,.43),hit=q(.43,.65);
 route([[350,61],[143,61],[94,198],[94,733],[512,968],[945,968]],a,'#6df2c4',5);
 route([[1570,82],[1800,82],[1830,270],[1820,812],[1425,968],[975,968]],a,'#ffd386',4);
 minion(113,423,2,'#6df2c4',a);minion(1828,582,2,'#ffd386',-a);
 const hands=borderAssistMotion(p);for(const dir of [-1,1])at(dir<0?hands.left:hands.right,960,1,0,()=>{poly([[dir*8,-20],[dir*75,-12],[dir*91,22],[dir*12,22]],dir<0?'#68e5bc':'#ffc978',null);oval(0,0,hands.radius,30,'#ffe4be','#a37663');for(let j=0;j<3;j++)glow([[dir*(-12+j*12),-17],[dir*(-12+j*12),-3]],'#bc8a78',2);});
 spark(960,954,(p-.43)/.27,'#dffff0',15,99);
 fade(hit,()=>{heart(960,906,1.4*hit,'#fc8fb6');for(const [x,y] of [[463,991],[1320,978],[1776,303]]){I.sprout(x,y,hit,'#71edbf');}});
}
function borderFirstBlood(I){
 const {p,q,glow,poly,at,oval,crown,coin,fade,route,spark}=I,cut=q(.19,.40),hit=q(.40,.63);
 // Ceremonial first ribbon: unbroken top pennant, cut on left, gold delivered below.
 poly([[50,84],[520,40],[693,85],[509,110],[51,146]],'#bc416458','#ff7597',2);
 for(const s of [-1,1])at(127,467,1,s*(.65-.65*cut),()=>{I.blade(0,20,1.5,Math.PI+s*.25,'#ffacc1');});
 route([[138,270],[138,440]],1,'#fa648e',13);route([[138+hit*24,515],[99,733],[229,944]],1,'#fa648e',13);
 spark(139,475,(p-.40)/.23,'#ffdc8c',19,118);
 at(544,963,1+hit*.12,-.13,()=>{oval(0,0,59,51,'#c7396f55','#ff89ac');crown(0,0,.9,'#ffdda1');});
 for(let j=0;j<7;j++){const b=q(.43+j*.023,.68+j*.023);fade(b,()=>coin(728+j*128,1021-Math.sin(b*Math.PI)*85,1.2));}
 fade(hit,()=>{crown(1810,510,1.55,'#ffda88');glow([[1803,576],[1803,846],[1635,973]],'#f2b562',4);});
 for(let j=0;j<4;j++)glow([[1280+j*91,71],[1308+j*91,45],[1336+j*91,71]],'#ffca7c',3,.8*q(.45,.8));
}
function borderClutchKill(I){
 const {p,q,glow,heart,blade,shield,spark,poly,fade}=I,hit=q(.43,.67);
 // The slender lifeline never fills: the player survived a kill at sampled low HP.
 glow([[75,179],[75,311],[94,333],[62,366],[103,394],[75,413],[75,828]],'#ff719d',4);
 heart(113,551,2.7,'#fa7297');I.face(113,535,hit>.4?'happy':'sad',1.5);
 glow([[311,70],[736,70],[751,50],[766,95],[780,70],[1560,70]],'#ff6b90',3);
 shield(1814,554,2,'#fdae80');blade(1763+44*q(.16,.43),632,1.2,-.8,'#fff0ce');spark(1798,528,(p-.43)/.25,'#fff0ab',19,97);
 fade(hit,()=>poly([[78,554],[218,611],[171,690],[129,629],[82,628]],'#a376f477','#cbadff',3));
 I.route([[125,830],[296,988],[1470,988],[1775,817]],q(.44,.85),'#c4a0ff',4);
 fade(hit,()=>{I.crown(1118,978,1.3,'#ffcf81');I.heart(1415,993,.55,'#ff739b');});
}
function borderClutchMulti(I){
 const {p,q,glow,heart,at,star,blade,fade,route}=I,hold=q(.17,.43),save=q(.43,.76);
 // A balancing act over a thread, several threats deflected, no fabricated exact count.
 glow([[170,1000],[545,1005],[960,971],[1420,1007],[1760,991]],'#ff5fa6',4);
 heart(955,925,2,'#ff77b2');I.face(955,913,'happy',1.4);
 at(957,957,1,.20*(1-save),()=>glow([[-115,0],[115,0]],'#ffd288',6));
 for(let j=0;j<3;j++){const a=q(.16+j*.03,.43+j*.03),r=q(.43+j*.03,.72+j*.04);blade(1801-r*80,270+j*210,1.1,-1.25+r*1.7,'#ff8aa4');I.spark(1788,306+j*210,(p-.43-j*.03)/.2,'#ffe189');}
 route([[1733,865],[1420,902],[1081,908]],save,'#ffdd80',5);
 for(let j=0;j<6;j++){const x=335+j*236;glow([[x-36,87],[x,54-j%2*19],[x+69,80]],j%2?'#ff92cb':'#c49bff',4,.7*hold);}
 fade(save,()=>{I.wing(97,550,1.5,'#c29cff',1,save);star(82,549,28,'#ffdd8c');for(let j=0;j<4;j++)star(679+j*57,975-j*10,8,'#ffd189');});
}
function borderDouble(I){
 const {p,q,blade,route,gem,fade,glow,spark}=I,join=q(.15,.48),hit=q(.48,.73);
 blade(89,460,2,-.4+join*.4,'#59ddff');blade(1833,571,2,.4-join*.4,'#ffb685');
 route([[87,260],[170,66],[636,66],[780,92]],q(.1,.42),'#55dcff',4);
 route([[1830,804],[1700,1003],[1200,1003]],q(.15,.48),'#ffba81',4);
 for(const dir of [-1,1]){const x=960+dir*(221-161*join);I.helm(x,961,1.5,dir<0?'#62dfff':'#ffbd89');glow([[x,1003],[x,1037],[960,1037]],'#ffe0a0',3);}
 spark(960,962,(p-.48)/.28,'#fff0be',16,120);
 fade(hit,()=>{gem(1240,62,1,'#ffcb87');gem(1470,62,1,'#6fe7ff');glow([[1295,61],[1415,61]],'#ecdfbf',4);});
}
function borderTriple(I){
 const {p,q,route,gem,spark,fade,glow}=I;
 // Three distinct stations: blade, ricochet mirror, final medal; never three repeats on every side.
 I.blade(118,590,2.2,-.2+q(.1,.28)*.75,'#b89bff');
 route([[147,666],[286,968],[690,968]],q(.12,.31),'#bba0ff',5);
 route([[690,968],[1377,968],[1825,788]],q(.31,.48),'#ffb980',5);
 route([[1825,788],[1818,321],[1560,58],[1290,58]],q(.48,.65),'#73e4ef',5);
 [[690,968,.31,'#bba0ff'],[1825,788,.48,'#ffb980'],[1290,58,.65,'#73e4ef']].forEach(([x,y,b,col],j)=>{const hit=q(b,b+.16);I.shield(x,y,.95,col);fade(hit,()=>gem(x,y,.64,col,j*.3));spark(x,y,(p-b)/.22,col,13,71);});
 for(let j=0;j<3;j++)glow([[420+j*123,81],[441+j*123,41],[479+j*123,81]],'#bc99ff',3,.8*q(.08,.31));
}
function borderQuadra(I){
 const {p,q,glow,blade,helm,fade,spark}=I;
 // Four locks turn in a clockwise chase. An empty fifth plinth makes the near-penta readable.
 const stations=[[114,375,-.7],[467,77,.4],[1813,646,2.4],[1118,973,1.6]];
 stations.forEach(([x,y,a],j)=>{const beat=.24+j*.105,r=q(beat-.16,beat),h=q(beat,beat+.16);I.arc(x,y,59,59,a,a+Math.PI*1.4*r,'#8ceacc',4);blade(x,y+18,1,a+r*.8,j%2?'#d995ff':'#74eed0');spark(x,y,(p-beat)/.2,'#dfffd6',12,80);fade(h,()=>I.gem(x+49,y+40,.45,'#ffe08d'));});
 glow([[113,488],[77,820],[342,1003],[823,1003]],'#ad92f0',5,.7*q(.2,.63));
 glow([[782,64],[1436,64],[1842,228],[1842,492]],'#80ead6',3,.7*q(.25,.67));
 fade(q(.60,.79),()=>{helm(1622,989,.9,'#a4b6c6');glow([[1579,1041],[1665,1041]],'#ffe199',3);I.question(1622,931,.65,'#d6c5f6');});
}
function borderPenta(I){
 const {p,q,glow,poly,at,oval,fade,helm,gear,blade}=I,drop=q(.43,.65);
 // The count completes before the concert downbeat. Drums, bass, keys and leads
 // have different silhouettes; lights and audience occupy different edge roles.
 for(let j=0;j<5;j++){const h=q(.17+j*.055,.22+j*.055);helm(87,250+j*132,.78,'#cb97ff',h>.95);fade(h,()=>I.star(159,248+j*132,10,'#ffe088'));}
 for(let j=0;j<7;j++){const x=350+j*192,spread=q(.36+j*.015,.64);poly([[x,29],[x-52*spread,108],[x+85*spread,108]],j%2?'#68dfee16':'#f293d61b',null);glow([[x-23,31],[x+23,31]],j%2?'#75e8ff':'#ff9bdd',6);}
 glow([[307,1040],[1625,1040]],'#c17dff',5);
 for(let j=0;j<5;j++){const x=458+j*246;I.minion(x,982,1.55,['#8dd9ff','#d495ff','#ffa6cb','#ffdf86','#8cedc9'][j],Math.sin(p*23+j)*drop);}
 // Snare and cymbals.
 at(945,986,1,0,()=>{oval(0,0,48,24,'#9138be55','#f2b4ff');I.ring(0,0,37,16,'#fff1c1',2);for(const s of [-1,1]){oval(s*60,-43,24,6,'#ffd58b');glow([[s*60,-43],[s*52,37]],'#cda3d8',2);glow([[s*25,-49],[s*10,-4-Math.sin(p*39)*14*drop]],'#fff2cc',3);}});
 for(const x of [443,1195])at(x,974,1,-.65,()=>{oval(0,0,18,29,'#ffc2eb','#ffe9bd');glow([[0,-14],[0,-83]],'#ffde97',9);for(let j=0;j<3;j++)glow([[-4+j*4,15],[-4+j*4,-85]],'#fff4ce',1);});
 poly([[628,986],[740,986],[760,1015],[612,1015]],'#a387e955','#e5cfff',2);for(let j=0;j<8;j++)glow([[630+j*14,990],[626+j*15,1011]],'#dce9ff',4);
 I.blade(1456,964,.7,-.5,'#ffe18e');
 // Right-side amplifier grows a single sustained chord fan, not a pulsing loop.
 for(let j=0;j<3;j++)I.arc(1890,494,60+j*38,98+j*73,Math.PI*.6,Math.PI*1.4,'#d29bff',3*q(.43+j*.025,.78));
 fade(drop,()=>I.crown(1822,812,1.1,'#ffe19a'));
 for(let j=0;j<23;j++){const u=(j*.618)%1,x=320+u*1270,y=866+((j*43)%90);fade(q(.45+j*.009,.60+j*.009),()=>I.star(x,y,3+j%4,j%2?'#a0e9ff':'#ffc2e6',j));}
}
function borderAce(I){
 const {p,q,glow,helm,at,poly,route,fade,spark}=I,sweep=q(.18,.58);
 for(let j=0;j<5;j++){const hit=q(.25+j*.065,.42+j*.065);helm(435+j*235+hit*100,973+hit*65,1.05,'#b7afdc',true);}
 const x=280+1310*sweep;at(x,941,1,.25,()=>{glow([[0,-69],[0,47]],'#ffd58b',8);poly([[-38,32],[38,32],[52,61],[-52,61]],'#87edc278','#baffd6',3);for(let j=0;j<7;j++)glow([[-30+j*10,39],[-41+j*14,59]],'#fff1c0',2);});
 route([[1630,1020],[1815,822],[1815,301],[1615,55],[1310,55]],q(.55,.83),'#81edc5',4);
 fade(q(.58,.78),()=>{I.crown(1810,537,1.7,'#ffdf8e');spark(1806,533,(p-.58)/.3,'#85f9dc',21,124);});
 for(let j=0;j<5;j++)I.minion(78+j%2*42,290+j*105,1.1,'#8fedd0',q(.58,.82));
 glow([[278,62],[582,62],[707,95]],'#e5cf8c',4,q(.12,.4));
}
function borderNumbers(I){
 const {q,glow,at,helm,route,fade}=I,tip=q(.28,.56);
 // Two extra standing silhouettes tip a balance; no fictitious respawn/death.
 at(965,961,1,-.17*tip,()=>{glow([[-421,0],[421,0]],'#9bddda',5);for(const x of [-365,-243,243,365])helm(x,-42,.8,x<0?'#75e6c3':'#b1a2cc');for(const x of [-118,-8])fade(tip,()=>helm(x,-42,.8,'#ffdc8b'));});
 I.poly([[917,1047],[965,965],[1013,1047]],'#69d6be35','#89e9d4',3);
 route([[301,98],[120,190],[109,770],[521,914]],q(.08,.55),'#73e9cf',4);
 I.shield(112,474,1.8,'#90efda');I.arc(1819,510,65,178,-1.3,1.4,'#baa8de',3);
 fade(q(.56,.81),()=>{I.wing(1819,510,1,'#ffc982',-1,.8);glow([[1237,65],[1410,65],[1450,36],[1601,36]],'#ffe0a1',4);});
}
const BORDER_COMBAT={kill:borderKill,assist:borderAssist,first_blood:borderFirstBlood,low_hp_kill:borderClutchKill,low_hp_multikill:borderClutchMulti,double_kill:borderDouble,triple_kill:borderTriple,quadra_kill:borderQuadra,pentakill:borderPenta,ace:borderAce,manpower_advantage:borderNumbers};
