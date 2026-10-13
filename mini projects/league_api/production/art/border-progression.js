function borderLevel(I){
 const {p,q,glow,poly,gem,minion,route}=I,gain=q(.12,.44),rise=q(.44,.70);
 // Experience arrives along the bottom, then raises the player to a new tier.
 for(let j=0;j<12;j++){const b=q(.06+j*.014,.35+j*.014);gem(375+j*104,1031-29*Math.sin(b*Math.PI),.20+j%3*.09,'#c9eb8c',j*.5);}
 route([[1588,1004],[698,1004],[200,1004],[114,805]],gain,'#d0ed95',5);
 const steps=[[57,759],[174,759],[174,639],[57,639],[57,514],[174,514],[174,389],[57,389]];glow(steps,'#d3dd92',5);
 const feet=borderLevelMotion(p);minion(110,feet.y,1.65,'#c1ed9a',Math.sin(rise*TAU));I.spark(110,445,(p-.70)/.2,'#ffdfa0',16,84);
 I.route([[110,347],[161,111],[336,68],[653,68]],q(.54,.82),'#f4d193',4);
 I.crown(1670,76,.85,'#ffe29e');
 for(let j=0;j<3;j++){const y=330+j*154;I.poly([[1776,y+43],[1819,y],[1862,y+43],[1819,y+22]],'#a7dfa33b','#c5eda6',3);}
}
function borderUltimate(I){
 const {p,q,arc,glow,poly,gem,wing,route}=I,unlock=q(.20,.53),open=q(.53,.82);
 // This is learning the ability, not casting it. The release stops at a ready sigil.
 I.at(113,518,1,0,()=>{poly([[-58,-23],[58,-23],[58,68],[-58,68]],'#8370b844','#cba7f4',3);arc(0,-25,42,61,Math.PI+unlock*.7,TAU+unlock*.7,'#dfc6ff',6);I.gem(0,21,.64,'#ffe3a2');});
 route([[110,705],[113,879],[416,1009],[936,1009]],unlock,'#be9bf2',5);
 I.at(1001,987,1,0,()=>{for(let j=0;j<4;j++){const a=j*Math.PI/2;I.at(Math.cos(a)*57*open,Math.sin(a)*35*open,1,a,()=>poly([[-13,-27],[13,-27],[22,18],[0,34],[-22,18]],'#ac7ce050','#d7b0ff',2));}gem(0,0,1.15,'#ffe2a0');});
 I.spark(1001,987,(p-.53)/.28,'#e7c7ff',23,157);
 wing(1820,533,1.5,'#cda0fa',-1,.4+.6*open);I.arc(1820,533,65,164,-1.6,1.6,'#f6dba4',3);
 I.route([[363,75],[683,75],[724,36],[776,75]],open,'#d3a9f7',4);I.route([[1166,72],[1292,35],[1515,35],[1603,73]],open,'#eacf9b',4);
}
function borderRank(I){
 const {q,p,glow,poly,gem,route}=I,insert=q(.16,.59),latch=q(.59,.82);
 // One new notch is added to an already-developed ability, not a fresh unlock.
 I.gear(112,510,1.8,'#8de2df',insert*.9);I.gem(112,510,.74,'#e4efb5');
 for(let j=0;j<4;j++){const x=640+j*152;poly([[x-40,948],[x+40,948],[x+40,1018],[x-40,1018]],'#76cddd24','#8bd7e0',2);if(j<2)gem(x,981,.68,'#b7ede1');if(j===2)gem(x,855+126*insert,.68,'#eaf1a2');}
 I.spark(944,981,(p-.59)/.22,'#eaf4a7',15,93);
 route([[147,698],[141,854],[468,984]],insert,'#82dada',4);
 route([[1299,987],[1735,987],[1821,824],[1821,302]],latch,'#c7eba1',4);
 for(let j=0;j<3;j++)glow([[350+j*143,92],[350+j*143,48],[399+j*143,48]],'#97dee1',4);
 I.blade(1648,66,.7,Math.PI/2,'#d3f1c8');
}
function borderItemAdded(I){
 const {q,p,poly,glow,gem,route,fade}=I,arrive=q(.18,.59),snap=q(.59,.80);
 // Item count rises: a physical item enters inventory without a shopping claim.
 I.at(110,494,1,-.15,()=>{poly([[-58,-59],[54,-59],[67,53],[-57,69]],'#bc935b4d','#f4d08f',3);I.arc(0,-55,36,31,Math.PI,TAU,'#ffe2a4',4);glow([[-47,-11],[52,-11]],'#d8b881',3);});
 route([[122,650],[150,871],[490,995],[970,995]],arrive,'#e9ce93',4);
 for(let j=0;j<4;j++){const x=889+j*151;poly([[x-52,939],[x+52,939],[x+52,1033],[x-52,1033]],'#9cccb51a','#a8d6bd',2);}
 gem(395+arrive*796,974-Math.sin(arrive*Math.PI)*65,.92,'#83e7c3',arrive*.4);I.spark(1191,974,(p-.59)/.24,'#fff0c1',17,101);
 I.shield(1810,535,1.6,'#b5dfbf');fade(snap,()=>I.gem(1810,535,.86,'#ffe2a1'));
 I.route([[298,74],[489,48],[668,74]],snap,'#e6c994',4);I.route([[1325,58],[1633,58],[1719,109]],arrive,'#97dacb',3);
}
function borderItemRemoved(I){
 const {q,p,poly,gem,route,glow,fade}=I,leave=q(.17,.59);
 for(let j=0;j<4;j++){const x=539+j*177;poly([[x-55,940],[x+55,940],[x+55,1034],[x-55,1034]],'#b7acdd20','#c7bdde',2);if(j!==2)gem(x,987,.56,'#c6c9d9');}
 // The departing item is still an item: no sale coins, drinking or upgraded replacement.
 gem(893+leave*801,987-88*Math.sin(leave*Math.PI),.78,'#dccab5',leave*.5);
 route([[1113,989],[1704,989],[1824,841],[1824,380]],leave,'#b5c7e2',4);
 I.at(1824,534,1,0,()=>{I.arc(0,0,62,105,-Math.PI/2,Math.PI/2,'#bfc7dd',3);glow([[-32,-80],[16,0],[-32,80]],'#ddcdb5',4);});
 I.at(108,510,1,0,()=>{I.poly([[-46,-54],[46,-54],[52,51],[-52,51]],'#8394b130','#b5bfd6',3);glow([[-45,-11],[45,-11]],'#d5c8b9',2);});
 I.trace(u=>[318+u*1280,60+Math.sin(u*9)*17],'#b5bfd8',2,.7);
 fade(leave,()=>I.ring(893,987,26,26,'#c6d1e1',2,.5));
}
function borderCS(I){
 const {q,p,glow,minion,coin,route,fade}=I,last=q(.22,.53),bank=q(.53,.84);
 // Creep score is minion/monster last-hit progress, not an agricultural wheat field.
 for(let j=0;j<4;j++)I.minion(98+j%2*26,314+j*128,.9,'#aec4d9',last);
 I.blade(121,818,1.1,-.8+last*.8,'#f6dfa2');I.spark(120,780,(p-.53)/.24,'#ffe5ac',15,91);
 route([[155,855],[342,1004],[1504,1004]],bank,'#d4da8b',4);
 for(let j=0;j<9;j++){const b=q(.48+j*.02,.65+j*.02);coin(487+j*126,1000-Math.sin(b*Math.PI)*42,.75+j%3*.1);}
 // Tally bundle ties itself, then its sack visibly swells at the deposit.
 for(let j=0;j<4;j++)glow([[391+j*36,36],[380+j*36,98]],'#e6dda9',5);glow([[367,86],[533,45]],'#fff0be',5,bank);
 I.at(1818,535,1+bank*.12,0,()=>{I.oval(0,16,57,68,'#c09c6755','#f0d197');I.poly([[-39,-44],[-26,-77],[24,-77],[39,-44]],'#a9a27866','#e5d3a2',3);glow([[-38,-43],[38,-43]],'#f6d798',5);});
 I.route([[1286,65],[1662,65],[1818,282]],last,'#aee1af',3);
}
function borderVision(I){
 const {q,p,eye,trace,glow,poly,fade}=I,scan=q(.13,.59),reveal=q(.59,.82);
 // Ward score increases; an abstract lens gains clarity. No claimed placement,
 // revealed enemy, precise camp or fog-of-war coordinates.
 eye(112,477,1.6,'#9aeddb',scan);I.arc(112,477,76,131,-2.7,2.7,'#92cedb',3);
 for(let j=0;j<3;j++)trace(u=>[262+u*1340,987+j*18+Math.sin(u*10+j)*13],'#79c8cf',2,.45);
 I.at(960,974,1,0,()=>{I.ring(0,0,91,57,'#95e9d7',3);I.arc(0,0,71,42,-Math.PI,-Math.PI+TAU*scan,'#d5f5c1',5);I.eye(0,0,.9,'#b9edd8',reveal);});
 I.route([[117,647],[95,821],[332,975]],scan,'#90d5d5',4);
 for(let j=0;j<5;j++){const x=330+j*269;glow([[x-30,70],[x,42],[x+30,70]],'#b4e1da',3);I.oval(x,82,3,3,'#d6e7ba');}
 // Unresolved dots sharpen into geometric observations, not champion silhouettes.
 for(let j=0;j<4;j++)I.gem(1813,319+j*132,.25+.36*reveal,j%2?'#bcead4':'#eed7a4',j*.4);
 I.spark(960,975,(p-.59)/.22,'#cdfff0',15,119);
}
const BORDER_PROGRESSION={level_up:borderLevel,ultimate_learned:borderUltimate,ability_rank_up:borderRank,inventory_added:borderItemAdded,inventory_removed:borderItemRemoved,cs_milestone:borderCS,vision_activity:borderVision};
