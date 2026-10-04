// Supporting performances for the primary sound cues. Every scene chooses its
// own props, placement and acting; paint helpers carry no composition policy.
function cueAccents(c,t,d,e){
 const {p,beat,line,poly,disc,curve,halo,light,metal,ring}=cueInk(c,t,d,e);
 const ice='#88e7f2',pink='#df88d6',gold='#edc778',mint='#80d7ab',purple='#ab8dea';
 let arrivals=0;
 const place=(x,y,s,a,draw)=>{const arrive=smooth((p-(arrivals++%5)*.026)/.10);c.save();c.globalAlpha*=arrive;c.translate(x,y+(1-arrive)*10);c.rotate(a);c.scale(s*(1.25+.2*arrive),s*(1.25+.2*arrive));draw();c.restore();};
 const star=(x,y,s,color,a=0)=>place(x,y,s,a,()=>{poly([[0,-16],[4,-4],[16,0],[4,4],[0,16],[-4,4],[-16,0],[-4,-4]],color,.7);line([[0,-12],[0,12]],'#e8ffff',.7,.8);});
 const heart=(x,y,s,color)=>place(x,y,s,Math.sin(t*.5+x)*.08,()=>{poly([[0,19],[-20,1],[-19,-11],[-10,-17],[0,-8],[10,-17],[19,-11],[20,1]],color,.75);line([[-15,-9],[-10,-12],[-4,-9]],'#f4e7ef',1,.8);});
 const bolt=(x,y,s,color,a)=>place(x,y,s,a,()=>poly([[-4,-19],[13,-19],[1,-2],[11,-2],[-13,22],[-4,4],[-13,4]],color,.77));
 c.save();c.globalAlpha*=smooth(t/Math.min(.38,d*.2))*smooth((d-t)/Math.min(.48,d*.2));
 switch(e.style){
 case 'crabs':{
  // A glossy sea-shell promenade, swaying kelp and little beach lanterns.
  for(const[x,y,s,a]of [[90,685,1.2,-.4],[1841,289,1,.3],[668,1036,.8,0],[1468,54,.7,.2]])place(x,y,s,a+Math.sin(t*.5)*.035,()=>{poly([[-25,15],[-31,-4],[-17,-22],[0,-27],[17,-22],[31,-4],[25,15]],metal([-31,-27,31,15],['#efd5b8','#c4909e','#e2c2a9','#808eb0']));for(let j=-2;j<=2;j++)curve(u=>[j*7+Math.sin(u*1.4)*j*5,13-u*35],gold,1,.7);ring(0,14,24,4,ice,1,.5);});
  for(const side of [0,1])for(let j=0;j<4;j++){const x=side?1845+j*13:68+j*13;curve(u=>[x+Math.sin(u*7-t*1.3+j)*14,776-u*(83+j*31)],mint,3,.42);light(u=>[x+Math.sin(u*7-t*1.3+j)*14,776-u*(83+j*31)],ice,j*.18,.25,2);}
  for(let j=0;j<9;j++){const age=(t*.13+j*.137)%1;ring(1825+Math.sin(j)*32,716-age*453,5+age*6,5+age*6,ice,1,Math.sin(age*Math.PI)*.55);}break;
 }
 case 'coffin':{
  // The procession has hats, tuxedo shoulders and gilded memorial candles.
  for(let j=0;j<4;j++)place(640+j*211,1039+Math.sin(beat*Math.PI+j)*5,.72,Math.sin(beat+j)*.05,()=>{poly([[-27,21],[-22,-4],[-9,-12],[9,-12],[22,-4],[27,21]],'#63748f');poly([[-10,-12],[0,3],[10,-12],[8,12],[-8,12]],'#dce9e7');disc(0,-22,13,14,'#a58c77');disc(0,-35,25,5,'#344758');poly([[-17,-50],[17,-50],[17,-35],[-17,-35]],'#3d5168');poly([[-13,-26],[-2,-26],[-2,-20],[-13,-20]],'#182c40');poly([[2,-26],[13,-26],[13,-20],[2,-20]],'#182c40');});
  for(const[x,y]of [[95,621],[1826,304],[1838,678]]){poly([[x-9,y-24],[x+9,y-24],[x+9,y+25],[x-9,y+25]],'#c4b49990');line([[x-13,y+28],[x+13,y+28]],gold,3);disc(x,y-35,4+Math.sin(t*2+x)*.6,10,gold,.8);halo(x,y-32,38,gold,.25);}
  for(let j=0;j<7;j++)star(340+j*193,18, .34,gold,t*.05+j);break;
 }
 case 'bonk':{
  for(const[x,y,s]of [[1839,329,.9],[1849,664,.7],[643,57,.64]])place(x,y,s,t*.13+x,()=>{poly([[-17,-12],[17,-12],[26,0],[17,12],[-17,12],[-26,0]],metal([-26,-12,26,12]));ring(0,0,8,8,ice,3,.85);});
  for(let j=0;j<8;j++){const age=(beat*.19+j*.14)%1,x=80+Math.sin(j*2.3)*age*64,y=433-age*106+age*age*116;c.save();c.globalAlpha*=Math.sin(age*Math.PI);star(x,y,.3+age*.3,j%2?ice:gold,age*4);c.restore();}
  for(let j=0;j<3;j++){const x=1240+j*72,y=1026+Math.sin(beat*1.5+j)*9;line([[x,y-29],[x,y+23]],'#7b9eb5',5);poly([[x-23,y-37],[x+25,y-37],[x+25,y-21],[x-23,y-21]],metal([x-23,y-37,x+25,y-21]));}break;
 }
 case 'sparkles':{
  for(let j=0;j<8;j++){const side=j%2,x=side?1838+Math.sin(j)*30:67+Math.sin(j)*33,y=205+j*69;place(x,y,.5+j%3*.16,t*.12+j*.4,()=>{halo(0,0,43,[purple,pink,ice][j%3],.3);poly([[0,-24],[18,-3],[8,23],[-11,23],[-18,-3]],metal([-18,-24,18,23],['#edfaff8f','#a896db88','#cf93ce70','#80b9e270']));line([[0,-24],[-3,2],[8,23]],ice,1,.85);});}
  for(let j=0;j<16;j++){const x=345+j*77;star(x,j%2?1036:67,.22+.15*Math.sin(t*.9+j)**2,[ice,pink,gold][j%3],t*.1+j);}
  curve(u=>[337+u*1260,1052+Math.sin(u*12-t*.7)*8],purple,2,.36);break;
 }
 case 'disco':{
  // A bright record sleeve, headphones and rotating starburst wall fixtures.
  place(75,247,1,-.2,()=>{poly([[-39,-33],[39,-33],[39,33],[-39,33]],'#9977b654');disc(0,0,27,27,'#263c58');ring(0,0,21,21,pink,1,.75);disc(0,0,7,7,gold);});
  place(1841,247,.88,.13,()=>{curve(u=>[Math.cos(Math.PI+u*Math.PI)*34,Math.sin(Math.PI+u*Math.PI)*35],ice,7,.9);poly([[-39,-4],[-25,-4],[-25,25],[-39,25]],purple);poly([[25,-4],[39,-4],[39,25],[25,25]],purple);});
  for(let j=0;j<10;j++){const x=453+j*112,y=1045;const height=9+Math.sin(beat*2-j*.37)**2*26;poly([[x,y],[x+17,y],[x+17,y-height],[x,y-height]],[pink,ice,gold,purple][j%4],.67);}
  for(const[x,y]of [[81,690],[1846,731]])place(x,y,.8,t*.5,()=>{for(let j=0;j<8;j++)star(Math.cos(j*TAU/8)*45,Math.sin(j*TAU/8)*45,.27,j%2?ice:pink,j*.7);ring(0,0,24,24,gold,1,.7);});break;
 }
 case 'equalizer':{
  for(const[x,y,s]of [[90,390,1],[1827,582,.92],[612,1040,.52]])place(x,y,s,0,()=>{poly([[-32,-57],[32,-57],[32,57],[-32,57]],metal([-32,-57,32,57],['#aec4d6','#4d637b','#8ea4b9','#263e58']));for(const yy of [-28,28]){disc(0,yy,22,22,'#273d53');ring(0,yy,17+Math.sin(beat*2)*1.7,17+Math.sin(beat*2)*1.7,ice,1.2,.7);disc(0,yy,8,8,'#7cb5c486');}for(let j=0;j<4;j++)disc(-19+j*13,-49,1.6,1.6,j%2?mint:gold);});
  for(let j=0;j<20;j++){const x=389+j*57,y=44;disc(x,y,4,3+Math.sin(beat*2+j*.31)**2*17,[ice,purple,mint][j%3],.56);}
  bolt(1469,1028,.85,gold,.1);break;
 }
 case 'mash':{
  for(const[x,y,s,color]of [[1845,308,.9,purple],[1828,598,1.1,gold],[592,67,.7,mint]])place(x,y,s,Math.sin(t*.7+x)*.12,()=>{poly([[-10,-31],[10,-31],[10,-12],[23,3],[23,25],[-23,25],[-23,3],[-10,-12]],'#90b4dc45');poly([[-20,7],[20,7],[20,22],[-20,22]],color+'88');line([[-10,-31],[10,-31],[10,-12],[23,3],[23,25]],ice,1,.75);poly([[-13,-37],[13,-37],[13,-29],[-13,-29]],'#c7ae89');halo(0,16,35,color,.28);});
  place(1450,1036,.76,.1,()=>{poly([[-40,20],[1,-58],[39,20]],metal([-40,-58,39,20],['#8c94d3','#49639a','#a58bc8','#364b7e']));disc(0,21,51,8,'#8094bd');star(1,-19,.4,gold,.2);});
  for(let j=0;j<15;j++){const age=(t*.11+j*.618)%1;star(j%2?1835:93,754-age*556,.15+age*.2,j%2?pink:gold,age*5);}break;
 }
 case 'balloons':{
  for(const[x,y,s,color]of [[107,731,.8,pink],[1831,290,.85,purple],[621,1040,.7,mint],[1436,1040,.85,gold]])place(x,y,s,Math.sin(t*.65+x)*.06,()=>{poly([[-26,-23],[26,-23],[26,23],[-26,23]],metal([-26,-23,26,23],[color,'#7399ae',color,'#486286']));poly([[-29,-28],[29,-28],[29,-17],[-29,-17]],color);line([[0,-27],[0,23]],gold,5);ring(-9,-33,12,6,ice,2,.8,-.25);ring(9,-33,12,6,ice,2,.8,.25);});
  for(let j=0;j<4;j++)place(497+j*252,70,.52,-.2+Math.sin(t+j)*.1,()=>{disc(0,0,25,16,pink,.78);poly([[-23,7],[23,7],[16,29],[-16,29]],'#e8c6a3');for(let k=0;k<4;k++)line([[-13+k*8,11],[-10+k*7,27]],gold,1,.7);disc(0,-13,6,6,'#d597b0');});break;
 }
 case 'rats':{
  for(const[x,y,s]of [[1833,260,.78],[1838,684,.95],[1281,1039,.73]])place(x,y,s,Math.sin(beat+x)*.15,()=>{curve(u=>[17+u*35,14+Math.sin(u*5+beat)*19],pink,3,.7);disc(0,0,25,16,metal([-25,-16,25,16]));disc(-18,-14,11,12,'#aec6d0');disc(7,-15,10,11,'#aec6d0');disc(-18,-14,6,7,'#c8a9b9');disc(-18,-2,2,2,'#2a3d52');disc(-29,8,3,2,pink);line([[-9,12],[-14,24]],ice,4);line([[14,12],[21,22]],ice,4);});
  for(const[x,y,s]of [[88,702,.8],[1675,65,.65],[609,1038,.6]])place(x,y,s,-.12,()=>{poly([[-29,19],[27,19],[20,-22],[-27,-10]],'#d4ba7b');disc(-14,7,4,4,'#ae8a59');disc(8,1,5,4,'#ae8a59');disc(14,13,3,3,'#ae8a59');line([[-27,-10],[20,-22],[27,19]],'#f1db98',1.5);});
  for(let j=0;j<10;j++)star(382+j*121,35,.2,[gold,ice,pink][j%3],t*.4+j);break;
 }
 case 'shades':{
  for(const side of [0,1])for(let j=0;j<13;j++){const x=side?1848:85,y=216+j*42;ring(x+Math.sin(t*.9+j*.32)*8,y,9,16,j%2?gold:ice,2,.66,Math.sin(t*.7+j)*.35);}
  for(const[x,y,s]of [[78,696,.8],[1835,286,.7],[491,1042,.6]])place(x,y,s,t*.1,()=>{disc(0,0,18,18,gold,.58);for(let j=0;j<8;j++){const a=j*TAU/8;line([[Math.cos(a)*25,Math.sin(a)*25],[Math.cos(a)*34,Math.sin(a)*34]],gold,2,.75);}});
  bolt(1480,1043,.8,ice,-.3);bolt(541,59,.65,purple,.2);break;
 }
 case 'nyan':{
  for(let j=0;j<18;j++){const x=j%2?1837+(j%3)*14:63+(j%3)*14,y=205+j*31;c.save();c.globalAlpha*=.3+.4*Math.sin(beat*.8+j)**2;poly([[x-3,y-10],[x+3,y-10],[x+3,y-3],[x+10,y-3],[x+10,y+3],[x+3,y+3],[x+3,y+10],[x-3,y+10],[x-3,y+3],[x-10,y+3],[x-10,y-3],[x-3,y-3]],j%3?ice:gold);c.restore();}
  for(let j=0;j<4;j++)place(481+j*312,1037+Math.sin(beat+j)*4,.7,0,()=>{poly([[-24,-13],[-24,-26],[-11,-16],[11,-16],[24,-26],[24,14],[-24,14]],['#9ebcce','#cba9d9','#a7d3b6','#deb5a5'][j]);poly([[-13,-3],[-8,-3],[-8,2],[-13,2]],'#30485f');poly([[8,-3],[13,-3],[13,2],[8,2]],'#30485f');poly([[-4,6],[4,6],[0,11]],pink);});break;
 }
 case 'oops':{
  for(let j=0;j<6;j++)place(j%2?1853:91,242+j*78,.6+(j%3)*.1,Math.sin(t*.7+j)*.18,()=>{poly([[-19,-27],[12,-27],[24,-15],[24,27],[-19,27]],'#bddbe96e');poly([[12,-27],[12,-15],[24,-15]],ice,.55);for(let k=0;k<4;k++)line([[-12,-12+k*9],[13,-12+k*9]],ice,1,.65);});
  for(let j=0;j<9;j++)star(384+j*134,j%2?1043:28,.2,ice,t*.2+j);break;
 }
 case 'tantrum':{
  for(const[x,y,s,phase]of [[1839,296,.85,0],[87,649,.74,1],[1394,1040,.58,2]])place(x,y+Math.sin(beat*2+phase)*5,s,Math.sin(beat+phase)*.1,()=>{disc(0,0,30,30,metal([-30,-30,30,30],['#e1bab9','#b46f83','#e6b29c','#725b88']));line([[-20,-12],[-6,-5]],'#593d61',3);line([[6,-5],[20,-12]],'#593d61',3);disc(-12,0,3,3,'#4b3952');disc(12,0,3,3,'#4b3952');curve(u=>[-11+u*22,14-Math.sin(u*Math.PI)*5],ice,2);});
  for(let j=0;j<8;j++){const age=(t*.25+j*.13)%1;curve(u=>[j%2?1835+u*30:90-u*30,370+u*25-age*77],pink,2,(1-age)*.45);}bolt(668,60,.73,gold,.2);break;
 }
 case 'kitchen':{
  for(const[x,y,s,kind]of [[1842,297,.8,0],[90,715,.8,1],[1830,691,.7,2]])place(x,y,s,Math.sin(t*.8+x)*.1,()=>{line([[0,38],[0,-34]],metal([-3,0,3,0]),5);if(kind===0){disc(0,-41,13,19,metal([-13,-60,13,-22]));disc(0,-41,8,13,'#709eaf55');}else{line([[-14,-52],[-14,-31],[14,-31],[14,-52]],ice,3);line([[0,-52],[0,-31]],ice,3);}});
  for(let j=0;j<6;j++)place(418+j*202,1044,.55,Math.sin(t+j)*.2,()=>{disc(0,0,22,18,j%2?'#c8a6aa':'#acd3a4');for(let k=0;k<5;k++)poly([[0,-16],[Math.cos(k*TAU/5)*12,-18+Math.sin(k*TAU/5)*9],[0,-12]],mint);});
  for(let j=0;j<8;j++)star(450+j*147,23,.2,gold,t*.4+j);break;
 }
 case 'meltdown':{
  for(const[x,y,s]of [[85,246,.85],[1828,699,.8],[684,64,.7]])place(x,y,s,-.1,()=>{disc(0,0,30,30,'#638194a0');ring(0,0,30,30,ice,2,.7);for(let j=0;j<7;j++){const a=-2.4+j*.55;line([[Math.cos(a)*21,Math.sin(a)*21],[Math.cos(a)*26,Math.sin(a)*26]],j<4?mint:pink,1.4);}const a=-2.4+smooth(p)*4.2;line([[0,0],[Math.cos(a)*21,Math.sin(a)*21]],gold,2);disc(0,0,3,3,ice);});
  for(let j=0;j<6;j++)bolt(j%2?1833:82,360+j*57,.33,pink,Math.sin(t+j)*.2);
  curve(u=>[447+u*1060,1049+Math.sin(u*18-t*2)*4],pink,2,.4);break;
 }
 case 'rewind':{
  for(const[x,y,s]of [[1834,315,.8],[1819,677,.73],[1250,1041,.66]])place(x,y,s,Math.sin(t*.4+x)*.08,()=>{poly([[-34,-25],[34,-25],[34,25],[-34,25]],metal([-34,-25,34,25]));disc(0,0,20,20,'#304b65');ring(0,0,16,16,ice,1.5);poly([[33,-12],[54,-25],[54,25],[33,12]],'#90acc0');disc(-15,-34,10,10,'#8db6c8');disc(10,-34,13,13,'#adbed1');});
  for(let j=0;j<9;j++){const x=403+j*139;poly([[x,1048],[x+53,1048],[x+53,1065],[x,1065]],'#829bbb38');for(let k=0;k<3;k++)disc(x+7+k*19,1052,1,1,ice,.8);}break;
 }
 case 'spill':{
  for(let j=0;j<5;j++)place(j%2?1831:86,235+j*101,.6+(j%2)*.15,Math.sin(t*.8+j)*.15,()=>{poly([[-13,-22],[13,-22],[19,17],[-19,17]],'#96d6d13f');poly([[-17,4],[17,4],[18,15],[-18,15]],mint+'88');line([[-13,-22],[13,-22],[19,17]],ice,1,.8);line([[-16,-24],[16,-24]],gold,4);});
  for(let j=0;j<19;j++){const age=(t*.16+j*.618)%1;ring(345+j*67,1039+Math.sin(t+j)*9,3+age*6,3+age*6,mint,1,Math.sin(age*Math.PI)*.63);}break;
 }
 case 'heartbreak':{
  for(const[x,y,s]of [[84,302,.72],[1829,643,.82],[1402,1041,.7]])place(x,y,s,Math.sin(t*.5+x)*.1,()=>{curve(u=>[Math.sin(u*4)*5,7+u*60],mint,2,.75);for(let j=4;j>=0;j--)disc(Math.cos(j*1.5)*j*3,Math.sin(j*1.5)*j*3,13+j,5+j,metal([-23,-21,23,21],['#f0c9d7','#ae769b','#e8aecf','#755c85']));});
  for(let j=0;j<7;j++){const age=(t*.12+j*.15)%1;c.save();c.globalAlpha*=Math.sin(age*Math.PI);heart(j%2?1839:88,731-age*508,.35+age*.1,pink);c.restore();}
  place(681,1046,.7,-.1,()=>{poly([[-36,-23],[-2,-23],[-7,-8],[1,2],[-6,13],[-3,23],[-36,23]],'#d6c9df6b');poly([[3,-23],[36,-23],[36,23],[3,23],[0,13],[7,2],[-1,-8]],'#a9cbd86b');});break;
 }
 case 'arcade':{
  for(const[x,y,s]of [[94,307,.85],[1826,662,.77],[643,1042,.7]])place(x,y,s,Math.sin(t*.4+x)*.04,()=>{poly([[-43,-20],[37,-20],[48,19],[31,24],[14,9],[-16,9],[-33,24],[-47,19]],metal([-47,-20,48,24]));poly([[-26,-12],[-19,-12],[-19,-5],[-12,-5],[-12,2],[-19,2],[-19,9],[-26,9],[-26,2],[-33,2],[-33,-5],[-26,-5]],'#28485b');disc(26,-3,4,4,pink);disc(36,4,4,4,mint);});
  for(let j=0;j<11;j++){const age=(t*.18+j*.11)%1,x=j%2?1829:97,y=727-age*515;disc(x,y,9*(.2+.8*Math.abs(Math.sin(t*2+j))),10,gold,Math.sin(age*Math.PI)*.85);}
  for(let j=0;j<12;j++)star(425+j*94,29,.2,j%2?mint:gold,t*.3+j);break;
 }
 case 'approval':{
  for(const[x,y,s]of [[89,274,.7],[1838,659,.9],[649,1040,.6],[1448,1040,.7]])place(x,y,s,Math.sin(t*.6+x)*.1,()=>{disc(0,0,27,27,mint+'52');ring(0,0,27,27,gold,1.3,.8);line([[-14,0],[-3,11],[15,-12]],'#c8f9dc',3);});
  for(let j=0;j<9;j++){const x=433+j*130,y=32+Math.sin(t*.8+j)*6;disc(x,y,3,3,gold,.85);halo(x,y,23,mint,.22);}
  curve(u=>[378+u*1170,1062+Math.sin(u*12-t*.6)*5],mint,1.5,.4);break;
 }
 }
 c.restore();
}
