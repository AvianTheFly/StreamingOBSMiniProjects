function borderBaron(I){
 const {p,q,at,poly,oval,glow,eye,minion,route,fade}=I,wake=q(.11,.43),buff=q(.43,.77);
 // Baron has many eyes, a tall neck and asymmetric horns; the reward empowers a siege line.
 at(110,531,1,0,()=>{I.trace(u=>[Math.sin(u*6)*31,248-u*463],'#a782f5',31,.32);poly([[-72,-73],[-91,-129],[-45,-99],[-18,-146],[0,-106],[33,-151],[41,-97],[91,-130],[69,-57],[51,50],[-49,48]],'#79519f70','#bd91fb',3);for(let j=0;j<3;j++)eye(-32+j*31,-51+j%2*25,.42,'#b9f8bf',wake);glow([[-43,7],[0,23],[43,7]],'#e9c8f7',4);});
 I.trace(u=>[226+u*1310,67+Math.sin(u*TAU*2)*22],'#b38df1',5,.8);
 for(let j=0;j<5;j++){const b=q(.44+j*.035,.65+j*.035),x=396+j*262;minion(x,1003,1.0+b*.65,j%2?'#cba2fc':'#a9e3d6',b*.7);fade(b,()=>{I.wing(x,965,.55,'#c5a0ff',-1,.85);I.wing(x,965,.55,'#c5a0ff',1,.85);});}
 route([[171,773],[207,981],[1622,981],[1824,790]],buff,'#bd8cff',4);
 // Right recall spiral tightens into a homeward chevron; top crest gains void horns.
 I.trace(u=>{const a=u*TAU*2,r=67*(1-u*.72);return[1825+Math.cos(a)*r,521+Math.sin(a)*r*2.4];},'#8de0db',3,.4+.5*buff);
 I.crown(1758,75,1,'#b79af1');I.spark(110,531,(p-.43)/.25,'#abf1cf',21,118);
}
function borderHerald(I){
 const {p,q,eye,poly,glow,at,tower,spark}=I,pick=q(.12,.35),charge=q(.38,.68),impact=q(.68,.86);
 // Eye captured on the left; a horned shell travels the bottom siege lane.
 eye(113,434,1.8,'#d8a3ff',pick);I.arc(113,434,77,114,-2.5,2.5,'#ad83f4',3);
 I.route([[115,576],[115,826],[344,990],[790,990]],q(.2,.52),'#bb89f6',4);
 const contact=borderHeraldMotion(p);at(contact.shellX,973,1,0,()=>{I.oval(0,0,65,48,'#736aa8bf','#c9b5ff');for(let j=0;j<4;j++)I.arc(0,0,20+j*12,28+j*5,Math.PI,TAU,'#cca2fc',2);poly([[46,-20],[99,-10],[80,14],[60,15]],'#b5a7e8cc','#e6cdfa',3);eye(41,3,.33,'#aef5d9');for(const x of [-40,18])glow([[x,34],[x+10,54]],'#b49ae1',7);});
 tower(1640,1008,1.0,'#e6cb99',impact);glow([[contact.targetFace,949],[contact.targetFace,981]],'#ffe9b5',4,1-impact);spark(contact.targetFace,contact.hornY,(p-.68)/.24,'#eddb9c',19,108);
 // Upper survey line and a right-side launch banner have distinct jobs.
 I.route([[271,69],[640,69],[664,46],[687,69],[1403,69],[1577,111]],pick,'#ccadef',3);
 for(let j=0;j<4;j++)glow([[1794,275+j*132],[1841,315+j*132],[1794,355+j*132]],'#b4c1ee',4,.45+.4*charge);
}
function borderGrub(I){
 const {p,q,at,oval,poly,eye,glow,route,spark}=I,nibble=q(.26,.54),reward=q(.54,.80);
 // Exactly ONE grub per HordeKill. Its smaller mites are abstract burrow sparks.
 at(118,529,1,0,()=>{oval(0,0,65,93,'#9976c565','#d0a8ef');poly([[-51,-51],[-74,-102],[-29,-70]],'#cfb4fa66','#cfb4fa',2);poly([[34,-73],[63,-113],[60,-42]],'#cfb4fa66','#cfb4fa',2);eye(0,-22,.83,'#baf0d8');for(let j=0;j<4;j++)I.arc(0,25+j*16,52-j*7,12,0,Math.PI,'#b28ad8',3);});
 I.trace(u=>[265+u*1412,57+14*Math.sin(u*10)],'#bd8edf',5,.65);
 // A single purple tendril infects masonry, then a bitten brick drops from the seam.
 route([[140,669],[117,819],[386,1004],[1039,1004],[1747,986],[1818,737]],q(.14,.54),'#c48ef7',5);
 for(let j=0;j<6;j++){const y=290+j*78;poly([[1777,y],[1848,y],[1848,y+49],[1777,y+49]],'#638f9750','#a2d5d1',2);if(j===5)I.fade(reward,()=>poly([[1812, y+10],[1830,y+4],[1819,y+21],[1839,y+23],[1814,y+40]],'#172b3d',null));}
 spark(1800,718,(p-.54)/.23,'#bdf5d1',14,84);
 I.gem(1678+reward*36,963+reward*61,.7,'#b9cce3',reward*.8);
 I.fade(reward,()=>I.crown(469,972,.7,'#dec995'));
}
function borderSteal(I){
 const {p,q,at,poly,glow,gem,eye,route,fade}=I,reach=q(.16,.40),snatch=q(.40,.64),escape=q(.64,.88);
 // The trophy changes hands in view. A decoy sack remains; no fabricated killer identity.
 I.arc(112,450,77,148,-1.6,1.8,'#b39ee6',3);eye(112,451,1.0,'#d6b2ff');
 gem(128+snatch*540,826+snatch*148,1.3,'#ffdb86',snatch*.4);
 const hx=561-reach*406+snatch*505;at(hx,839+snatch*135,1,0,()=>{poly([[-42,-17],[2,-20],[16,-12],[28,-20],[38,-6],[14,15],[-43,19]],'#86e9e377','#befaf0',3);glow([[-74,-12],[-43,-12]],'#7dccec',10);});
 route([[115,870],[156,1008],[688,1008],[1609,1008],[1838,831],[1838,239]],q(.40,.86),'#71dce6',4);
 at(806+escape*740,976,1,-.2+escape*.5,()=>{I.oval(0,0,45,36,'#68cdd677','#c1e8d8');poly([[-28,-30],[0,-47],[27,-30]],'#6bcbd7aa','#baf0ee',2);I.eye(0,-1,.5,'#273c55');});
 I.fade(snatch,()=>{I.cloud(118,857,.8,'#ccabe6');I.question(121,751,1,'#f5cf91');});
 for(let j=0;j<5;j++)glow([[349+j*216,87],[444+j*216,47],[506+j*216,47]],'#83eff3',4,.6*q(.36,.78));
 fade(escape,()=>I.gem(1832,388,.65,'#ffd78b'));I.spark(145,836,(p-.40)/.23,'#d8fff1',14,76);
}
function borderAtakhan(I){
 const {q,p,trace,poly,glow,eye}=I,thorn=q(.12,.55),bloom=q(.55,.83);
 // Retained legacy, thornbound blood-rose imagery. Detection remains disabled by default.
 for(const [x,dir] of [[97,1],[1821,-1]]){trace(u=>[x+dir*Math.sin(u*12)*38,187+u*696],'#ce6395',7,.75);for(let j=0;j<7;j++)poly([[x,251+j*84],[x+dir*53*thorn,218+j*84],[x+dir*15,265+j*84]],'#d787bc70','#efa1c9',2);}
 eye(116,456,1.1,'#ffd493',thorn);eye(1816,618,.8,'#ffc698',thorn);
 I.route([[294,72],[716,49],[790,87]],thorn,'#f498b2',4);I.route([[1151,75],[1436,48],[1675,81]],thorn,'#c188dd',4);
 for(let j=0;j<5;j++){const x=493+j*244;I.at(x,992,1,j*.7,()=>{for(let k=0;k<5;k++){const a=k*TAU/5;I.oval(Math.cos(a)*21*bloom,Math.sin(a)*21*bloom,17,11,'#d271a688','#f0b0d0');}I.gem(0,0,.4,'#ffdc9e');});}
 I.spark(965,992,(p-.55)/.3,'#f0a9d3',21,157);
}
const BORDER_OBJECTIVES={baron:borderBaron,herald:borderHerald,void_grub:borderGrub,objective_steal:borderSteal,atakhan_legacy:borderAtakhan};
