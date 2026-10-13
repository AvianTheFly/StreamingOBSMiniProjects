function borderDeath(I){
 const {t,at,oval,glow,trace,arc,poly,face,ring}=I,breathe=Math.sin(t*.75);
 // A quiet resting state, still spatially authored: shell, folded wing, ram horn,
 // sleeping bear and a floating soul. No repeated text, orbiting badges or alarms.
 at(107,476+breathe*3,1,0,()=>{oval(0,10,67,47,'#85b6bd44','#a2d4d5');arc(0,12,49,35,Math.PI,TAU,'#c3e4db',2);for(const x of [-35,0,35])glow([[x,-11],[x*.7,43]],'#a5ccc8',2,.55);oval(53,25,19,13,'#b4ccd877','#b4ccd8');face(55,22,'sleep');});
 trace(u=>[254+u*396,71+Math.sin(u*5+t*.3)*13],'#abc0e1',2,.55);
 at(1524,63,1,0,()=>{arc(0,0,49,32,0,Math.PI*1.8,'#cdbbe7',4);arc(0,0,28,18,Math.PI,TAU*1.5,'#b4abc9',3);});
 at(1814,561,1,0,()=>{oval(0,0,47,55,'#8d9abb55','#b6c9e9');oval(-35,-42,18,18,'#a1b4d577','#b6c9e9');oval(35,-42,18,18,'#a1b4d577','#b6c9e9');face(0,0,'sleep',1.8);});
 trace(u=>[1779+Math.sin(u*7+t*.2)*19,267+u*161],'#b3bfde',2,.45);
 I.wing(419,989,.95,'#c8b7db',1,.55);I.wing(419,989,.95,'#aebcd9',-1,.55);
 at(1078,982+breathe*4,1,0,()=>{trace(u=>[-108+216*u,18+Math.sin(u*Math.PI)*36],'#afb6d4',3,.8);for(const x of [-108,108])glow([[x,-34],[x,65]],'#b7c2d8',4,.65);oval(0,9,31,37,'#d2d9f170','#d2d9f1');poly([[-29,19],[-27,47],[-11,38],[0,48],[11,38],[27,47],[29,19]],'#c9d1eb65',null);face(0,4,'sleep',1.4);});
 for(let j=0;j<5;j++){const a=t*.17+j;ring(1461+j*65,1007-Math.sin(a)*14,3+j%2*2,3+j%2*2,'#a9bddb',1.2,.45);}
}
function borderRespawn(I){
 const {p,q,trace,glow,wing,boot,arc,fade}=I,wake=q(.10,.44),launch=q(.44,.75);
 // Fountain fountain-ring fills, a soul returns, then homeward boots take off.
 for(let j=0;j<4;j++)arc(108,663-j*29,69-j*9,22,0,TAU,'#9cead1',3);
 trace(u=>[109+Math.sin(u*TAU*2-p*3)*56*(1-u*.7),637-u*364*wake],'#9ef1d9',5,.85);
 I.heart(110,437,1.55*wake,'#94eccd');I.spark(110,437,(p-.44)/.25,'#e7ffe0',21,126);
 I.route([[109,740],[158,924],[468,1005],[1451,1005],[1831,831]],launch,'#a1f4cf',5);
 boot(957+launch*330,967,1.4,'#ffdf9f',launch*.3);boot(897+launch*330,992,1.1,'#9ee5e4',-.3);
 wing(1804,486,1.4,'#ffcc94',-1,.3+.7*launch);wing(1804,486,.9,'#e6aef0',1,.3+.7*launch);
 // Four personalized spirit signatures emerge with different geometries.
 I.shield(412,63,.85,'#9ce2c2');wing(1480,66,.8,'#ffc689',-1,launch);
 arc(738,65,30,24,0,TAU*launch,'#c7adef',4);I.helm(1662,981,.8,'#a4dce9');
 for(let j=0;j<3;j++)glow([[1253+j*96,44],[1283+j*96,73],[1325+j*96,44]],'#adf1d9',3,launch);
}
function borderLowHealth(I){
 const {q,p,glow,trace,heart,poly}=I,alarm=q(.10,.42),steady=q(.42,.76);
 const beats=[[280,68],[644,68],[673,36],[693,109],[719,52],[738,68],[1507,68]];
 I.route(beats,alarm,'#ff758e',4);
 heart(105,512,2.8,'#ff7b9f');I.face(105,497,'sad',1.4);
 // A tiny remaining segment hangs on a taut thread. Never fills on its own.
 glow([[1808,245],[1808,815]],'#f7789435',15);glow([[1808,751],[1808,815]],'#ff8594',14);
 for(let j=0;j<3;j++)I.arc(1808,740,34+j*19,78+j*24,-2.9,-.3,'#ffac9d',2,.5);
 trace(u=>[275+u*1362,1006+Math.sin(u*15)*(1-steady)*14],'#ff93aa',3,.8);
 I.at(996,1003,1,Math.sin(p*17)*.05*(1-steady),()=>{I.poly([[-29,0],[0,-22],[29,0],[0,22]],'#ffe2b64d','#ffd5a0',2);I.line([[0,-11],[0,4]],'#fff0c4',3);I.oval(0,12,2,2,'#fff0c4');});
 I.shield(1630,981,.7,'#ffbe9e');
}
function borderHealthLoss(I){
 const {p,q,glow,heart,poly,at,route}=I,impact=q(.24,.50),brace=q(.57,.82);
 // Unknown damage source: a pressure wave, not a claimed sword/ability/enemy.
 for(let j=0;j<5;j++){const x=359+j*257;glow([[x-65,43],[x,82],[x+84,43]],'#ff9e7e',4,1-impact*.6);}
 I.route([[113,228],[113,398]],q(.08,.24),'#ffe7b5',10);
 at(113,513,1,-Math.sin(impact*Math.PI)*.19,()=>{heart(0,0,2.45,'#ff8d8b');I.face(0,-13,'sad',1.4);});
 I.spark(113,455,(p-.24)/.3,'#ffc190',23,126);
 for(let j=0;j<7;j++){const a=.2+j*.18,dx=Math.sin(a)*100*impact;I.gem(117+dx,624+j*38*impact,.22,'#ffbd97',j*impact);}
 route([[256,1007],[743,1007],[770,972],[799,1027],[837,1007],[1621,1007]],q(.25,.58),'#fe9c98',3);
 glow([[1817,262],[1817,812]],'#ff829d35',15);glow([[1817,566+impact*130],[1817,812]],'#ff8998',13);
 // The bandage attaches to the cartoon heart while the loss meter stays reduced.
 at(220-107*brace,521,1,-.3,()=>poly([[-35,-11],[35,-11],[35,11],[-35,11]],'#edd5a980','#ffdfb3',2));
}
function borderHeal(I){
 const {q,p,heart,glow,trace,ring,poly}=I,rise=q(.17,.49),bloom=q(.49,.80);
 // Net recovery is a replenishing spring, with no attributed item or healer.
 for(let j=0;j<4;j++)ring(114,706+j*24,30+j*13,10+j*3,'#87f0c6',2);
 trace(u=>[111+Math.sin(u*TAU)*34,697-u*268*rise],'#a0f7d3',7,.8);
 heart(112,460,1.7+rise*.5,'#85eabd');I.face(112,449,'happy',1.1);
 I.route([[128,808],[303,1006],[940,1006]],rise,'#97eec9',5);
 for(let j=0;j<8;j++){const b=q(.4+j*.028,.61+j*.028),x=554+j*129;I.sprout(x,1040,b*(.6+j%2*.35),j%2?'#b8efb7':'#86eacb');}
 glow([[1814,263],[1814,815]],'#79e8c438',15);glow([[1814,736-359*bloom],[1814,815]],'#8bf0cf',13);
 for(let j=0;j<5;j++)I.fade(bloom,()=>heart(1790+Math.sin(j)*44,653-j*76,.27+j%2*.12,'#efbfd9'));
 trace(u=>[339+u*1204,67+Math.sin(u*8)*20],'#b4f3cd',4,.75);
 I.spark(112,449,(p-.49)/.25,'#e0ffda',19,112);
}
function borderResource(I){
 const {q,p,glow,poly,ring,route,gem}=I,spend=q(.20,.60);
 // Snapshot proves a resource decrease, not an empty mana pool or ability cast.
 poly([[74,299],[146,299],[165,341],[165,719],[145,757],[74,757],[55,719],[55,341]],'#457aab22','#8ad1f7',3);
 poly([[66,393+spend*160],[154,393+spend*160],[154,711],[140,741],[81,741],[66,711]],'#59bce766',null);
 for(let j=0;j<5;j++)glow([[64,366+j*72],[87,366+j*72]],'#c1e8fb',2);
 route([[162,669],[203,947],[604,1005],[1261,1005]],spend,'#83d5ff',4);
 for(let j=0;j<5;j++){const b=q(.23+j*.03,.57+j*.03);gem(242+b*1090,985-Math.sin(b*Math.PI)*45,.4,'#b1d9ff',b);}
 I.gear(1813,507,1.5,'#b2baf3',spend*.75);I.question(1813,506,1,'#dcddff');
 for(let j=0;j<3;j++){glow([[316+j*102,67],[377+j*102,67]],'#8fd0f5',5,.5);}
 I.trace(u=>[1230+u*363,74+Math.sin(u*7)*12],'#abaeef',3,.7);
}
const BORDER_VITALS={death:borderDeath,respawn:borderRespawn,low_health:borderLowHealth,heavy_health_loss:borderHealthLoss,large_heal:borderHeal,resource_spent:borderResource};
