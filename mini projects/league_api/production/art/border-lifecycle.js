function borderStart(I){
 const {p,q,gem,glow,poly,route}=I,open=q(.17,.50),depart=q(.50,.84);
 // Nexus at home; three distinct lane routes unfurl, ready for play.
 gem(977,981,1.7,'#a9c6ff');I.arc(977,999,126,36,0,TAU,'#9fedcc',3);
 route([[830,1004],[331,1004],[105,796],[105,316],[294,66],[658,66]],depart,'#a0eac8',5);
 route([[1117,1004],[1621,1004],[1821,794],[1821,271],[1640,65],[1277,65]],depart,'#e1c48f',5);
 route([[399,976],[676,901],[950,901],[1465,934]],depart,'#bbacee',4);
 for(const [x,dir] of [[97,-1],[1820,1]]){I.at(x,534,1,0,()=>{poly([[-58,-123],[58,-123],[58,118],[-58,118]],'#9eb8d21a','#a7ccdb',2);for(const s of [-1,1])poly([[s*5+s*open*39,-112],[s*48+s*open*12,-112],[s*48+s*open*12,111],[s*5+s*open*39,111]],'#7498b43d','#c4dfd5',2);});}
 for(let j=0;j<3;j++)I.helm(427+j*201,72,.68,['#a6e3cf','#bdd0ee','#d9c399'][j]);
 I.spark(977,970,(p-.50)/.26,'#d5ffe6',23,150);
}
function borderMinions(I){
 const {q,p,glow,minion,poly}=I,march=q(.12,.79);
 I.at(112,578,1,0,()=>{I.arc(0,0,67,122,Math.PI,TAU,'#95daf0',4);glow([[-67,0],[-67,112],[67,112],[67,0]],'#9bdeee',4);});
 // Melee, caster and cannon silhouettes depart in a finite first-wave parade.
 for(let j=0;j<3;j++){minion(340+j*124+march*163,1006,1.1,'#8bcff5',Math.sin(p*18-j));}
 for(let j=0;j<3;j++){const x=986+j*122+march*97;minion(x,995,.85,'#cba0ee',Math.sin(p*18-j));glow([[x+28,998],[x+28,945]],'#deb6f2',3);I.gem(x+28,939,.24,'#f0d4ff');}
 I.at(1514+march*111,1001,1,0,()=>{I.poly([[-40,-12],[38,-12],[42,22],[-41,22]],'#83baca55','#b7dde0',2);for(const x of [-24,24])I.ring(x,25,13,13,'#c6d7df',4);glow([[0,-12],[43,-39]],'#dcbbeb',15);});
 // The other lanes get a flag procession and departing bootprints, not duplicate units.
 for(let j=0;j<4;j++){const x=346+j*297;glow([[x,30],[x,104]],'#abd7ee',3);poly([[x,32],[x+78,46],[x,66]],j%2?'#bc9be54d':'#7dc0df55',j%2?'#d6b6f2':'#a6def3',2);}
 for(let j=0;j<6;j++)I.boot(1816+(j%2?15:-15),318+j*89,.36,'#9ed2df',-.3);
 I.route([[125,796],[175,985],[280,1028]],march,'#a4e1ed',4);
}
function borderVictory(I){
 const {p,q,poly,glow,wing,crown,fade}=I,breaks=q(.18,.42),raise=q(.42,.73);
 // Opposing nexus fractures, laurels unfurl, the trophy rises, then confetti fires.
 for(let j=0;j<5;j++){const a=j*TAU/5;I.gem(1812+Math.cos(a)*72*breaks,513+Math.sin(a)*123*breaks,.70,'#b2c9e2',a*breaks);}
 I.spark(1812,513,(p-.42)/.26,'#ffe8a9',23,152);
 I.at(960,1015-raise*36,1,0,()=>{poly([[-66,-64],[66,-64],[49,-8],[18,17],[-18,17],[-49,-8]],'#dcaf5366','#ffe1a0',4);glow([[0,14],[0,44],[-49,44],[49,44]],'#ffdda0',8);for(const s of [-1,1])I.arc(s*59,-35,32,26,-1.6,1.6,'#ffe2a1',5);crown(0,-60,.7,'#fff0bd');});
 for(let j=0;j<7;j++){const b=q(.40+j*.018,.63+j*.018);I.at(102,786-j*74,1,-.9+j*.08,()=>I.oval(0,0,15+17*b,8,'#a9e9b987','#c4f2c4'));}
 I.trace(u=>[95+Math.sin(u*3)*36,286+u*581],'#a6e2b2',4,.8);
 wing(345,70,2,'#f5d492',1,raise);wing(1581,70,2,'#d1e6b2',-1,raise);
 for(let j=0;j<34;j++){const b=q(.48+(j%7)*.014,.78+(j%7)*.014),x=285+((j*179)%1361),y=887+((j*29)%115);fade(b,()=>{I.at(x,y,1,j+b,()=>poly([[-4,-8],[4,-8],[4,8],[-4,8]],j%3===0?'#9defcf':j%3===1?'#f1b4e5':'#ffe094',null));});}
}
function borderDefeat(I){
 const {p,q,gem,glow,cloud,trace,fade}=I,fall=q(.16,.49),hope=q(.56,.84);
 // A fallen nexus / lowered pennant, then a modest next-growth gesture. No victory crown.
 for(let j=0;j<4;j++)gem(107+(j-1.5)*31*fall,437+fall*(91+j*38),.75,'#b8bfdc',(j-2)*fall*.5);
 I.route([[129,706],[172,899],[477,1007],[1087,1007]],fall,'#99b8d5',3);
 cloud(1405,68,1,'#b5bed7');for(let j=0;j<9;j++)glow([[1260+j*34,83],[1256+j*34,106]],'#a0bedc',2,.6);
 I.at(1816,536,1,0,()=>{glow([[0,-143],[0,150]],'#a4b9d2',4);I.poly([[0,-130+fall*167],[-82,-107+fall*167],[-60,-70+fall*167],[0,-88+fall*167]],'#99aacd3b','#bfcbe4',2);});
 I.sprout(966,1037,hope*1.65,'#b9e2bd');I.arc(966,1037,62,12,0,TAU,'#bbd3c6',2);
 for(let j=0;j<3;j++)I.trace(u=>[386+u*267,64+j*13+Math.sin(u*5)*9],'#afbdd6',2,.5);
 I.fade(hope,()=>{I.oval(1006,945,13,7,'#c8e6bd','#c8e6bd');I.oval(926,918,10,6,'#b4dabf','#b4dabf');});
}
function borderEnd(I){
 const {p,q,poly,glow,gem,route}=I,collect=q(.13,.49),close=q(.49,.79);
 // Unknown result gets a neutral match archive, never a cup or defeat scene.
 I.at(985,982,1,0,()=>{poly([[-159,35],[-159,-56],[-15,-43],[0,-20],[15,-43],[159,-56],[159,35],[0,55]],'#719eb542','#c4dee0',3);for(const s of [-1,1])for(let j=0;j<4;j++)glow([[s*24,-17+j*14],[s*(132-98*close),-31+j*14]],'#bdd0cf',2);glow([[0,-21],[0,52]],'#e5d5b0',3);poly([[21,-46],[39,-46],[39,25],[30,15],[21,25]],'#e3bb8690',null);});
 route([[99,249],[99,776],[314,990],[782,990]],collect,'#a0d4d8',4);
 route([[1818,277],[1818,816],[1597,990],[1173,990]],collect,'#b4aed9',4);
 I.eye(110,473,.9,'#9ed2db',1-close*.8);I.gear(1818,508,1.2,'#b8bddb',close*.3);
 for(let j=0;j<6;j++){const x=353+j*231;gem(x,69,.39,'#c8d8d9',j*.4);}
 I.spark(985,982,(p-.49)/.26,'#c6f0e7',17,126);
}
const BORDER_LIFECYCLE={game_start:borderStart,minions_spawning:borderMinions,victory:borderVictory,defeat:borderDefeat,game_end:borderEnd};
