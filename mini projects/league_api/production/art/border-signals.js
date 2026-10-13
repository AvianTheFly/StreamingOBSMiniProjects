// Correlations are deliberately unresolved. Their props are proposals / traces,
// with open paths and question geometry; no completed purchase, cast or combat claim.
function borderPossiblePurchase(I){
 const a=I.q(.17,.67);I.at(113,514,1,0,()=>{I.poly([[-53,-50],[53,-50],[64,64],[-64,64]],'#c4a17329','#dcc795',2);I.arc(0,-49,30,39,Math.PI,TAU,'#f0d2a0',3);I.question(0,4,1,'#f2d49b');});
 for(let j=0;j<5;j++)I.coin(379+j*202,986-Math.sin(a*Math.PI)*26,.7);
 I.route([[165,761],[330,1003],[1449,1003]],a,'#d9c99b',3);I.gem(1814,517,1.3,'#a1cfd9',a*.3);I.arc(1814,517,72,121,-2.5,1.5,'#baa9cc',2);
 I.glow([[320,58],[603,58],[652,99]],'#cbbd95',3);I.glow([[1303,62],[1600,62]],'#9dcbd1',3);I.question(1550,969,.75,'#daceac');
}
function borderPossibleUpgrade(I){
 const a=I.q(.15,.72);I.gem(109,469,1.1,'#beaff3');I.gem(126,634,.65,'#e5c895');
 I.route([[128,743],[159,912],[639,1002]],a,'#b5a3e4',3);I.gem(841-a*63,985,.67,'#b8a3ed');I.gem(1136-a*63,985,.53,'#e3cd9c');I.question(963,970,1.1,'#ead9b1');
 I.c.save();I.c.setLineDash([8,9]);I.shield(1819,522,1.8,'#b8a4dd');I.c.restore();I.gem(1819,522,.55,'#acbdd7');
 for(let j=0;j<3;j++)I.glow([[330+j*118,82],[355+j*118,49],[380+j*118,82]],'#cfb8e9',3);I.arc(1471,67,77,33,0,Math.PI*1.6*a,'#dcccab',3);
}
function borderPossibleConsumable(I){
 const a=I.q(.13,.68);I.flask(110,520,1.8,'#b4e6a6',.6-a*.15,-a*.12);I.question(177,345,.8,'#ead8ae');
 for(let j=0;j<6;j++)I.ring(309+j*246,986-Math.sin(a*Math.PI)*(16+j%3*7),6+j%3*5,6+j%3*5,'#b5e0b3',2);
 I.route([[105,751],[128,925],[404,1018],[1488,1018]],a,'#a2d9b3',3);I.heart(1819,521,1.8,'#b0dcbf');I.arc(1819,521,71,123,-1.4,1.3,'#c9d6aa',2);
 I.trace(u=>[337+u*1260,64+Math.sin(u*12)*14],'#c5dbb1',2,.7);
}
function borderPossibleBase(I){
 const a=I.q(.15,.74);I.at(1817,530,1,0,()=>{I.poly([[-65,-1],[0,-66],[65,-1],[47,-1],[47,65],[-47,65],[-47,-1]],'#79b7c32c','#aedada',3);I.question(0,19,1,'#e4d4ad');});
 I.arc(110,530,70,123,-1.4,Math.PI*a,'#9bcfe1',3);I.flask(91,377,.5,'#afd7b3');I.gem(137,708,.47,'#e0ceab');
 I.c.save();I.c.setLineDash([12,18]);I.route([[283,997],[735,997],[978,929],[1431,997],[1714,891]],a,'#b7dcd0',3);I.c.restore();
 I.glow([[336,76],[442,43],[543,76]],'#c0d6d0',3);I.glow([[1344,77],[1441,43],[1544,77]],'#cad7bb',3);
}
function borderPossibleCombat(I){
 const a=I.q(.15,.68);I.blade(112,494,1.7,-.25+a*.3,'#dbc0db');I.shield(1815,569,1.7,'#b5c8e1');
 I.route([[113,721],[169,907],[688,1005]],a,'#c2a9cf',3);I.route([[1809,787],[1657,1005],[1235,1005]],a,'#aabed7',3);I.question(958,977,1.3,'#e7c6cf');
 I.trace(u=>[324+u*1262,69+Math.sin(u*13)*(6+a*11)],'#c9abc5',3,.6);I.heart(751,981,.73,'#e6aebd');
}
function borderPossibleEscape(I){
 const a=I.q(.14,.75);I.heart(113,505,1.9,'#e7a5b9');I.glow([[76,680],[137,680]],'#ebc0b7',3);I.boot(674+a*531,986,1.0,'#c6dcbb',a*.2);
 I.c.save();I.c.setLineDash([8,14]);I.route([[144,756],[198,951],[521,1018],[1395,1018],[1763,834]],a,'#b9d7bd',3);I.c.restore();
 I.arc(1821,526,60,120,Math.PI,TAU,'#c5deb9',3);I.glow([[1761,526],[1761,644]],'#b5d6c5',3);I.question(1820,579,1,'#e6d0b8');
 I.trace(u=>[341+u*1240,64+Math.sin(u*6)*12],'#c9d5bf',2,.6);
}
function borderPossibleTeamfight(I){
 const a=I.q(.14,.69);for(let j=0;j<3;j++){I.helm(109,316+j*178,.95,'#cbb2dc',true);I.arc(109,316+j*178,63,46,-2.4,-.3+a,'#dba9cf',2);}
 // Time-correlated deaths are grouped by a bracket, not a single map-location battle.
 I.glow([[301,73],[619,73],[644,44]],'#d0a8cf',3);I.glow([[1281,45],[1301,73],[1603,73]],'#b5c5e0',3);
 for(let j=0;j<3;j++){I.route([[441+j*479,915],[441+j*479,1016],[958,1016]],a,'#c0b5d9',2);I.ring(441+j*479,912,20,20,'#ccbddc',2);}
 I.question(958,957,1.05,'#e4cbd5');I.eye(1817,518,1.3,'#bebfe0',.7);I.arc(1817,518,73,170,-1.6,1.6,'#d2a7cd',2);
}
function borderPossibleObjective(I){
 const a=I.q(.18,.70);I.dragon(111,493,1.1,'#b8a3d6',.6);I.helm(1815,522,1.4,'#d8bccc',true);
 I.route([[111,709],[170,928],[713,1003]],a,'#bdacdb',3);I.route([[1819,717],[1751,928],[1211,1003]],a,'#d2b6c2',3);
 I.arc(963,981,103,46,Math.PI*.15,Math.PI*.85,'#cfbfd8',3);I.question(962,979,1.2,'#e6cea5');
 I.gem(421,63,.73,'#d8c699');I.glow([[563,66],[723,66]],'#baa9d5',2);I.gear(1473,65,.72,'#d2bfd1',a*.5);
}
function borderPossiblePower(I){
 const a=I.q(.16,.73);I.gear(112,516,1.6,'#beabe6',a*.5);I.gem(112,516,.82,'#e5d292');
 I.glow([[1814,799],[1814,314]],'#b6aad442',12);I.glow([[1814,799],[1814,799-272*a]],'#c8b5ef',7);I.question(1814,290,.8,'#ead8a7');
 I.route([[150,733],[161,925],[565,999],[1534,999]],a,'#b6a6dd',3);for(let j=0;j<3;j++)I.gem(725+j*239,980,.5+j*.13,'#d5c099',j*.3);
 I.trace(u=>[344+u*1241,88-u*39+Math.sin(u*5)*13],'#c9b8e5',3,.7);
}
function borderPossibleRoam(I){
 const a=I.q(.13,.77);I.at(112,495,1,0,()=>{I.ring(0,0,69,92,'#a5d8de',3);I.poly([[0,-61],[20,5],[0,-7],[-20,5]],'#b8d7d46b','#d5e5cb',2);I.question(0,39,.68,'#e3d7b1');});
 // Three role emblems converge abstractly; no invented champion travel or map coordinates.
 I.shield(363,70,.54,'#d5d8b2');I.blade(563,70,.48,.7,'#b5d9df');I.wing(1478,75,.62,'#d8c6b2',1,.8);
 I.c.save();I.c.setLineDash([9,14]);I.trace(u=>[317+u*1330,997+Math.sin(u*TAU)*36],'#a6d4d5',3,.8);I.c.restore();
 I.boot(504+a*1076,980,1,'#b5ddd2',-.1);I.arc(1819,525,69,168,-1.5,1.4,'#d2d7b9',3);
}
function borderPossibleJungle(I){
 const a=I.q(.16,.75);for(let j=0;j<4;j++){I.sprout(79+j%2*55,365+j*141,.74,'#afd69f');}
 I.eye(115,538,.7,'#c3dbb1',.6);I.question(157,724,.7,'#e7d5a8');
 for(let j=0;j<7;j++){const x=327+j*210;I.sprout(x,1034,.54+j%2*.29,'#a8d4a6');I.oval(x+18,978-Math.sin(a*3+j)*19,3,3,'#e8e4ad');}
 I.trace(u=>[321+u*1247,64+Math.sin(u*12)*17],'#b6d4af',3,.6);I.gear(1816,517,1.1,'#cad6b4',a*.4);I.gem(1816,517,.41,'#e8d79e');
 I.c.save();I.c.setLineDash([8,13]);I.route([[1782,742],[1651,960],[1291,960]],a,'#bfd8b8',3);I.c.restore();
}
function borderCustom(I){
 const a=I.q(.10,.73),stars=[[90,270],[144,578],[82,804],[386,990],[835,954],[1305,1009],[1791,810],[1829,421],[1581,69],[369,64]];
 // A neutral user-authored rule gets a hand-drawn constellation, no inferred story.
 stars.forEach(([x,y],j)=>{I.gem(x,y,.24+j%3*.18,j%2?'#beabef':'#95d8de',j*.4);if(j<7)I.route([stars[j],stars[j+1]],I.q(.08+j*.055,.28+j*.055),'#abacda',2);});
 I.question(1067,978,.85,'#d8c5ed');I.arc(1819,575,65,169,-1.3,1.4,'#c0aadd',3);I.glow([[548,66],[722,66]],'#adcde0',3,a);I.glow([[1309,66],[1449,66]],'#c8b6db',3,a);
}
const BORDER_SIGNALS={possible_purchase:borderPossiblePurchase,possible_item_upgrade:borderPossibleUpgrade,possible_consumable_use:borderPossibleConsumable,possible_base_visit:borderPossibleBase,possible_combat:borderPossibleCombat,possible_low_hp_escape:borderPossibleEscape,possible_teamfight:borderPossibleTeamfight,possible_objective_fight:borderPossibleObjective,possible_power_spike:borderPossiblePower,possible_roam:borderPossibleRoam,possible_jungle_activity:borderPossibleJungle};
