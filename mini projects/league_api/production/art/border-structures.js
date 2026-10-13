function borderTowerDown(I){
 const {p,q,tower,glow,poly,route}=I,crush=q(.40,.65);
 tower(112,510,2.1,'#b9dad0',crush);I.spark(112,490,(p-.40)/.3,'#ffdaa4',23,141);
 for(let j=0;j<9;j++){const b=q(.4+j*.019,.61+j*.019),x=292+j*165;I.at(x,1008-Math.sin(b*Math.PI)*70,1,j*.7*b,()=>poly([[-26,-19],[23,-25],[33,12],[-17,21]],'#b3c9b24d','#dbdebb',2));}
 route([[101,730],[66,861],[190,1031],[1677,1031],[1820,853]],q(.4,.82),'#d7bd90',4);
 // Opening a lane: upper crenellations separate, lower minions advance into the gap.
 for(let j=0;j<7;j++){const x=375+j*181,fall=q(.41+j*.025,.65+j*.025);glow([[x,65],[x+27,65],[x+27,32+fall*44],[x+64,32+fall*44],[x+64,65]],'#a7cfc3',4,1-fall*.5);}
 for(let j=0;j<3;j++)I.minion(1810,352+j*129,1.25,'#d9ddb1',crush);
 I.poly([[1755,756],[1877,756],[1816,818]],'#e3c28155','#ffda9a',3);
}
function borderFirstTower(I){
 const {p,q,tower,coin,glow,route,fade}=I,breaks=q(.36,.56),gold=q(.56,.82);
 // One first-turret trophy breaks its ribbon, then a visible gold cascade banks below.
 tower(1804,496,2.0,'#f3d995',breaks);I.crown(1805,318,1.1,'#ffe5ac');
 route([[1812,669],[1812,859],[1517,989]],q(.4,.67),'#ffce7c',6);
 for(let j=0;j<11;j++){const b=q(.43+j*.02,.62+j*.02);coin(1540-j*108,986-60*Math.sin(b*Math.PI),1.1);}
 I.spark(1808,489,(p-.36)/.27,'#fff2bd',23,129);
 I.at(112,596,1,0,()=>{I.poly([[-54,-26],[56,-26],[45,36],[-46,36]],'#ad895b70','#ffe09a',3);I.arc(0,-26,44,49,Math.PI,TAU,'#ffdf95',4);});
 route([[119,460],[80,258],[273,66],[687,66]],gold,'#f4d397',4);
 for(let j=0;j<3;j++)I.gem(1329+j*110,63,.54,'#b8e8d0',j*.4);
 fade(gold,()=>I.star(114,597,23,'#fff0b4'));
}
function borderInhibDown(I){
 const {p,q,gem,glow,poly,route,fade}=I,shatter=q(.38,.63),march=q(.63,.87);
 // Crystal break releases lane pressure: a larger armored minion gets through.
 for(let j=0;j<5;j++){const a=j*TAU/5,x=111+Math.cos(a)*68*shatter,y=475+Math.sin(a)*105*shatter;gem(x,y,1.0,'#d18aff',a*shatter);}
 I.spark(111,475,(p-.38)/.27,'#a2edff',23,146);
 route([[110,665],[120,860],[387,993],[1368,993]],shatter,'#b28aee',5);
 I.minion(1335+march*166,973,1.5+march*.8,'#aacdf2',march);I.shield(1453+march*166,1000,.85,'#dcafff');
 for(let j=0;j<3;j++)I.minion(630+j*178,1010,.8,'#c3b4df',march);
 glow([[1790,289],[1855,289],[1855,763],[1790,763]],'#a798dc',4);fade(march,()=>{I.bolt(1823,510,1.8,'#d8bdff');});
 for(let j=0;j<6;j++)gem(349+j*237,66,.42+shatter*.22,j%2?'#83d8eb':'#c0a0ef',j*.8+shatter*.6);
}
function borderInhibSoon(I){
 const {q,p,gem,glow,ring,trace,poly}=I,align=q(.19,.72);
 // Warning is an incomplete blueprint. No invented countdown or completed crystal.
 I.at(1812,525,1,0,()=>{I.c.save();I.c.setLineDash([9,11]);poly([[0,-98],[-62,0],[0,99],[62,0]],'#8aa6ee0a','#bdc7ff',3);I.c.restore();ring(0,105,71,15,'#9ae3e4',2);});
 for(let j=0;j<5;j++){const a=j*TAU/5+.5*align;gem(111+Math.cos(a)*70,535+Math.sin(a)*145,.62,'#a9b9f5',a);}
 I.trace(u=>[311+u*1240,995+Math.sin(u*TAU*2)*29],'#95c6f1',3,.65);
 for(let j=0;j<4;j++){const x=520+j*252;I.c.save();I.c.setLineDash([6,9]);glow([[x,946],[x-40,1000],[x,1041],[x+40,1000],[x,946]],'#c9b8f5',2,.7);I.c.restore();}
 I.arc(443,70,43,43,-Math.PI/2,-Math.PI/2+Math.PI*1.6*align,'#a6d8f3',4);glow([[443,70],[455,42]],'#ffe2aa',3);
 I.route([[624,63],[781,63]],align,'#94e4e3',3);I.route([[1163,63],[1535,63]],align,'#bdadf3',3);
}
function borderInhibRestored(I){
 const {p,q,gem,glow,route,fade}=I,join=q(.17,.61),seal=q(.61,.84);
 for(let j=0;j<4;j++){const a=j*TAU/4;gem(1817+Math.cos(a)*60*(1-join),509+Math.sin(a)*165*(1-join),.78,'#9df1dc',a*(1-join));}
 I.shield(1817,509,1.5*seal,'#dbb7fa');I.spark(1817,509,(p-.61)/.24,'#d6fff1',19,119);
 route([[349,1008],[742,1008],[1120,969],[1635,969],[1820,720]],join,'#92e9d5',4);
 // The invasion gate closes; oversized minion silhouette retires behind it.
 I.fade(1-seal*.75,()=>I.minion(109,563,1.5-seal*.6,'#bdabd8',0));
 for(let j=0;j<4;j++)glow([[60+j*33,355],[60+j*33,355+316*seal]],'#9ee8dd',4);
 for(let j=0;j<5;j++){const x=425+j*259;I.gem(x,68,.45+seal*.16,j%2?'#bda5ed':'#99e8da');}
 fade(seal,()=>I.arc(1076,1009,64,24,Math.PI,TAU,'#c3f0df',5));
}
const BORDER_STRUCTURES={turret_destroyed:borderTowerDown,first_turret:borderFirstTower,inhibitor_destroyed:borderInhibDown,inhibitor_respawning_soon:borderInhibSoon,inhibitor_respawned:borderInhibRestored};
